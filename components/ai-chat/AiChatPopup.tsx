"use client";

import { useCallback, useRef, useState } from "react";
import { X, Sparkle, ArrowRight } from "@phosphor-icons/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AiProvider } from "@/lib/ai-providers";
import { streamAiResponse, getProviderConfig } from "@/lib/ai-providers";
import { SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { parseAiResponse } from "./validateScene";
import { ModelSelector } from "./ModelSelector";
import { SystemPromptViewer } from "./SystemPromptViewer";

interface Props {
  open: boolean;
  onClose: () => void;
  excalidrawApi: ExcalidrawImperativeAPI | null;
}

export function AiChatPopup({ open, onClose, excalidrawApi }: Props) {
  const [provider, setProvider] = useState<AiProvider>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("exgit_ai_provider") as AiProvider) || "groq";
    }
    return "groq";
  });
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxPx = 5 * 24;
    ta.style.height = `${Math.min(ta.scrollHeight, maxPx)}px`;
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      requestAnimationFrame(adjustHeight);
    },
    [adjustHeight],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    const apiKey = localStorage.getItem(`exgit_${provider}_apikey`);
    if (!apiKey) {
      const config = getProviderConfig(provider);
      setError(`Add your ${config.name} API key in Settings first.`);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      let accumulated = "";
      const stream = streamAiResponse(provider, SYSTEM_PROMPT, [{ role: "user", content: trimmed }]);

      for await (const chunk of stream) {
        if (chunk.type === "chunk" && chunk.content) {
          accumulated += chunk.content;
        } else if (chunk.type === "error") {
          setError(chunk.error ?? "Unknown error.");
          setIsGenerating(false);
          return;
        }
      }

      const parsed = parseAiResponse(accumulated);
      if (!parsed.ok || !parsed.elements) {
        setError(parsed.error ?? "Failed to parse diagram elements.");
        setIsGenerating(false);
        return;
      }

      if (!excalidrawApi) {
        setError("Canvas not ready. Open a file first.");
        setIsGenerating(false);
        return;
      }

      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const excalidrawElements = convertToExcalidrawElements(
        parsed.elements as Parameters<typeof convertToExcalidrawElements>[0],
        { regenerateIds: true },
      );

      const existing = excalidrawApi.getSceneElements();
      if (existing.length > 0) {
        const maxX = existing.reduce((max: number, el) => {
          return Math.max(max, (el.x ?? 0) + (el.width ?? 0));
        }, 0);
        const offset = maxX + 60;
        const offsetElements = excalidrawElements.map((el) => ({
          ...el,
          x: el.x + offset,
        }));
        excalidrawApi.updateScene({ elements: [...existing, ...offsetElements] });
      } else {
        excalidrawApi.updateScene({ elements: excalidrawElements });
      }

      setSuccess(true);
      setInput("");
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      });
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }, [input, isGenerating, provider, excalidrawApi]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[4px]" />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-[640px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#6965db]/10">
              <Sparkle className="h-5 w-5 text-[#6965db]" weight="fill" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#1b1b1f]">AI Diagram Generator</h2>
              <p className="text-[12px] text-[#868686]">Describe what you want to draw</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Textarea */}
          <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 transition focus-within:border-[#6965db] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6965db]/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Build a networking VPC pipeline with public and private subnets..."
              rows={3}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#1b1b1f] outline-none placeholder:text-[#868686]/60"
            />
          </div>

          {/* Status messages */}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <span className="shrink-0 text-red-400">!</span>
              {error}
            </div>
          )}
          {success && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#6965db]/10 px-4 py-3 text-[13px] text-[#6965db]">
              <span className="shrink-0">&#10003;</span>
              Diagram added to canvas
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ModelSelector value={provider} onChange={setProvider} />
              <SystemPromptViewer provider={provider} />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isGenerating}
              className="flex items-center gap-2 rounded-xl bg-[#6965db] px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#5a56c9] disabled:opacity-40 disabled:pointer-events-none"
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  Generate
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

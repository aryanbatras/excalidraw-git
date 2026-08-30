"use client";

import { useCallback, useRef, useState } from "react";
import { X, Sparkle, ArrowRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
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
    const maxPx = 4 * 24;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-24" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div
        className="relative z-10 w-full max-w-[560px] rounded-2xl border border-white/60 bg-white/90 shadow-[0_8px_48px_rgba(0,0,0,0.12)] backdrop-blur-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#6965db]/10">
              <Sparkle className="h-4 w-4 text-[#6965db]" weight="fill" />
            </div>
            <span className="text-[14px] font-semibold text-[#1b1b1f]">AI Diagram Generator</span>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#868686] transition hover:bg-black/5 hover:text-[#1b1b1f]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input area */}
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-[#e5e5e5] bg-white p-3 transition focus-within:border-[#6965db] focus-within:ring-1 focus-within:ring-[#6965db]/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Describe your diagram..."
              rows={2}
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-[#1b1b1f] outline-none placeholder:text-[#868686]"
            />
            <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
              <div className="flex items-center gap-2">
                <ModelSelector value={provider} onChange={setProvider} />
                <SystemPromptViewer provider={provider} />
              </div>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!input.trim()}
                loading={isGenerating}
                className="flex items-center gap-1.5"
              >
                {isGenerating ? "Generating..." : "Generate"}
                {!isGenerating && <ArrowRight size={14} />}
              </Button>
            </div>
          </div>

          {/* Status messages */}
          {error && (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-600">
              Diagram added to canvas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

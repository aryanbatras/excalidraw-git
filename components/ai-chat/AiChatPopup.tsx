"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Sparkle, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AiProvider } from "@/lib/ai-providers";
import { getProviderConfig } from "@/lib/ai-providers";
import { useAiStream } from "./useAiStream";
import { ChatMessageBubble } from "./ChatMessage";
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
  const { messages, isStreaming, send, stop, clear } = useAiStream();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("exgit_ai_provider", provider);
  }, [provider]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxPx = 6 * 24;
    ta.style.height = `${Math.min(ta.scrollHeight, maxPx)}px`;
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      requestAnimationFrame(adjustHeight);
    },
    [adjustHeight],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const apiKey = localStorage.getItem(`exgit_${provider}_apikey`);
    if (!apiKey) {
      const config = getProviderConfig(provider);
      alert(`Add your ${config.name} API key in Settings first.`);
      return;
    }

    send(trimmed, provider);
    setInput("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [input, isStreaming, provider, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleApplyToCanvas = useCallback(
    async (skeletonElements: unknown[]) => {
      if (!excalidrawApi) {
        alert("Canvas not ready.");
        return;
      }

      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");

      const excalidrawElements = convertToExcalidrawElements(
        skeletonElements as Parameters<typeof convertToExcalidrawElements>[0],
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
    },
    [excalidrawApi],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-24" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative z-10 flex w-full max-w-[640px] flex-col rounded-2xl bg-white shadow-[0_16px_64px_rgba(0,0,0,0.16)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5e5e5] px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkle className="h-5 w-5 text-[#6965db]" weight="fill" />
            <span className="text-[15px] font-semibold text-[#1b1b1f]">AI Diagram Generator</span>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="rounded-md px-2 py-1 text-[12px] text-[#868686] hover:text-[#1b1b1f] hover:bg-[#f5f5f5] transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-[#868686] hover:text-[#1b1b1f] hover:bg-[#f5f5f5] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {messages.length > 0 && (
          <div ref={listRef} className="max-h-80 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} onApply={handleApplyToCanvas} />
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-[#e5e5e5] px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Describe your diagram, paste markdown, or explain a concept..."
            rows={1}
            className="w-full resize-none bg-transparent text-[14px] font-sans leading-relaxed text-[#1b1b1f] outline-none placeholder:text-[#868686]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#e5e5e5] px-4 py-2.5">
          <ModelSelector value={provider} onChange={setProvider} />
          <div className="flex items-center gap-2">
            <SystemPromptViewer provider={provider} />
            {isStreaming ? (
              <Button variant="quiet" onClick={stop} className="flex items-center gap-1.5">
                <Stop className="h-3.5 w-3.5" />
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!input.trim()}
                loading={isStreaming}
              >
                Send
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

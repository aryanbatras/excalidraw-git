"use client";

import { useCallback, useRef, useState } from "react";
import { X, Sparkle, ArrowRight, ChatCircle, Lightning } from "@phosphor-icons/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AiProvider } from "@/lib/ai-providers";
import { streamAiResponse, getProviderConfig } from "@/lib/ai-providers";
import { SYSTEM_PROMPT, QA_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { parseAiResponse } from "./validateScene";
import { ModelSelector } from "./ModelSelector";
import { SystemPromptViewer } from "./SystemPromptViewer";

interface Props {
  open: boolean;
  onClose: () => void;
  excalidrawApi: ExcalidrawImperativeAPI | null;
}

type AiMode = "quick" | "chat";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiChatPopup({ open, onClose, excalidrawApi }: Props) {
  const [provider, setProvider] = useState<AiProvider>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("exgit_ai_provider") as AiProvider) || "groq";
    }
    return "groq";
  });
  const [mode, setMode] = useState<AiMode>("quick");
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
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

  const generateDiagram = useCallback(
    async (finalPrompt: string, conversationHistory?: ChatMessage[]) => {
      const apiKey = localStorage.getItem(`exgit_${provider}_apikey`);
      if (!apiKey) {
        const config = getProviderConfig(provider);
        setError(`Add your ${config.name} API key in Settings first.`);
        setIsGenerating(false);
        return;
      }

      setError(null);
      setSuccess(false);

      try {
        let accumulated = "";
        const messages = conversationHistory
          ? [...conversationHistory, { role: "user" as const, content: finalPrompt }]
          : [{ role: "user" as const, content: finalPrompt }];

        const stream = streamAiResponse(provider, SYSTEM_PROMPT, messages);

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
        setChatMessages([]);
        setAwaitingConfirmation(false);
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
    },
    [provider, excalidrawApi],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    if (mode === "quick") {
      setIsGenerating(true);
      await generateDiagram(trimmed);
    } else {
      // Chat mode: send message and get clarifying questions
      setIsGenerating(true);
      setError(null);

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const updatedMessages = [...chatMessages, userMessage];
      setChatMessages(updatedMessages);
      setInput("");
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      });

      try {
        const apiKey = localStorage.getItem(`exgit_${provider}_apikey`);
        if (!apiKey) {
          const config = getProviderConfig(provider);
          setError(`Add your ${config.name} API key in Settings first.`);
          setIsGenerating(false);
          return;
        }

        let accumulated = "";
        const stream = streamAiResponse(provider, QA_SYSTEM_PROMPT, updatedMessages);

        for await (const chunk of stream) {
          if (chunk.type === "chunk" && chunk.content) {
            accumulated += chunk.content;
          } else if (chunk.type === "error") {
            setError(chunk.error ?? "Unknown error.");
            setIsGenerating(false);
            return;
          }
        }

        const assistantMessage: ChatMessage = { role: "assistant", content: accumulated };
        setChatMessages([...updatedMessages, assistantMessage]);

        // Check if the response contains a confirmation prompt
        if (accumulated.toLowerCase().includes("confirm") || accumulated.toLowerCase().includes("should i generate") || accumulated.toLowerCase().includes("ready to generate")) {
          setAwaitingConfirmation(true);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        setIsGenerating(false);
      }
    }
  }, [input, isGenerating, mode, chatMessages, provider, generateDiagram]);

  const handleConfirmGenerate = useCallback(async () => {
    // Build final prompt from conversation history
    const contextSummary = chatMessages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");
    const finalPrompt = `Based on our conversation:\n${contextSummary}\n\nPlease generate the diagram now.`;
    setIsGenerating(true);
    await generateDiagram(finalPrompt, chatMessages);
  }, [chatMessages, generateDiagram]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (awaitingConfirmation) {
          handleConfirmGenerate();
        } else {
          handleSubmit();
        }
      }
    },
    [handleSubmit, awaitingConfirmation, handleConfirmGenerate],
  );

  const resetChat = useCallback(() => {
    setChatMessages([]);
    setAwaitingConfirmation(false);
    setInput("");
    setError(null);
    setSuccess(false);
  }, []);

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
              <p className="text-[12px] text-[#868686]">
                {mode === "quick" ? "Describe what you want to draw" : "Chat to refine your diagram"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1 border-b border-black/[0.06] px-6 py-2">
          <button
            onClick={() => { setMode("quick"); resetChat(); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              mode === "quick"
                ? "bg-[#6965db]/10 text-[#6965db]"
                : "text-[#868686] hover:bg-black/[0.04] hover:text-[#1b1b1f]"
            }`}
          >
            <Lightning size={14} />
            Quick
          </button>
          <button
            onClick={() => { setMode("chat"); resetChat(); }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              mode === "chat"
                ? "bg-[#6965db]/10 text-[#6965db]"
                : "text-[#868686] hover:bg-black/[0.04] hover:text-[#1b1b1f]"
            }`}
          >
            <ChatCircle size={14} />
            Chat
          </button>
          {mode === "chat" && chatMessages.length > 0 && (
            <button
              onClick={resetChat}
              className="ml-auto text-[11px] text-[#868686] hover:text-[#1b1b1f]"
            >
              Reset
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Chat messages (Chat mode only) */}
          {mode === "chat" && chatMessages.length > 0 && (
            <div className="mb-4 max-h-[300px] space-y-3 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "ml-8 bg-[#6965db]/10 text-[#1b1b1f]"
                      : "mr-8 bg-[#f5f5f5] text-[#1b1b1f]"
                  }`}
                >
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#868686]">
                    {msg.role === "user" ? "You" : "AI"}
                  </div>
                  {msg.content}
                </div>
              ))}
            </div>
          )}

          {/* Confirmation prompt (Chat mode) */}
          {awaitingConfirmation && (
            <div className="mb-4 rounded-xl border border-[#6965db]/20 bg-[#6965db]/5 p-4">
              <p className="text-[13px] text-[#1b1b1f]">
                The AI has gathered enough context. Ready to generate your diagram.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConfirmGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-lg bg-[#6965db] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#5a56c9]"
                >
                  {isGenerating ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Sparkle size={14} weight="fill" />
                  )}
                  Generate
                </button>
                <button
                  onClick={() => {
                    setAwaitingConfirmation(false);
                    setInput("");
                  }}
                  className="rounded-lg px-4 py-2 text-[13px] text-[#868686] transition hover:bg-black/[0.04]"
                >
                  Ask more
                </button>
              </div>
            </div>
          )}

          {/* Textarea */}
          <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 transition focus-within:border-[#6965db] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6965db]/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "quick"
                  ? "Build a networking VPC pipeline with public and private subnets..."
                  : chatMessages.length === 0
                    ? "Describe the diagram you want to create..."
                    : "Ask a follow-up or provide more details..."
              }
              rows={mode === "chat" && chatMessages.length > 0 ? 2 : 3}
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
            {mode === "quick" || !awaitingConfirmation ? (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isGenerating}
                className="flex items-center gap-2 rounded-xl bg-[#6965db] px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#5a56c9] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === "chat" ? "Thinking..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {mode === "chat" ? "Send" : "Generate"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

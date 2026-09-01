"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Sparkle, ArrowRight, ChatCircle, Lightning, MagicWand, Copy, Check } from "@phosphor-icons/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { AiProvider } from "@/lib/ai-providers";
import { streamAiResponse, getProviderConfig } from "@/lib/ai-providers";
import {
  SYSTEM_PROMPT,
  QA_SYSTEM_PROMPT,
  PROMPT_ENHANCER_SYSTEM_PROMPT,
  MERMAID_FIX_PROMPT,
} from "@/lib/ai-prompts";
import { extractMermaid, mermaidToScene, appendSceneElements } from "@/lib/mermaid";
import { ModelSelector } from "./ModelSelector";
import { SystemPromptViewer } from "./SystemPromptViewer";

interface Props {
  open: boolean;
  onClose: () => void;
  excalidrawApi: ExcalidrawImperativeAPI | null;
}

type AiMode = "quick" | "chat" | "enhance";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_HISTORY_KEY = "exgit_ai_chat_history";
const MAX_CHAT_TURNS = 4;

function loadChatHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChatHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)); } catch { /* noop */ }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[#868686] transition hover:bg-black/[0.06] hover:text-[#1b1b1f]"
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
    </button>
  );
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist chat history
  useEffect(() => {
    saveChatHistory(chatMessages);
  }, [chatMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Cleanup auto-close timer
  useEffect(() => {
    return () => { if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current); };
  }, []);

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

  const streamMessage = useCallback(
    async (systemPrompt: string, messages: ChatMessage[]): Promise<string | null> => {
      const apiKey = localStorage.getItem(`exgit_${provider}_apikey`);
      if (!apiKey) {
        const config = getProviderConfig(provider);
        setError(`Add your ${config.name} API key in Settings first.`);
        return null;
      }
      setError(null);
      let accumulated = "";
      const stream = streamAiResponse(provider, systemPrompt, messages);
      for await (const chunk of stream) {
        if (chunk.type === "chunk" && chunk.content) {
          accumulated += chunk.content;
        } else if (chunk.type === "error") {
          setError(chunk.error ?? "Unknown error.");
          return null;
        }
      }
      return accumulated;
    },
    [provider],
  );

  const streamOnce = useCallback(
    async (systemPrompt: string, payload: string): Promise<string | null> => {
      const messages = [{ role: "user" as const, content: payload }];
      let accumulated = "";
      const stream = streamAiResponse(provider, systemPrompt, messages);
      for await (const chunk of stream) {
        if (chunk.type === "chunk" && chunk.content) {
          accumulated += chunk.content;
        } else if (chunk.type === "error") {
          setError(chunk.error ?? "Unknown error.");
          return null;
        }
      }
      return accumulated;
    },
    [provider],
  );

  const generateDiagram = useCallback(
    async (finalPrompt: string, conversationHistory?: ChatMessage[]) => {
      setError(null);
      setSuccess(false);

      try {
        if (!excalidrawApi) {
          setError("Canvas not ready. Open a file first.");
          setIsGenerating(false);
          return;
        }

        const messages = conversationHistory
          ? [...conversationHistory, { role: "user" as const, content: finalPrompt }]
          : [{ role: "user" as const, content: finalPrompt }];

        let accumulated = "";
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

        let mermaid = extractMermaid(accumulated);
        if (!mermaid) {
          setError("The AI did not return valid Mermaid. Try again or use a simpler request.");
          setIsGenerating(false);
          return;
        }

        // Convert with error-recovery loop (LLMs often emit slightly-broken Mermaid).
        let elements;
        let files;
        let parseError: string | null = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await mermaidToScene(mermaid);
            elements = result.elements;
            files = result.files;
            parseError = null;
            break;
          } catch (err) {
            parseError = err instanceof Error ? err.message : "Unknown Mermaid parse error";
            if (attempt === 2) break;

            const fixPrompt = MERMAID_FIX_PROMPT
              .replace("{error}", parseError)
              .replace("{mermaid}", mermaid);
            const fixed = await streamOnce(
              "You are a Mermaid syntax fixer. Output ONLY corrected Mermaid in a code fence.",
              fixPrompt,
            );
            if (!fixed) break;
            const fixedMermaid = extractMermaid(fixed);
            if (!fixedMermaid) break;
            mermaid = fixedMermaid;
          }
        }

        if (!elements || parseError) {
          setError(
            `Could not parse the Mermaid diagram. ${parseError ?? ""}`,
          );
          setIsGenerating(false);
          return;
        }

        const existing = excalidrawApi.getSceneElements();
        const newScene = appendSceneElements(existing, elements);
        excalidrawApi.updateScene({ elements: newScene });
        if (files && Object.keys(files).length > 0) {
          excalidrawApi.addFiles(Object.values(files));
        }
        requestAnimationFrame(() => {
          excalidrawApi.scrollToContent(excalidrawApi.getSceneElements(), {
            animate: true,
            fitToContent: true,
          });
        });

        setSuccess(true);
        setInput("");
        setChatMessages([]);
        setAwaitingConfirmation(false);
        setEnhancedPrompt(null);
        requestAnimationFrame(() => {
          if (textareaRef.current) textareaRef.current.style.height = "auto";
        });
        // Auto-close after 2.5s
        autoCloseTimer.current = setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2500);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        setIsGenerating(false);
      }
    },
    [excalidrawApi, onClose, streamOnce, provider],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    if (mode === "quick") {
      setIsGenerating(true);
      await generateDiagram(trimmed);
    } else if (mode === "enhance") {
      // Enhance mode: get enhanced prompt, then show it
      setIsEnhancing(true);
      setError(null);
      const messages: ChatMessage[] = [{ role: "user", content: trimmed }];
      const result = await streamMessage(PROMPT_ENHANCER_SYSTEM_PROMPT, messages);
      setIsEnhancing(false);
      if (result) {
        setEnhancedPrompt(result);
      }
    } else {
      // Chat mode
      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const updatedMessages = [...chatMessages, userMessage];
      setChatMessages(updatedMessages);
      setInput("");
      requestAnimationFrame(() => {
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      });

      setIsGenerating(true);
      const result = await streamMessage(QA_SYSTEM_PROMPT, updatedMessages);
      setIsGenerating(false);

      if (result) {
        const assistantMessage: ChatMessage = { role: "assistant", content: result };
        const allMessages = [...updatedMessages, assistantMessage];
        setChatMessages(allMessages);

        // Force generation after MAX_CHAT_TURNS exchanges
        const userTurnCount = allMessages.filter((m) => m.role === "user").length;
        if (userTurnCount >= MAX_CHAT_TURNS) {
          setAwaitingConfirmation(true);
        } else if (
          result.toLowerCase().includes("confirm") ||
          result.toLowerCase().includes("should i generate") ||
          result.toLowerCase().includes("ready to generate")
        ) {
          setAwaitingConfirmation(true);
        }
      }
    }
  }, [input, isGenerating, mode, chatMessages, generateDiagram, streamMessage]);

  const handleConfirmGenerate = useCallback(async () => {
    const contextSummary = chatMessages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");
    const finalPrompt = `Based on our conversation:\n${contextSummary}\n\nPlease generate the diagram now.`;
    setIsGenerating(true);
    await generateDiagram(finalPrompt, chatMessages);
  }, [chatMessages, generateDiagram]);

  const handleUseEnhanced = useCallback(async () => {
    if (!enhancedPrompt) return;
    setIsGenerating(true);
    await generateDiagram(enhancedPrompt);
  }, [enhancedPrompt, generateDiagram]);

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
    setEnhancedPrompt(null);
    setInput("");
    setError(null);
    setSuccess(false);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[4px]" />

      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-[780px] flex-col rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden"
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
                {mode === "quick" && "Describe what you want to draw"}
                {mode === "chat" && "Chat to refine your diagram"}
                {mode === "enhance" && "Enhance your prompt for better results"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {chatMessages.length > 0 && (
              <button
                onClick={resetChat}
                className="rounded-lg px-2.5 py-1.5 text-[11px] text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1 border-b border-black/[0.06] px-6 py-2">
          {([
            { id: "quick" as const, icon: Lightning, label: "Quick" },
            { id: "chat" as const, icon: ChatCircle, label: "Chat" },
            { id: "enhance" as const, icon: MagicWand, label: "Enhance" },
          ]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); resetChat(); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                mode === id
                  ? "bg-[#6965db]/10 text-[#6965db]"
                  : "text-[#868686] hover:bg-black/[0.04] hover:text-[#1b1b1f]"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Chat messages */}
        {(mode === "chat" || (mode === "enhance" && enhancedPrompt)) && chatMessages.length > 0 && (
          <div className="mx-6 mt-4 space-y-3 rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "ml-8 bg-[#6965db]/10 text-[#1b1b1f]"
                  : "mr-8 bg-white text-[#1b1b1f] border border-[#e5e5e5]"
              }`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#868686]">
                    {msg.role === "user" ? "You" : "AI"}
                  </span>
                  {msg.role === "assistant" && <CopyButton text={msg.content} />}
                </div>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
                        ul({ children }) { return <ul className="mb-2 list-disc pl-4">{children}</ul>; },
                        ol({ children }) { return <ol className="mb-2 list-decimal pl-4">{children}</ol>; },
                        li({ children }) { return <li className="mb-0.5">{children}</li>; },
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "");
                          const codeStr = String(children).replace(/\n$/, "");
                          if (match) {
                            return (
                              <pre className="my-2 overflow-x-auto rounded-lg bg-[#1e1e2e] p-3 text-[12px] leading-relaxed">
                                <code className={className} {...props}>{codeStr}</code>
                              </pre>
                            );
                          }
                          return <code className="rounded bg-[#f0f0f0] px-1 py-0.5 text-[12px]" {...props}>{children}</code>;
                        },
                        strong({ children }) { return <strong className="font-semibold text-[#1b1b1f]">{children}</strong>; },
                        em({ children }) { return <em className="italic">{children}</em>; },
                        h1({ children }) { return <h1 className="mb-2 text-lg font-bold text-[#1b1b1f]">{children}</h1>; },
                        h2({ children }) { return <h2 className="mb-1.5 text-base font-semibold text-[#1b1b1f]">{children}</h2>; },
                        h3({ children }) { return <h3 className="mb-1 text-sm font-semibold text-[#1b1b1f]">{children}</h3>; },
                        blockquote({ children }) {
                          return <blockquote className="my-2 border-l-3 border-[#6965db]/30 pl-3 text-[#868686] italic">{children}</blockquote>;
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Confirmation prompt (Chat mode) */}
        {awaitingConfirmation && (
          <div className="mx-6 mt-3 rounded-xl border border-[#6965db]/20 bg-[#6965db]/5 p-4">
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
                onClick={() => { setAwaitingConfirmation(false); setInput(""); }}
                className="rounded-lg px-4 py-2 text-[13px] text-[#868686] transition hover:bg-black/[0.04]"
              >
                Ask more
              </button>
            </div>
          </div>
        )}

        {/* Enhanced prompt display (Enhance mode) */}
        {enhancedPrompt && (
          <div className="mx-6 mt-4 rounded-xl border border-[#6965db]/20 bg-[#6965db]/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6965db]">
                Enhanced Prompt
              </span>
              <CopyButton text={enhancedPrompt} />
            </div>
            <div className="text-[13px] leading-relaxed text-[#1b1b1f]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
                  ul({ children }) { return <ul className="mb-2 list-disc pl-4">{children}</ul>; },
                  ol({ children }) { return <ol className="mb-2 list-decimal pl-4">{children}</ol>; },
                  li({ children }) { return <li className="mb-0.5">{children}</li>; },
                  strong({ children }) { return <strong className="font-semibold">{children}</strong>; },
                }}
              >
                {enhancedPrompt}
              </ReactMarkdown>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleUseEnhanced}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-lg bg-[#6965db] px-4 py-2 text-[13px] font-medium text-white transition hover:bg-[#5a56c9]"
              >
                {isGenerating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Sparkle size={14} weight="fill" />
                )}
                Use this prompt to create diagram
              </button>
              <button
                onClick={() => { setEnhancedPrompt(null); setInput(""); }}
                className="rounded-lg px-4 py-2 text-[13px] text-[#868686] transition hover:bg-black/[0.04]"
              >
                Edit prompt
              </button>
            </div>
          </div>
        )}

        </div>
        {/* End scrollable content area */}

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-black/[0.06] px-6 py-4">
          {/* Status messages */}
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <span className="shrink-0 text-red-400">!</span>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#6965db]/10 px-4 py-3 text-[13px] text-[#6965db]">
              <span className="shrink-0">&#10003;</span>
              Diagram added to canvas
            </div>
          )}

          <div className="rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4 transition focus-within:border-[#6965db] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#6965db]/10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "quick"
                  ? "Build a networking VPC pipeline with public and private subnets..."
                  : mode === "enhance"
                    ? "Describe your diagram idea (rough is fine)..."
                    : chatMessages.length === 0
                      ? "Describe the diagram you want to create..."
                      : "Ask a follow-up or provide more details..."
              }
              rows={3}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-[#1b1b1f] outline-none placeholder:text-[#868686]/60"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ModelSelector value={provider} onChange={setProvider} />
              <SystemPromptViewer provider={provider} />
            </div>
            {!awaitingConfirmation && (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isGenerating || isEnhancing}
                className="flex items-center gap-2 rounded-xl bg-[#6965db] px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#5a56c9] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isGenerating || isEnhancing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {mode === "enhance" ? "Enhancing..." : mode === "chat" ? "Thinking..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {mode === "enhance" ? "Enhance" : mode === "chat" ? "Send" : "Generate"}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

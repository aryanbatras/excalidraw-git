"use client";

import { useCallback, useRef, useState } from "react";
import { streamAiResponse, type AiProvider } from "@/lib/ai-providers";
import { SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { parseAiResponse } from "./validateScene";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  elements?: unknown[];
  error?: boolean;
}

interface UseAiStreamReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (text: string, provider: AiProvider) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

export function useAiStream(): UseAiStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const idCounter = useRef(0);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
  }, [stop]);

  const send = useCallback(
    async (text: string, provider: AiProvider) => {
      const userId = `u_${++idCounter.current}`;
      const userMsg: ChatMessage = { id: userId, role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      setIsStreaming(true);
      const assistantId = `a_${++idCounter.current}`;
      let accumulated = "";

      try {
        const history = messages.map((m) => ({ role: m.role, content: m.content }));
        const stream = streamAiResponse(provider, SYSTEM_PROMPT, [...history, { role: "user", content: text }]);

        for await (const chunk of stream) {
          if (chunk.type === "chunk" && chunk.content) {
            accumulated += chunk.content;
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === assistantId);
              if (existing) {
                return prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m));
              }
              return [...prev, { id: assistantId, role: "assistant", content: accumulated }];
            });
          } else if (chunk.type === "error") {
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== assistantId),
              { id: assistantId, role: "assistant", content: chunk.error ?? "Unknown error.", error: true },
            ]);
          } else if (chunk.type === "done") {
            const parsed = parseAiResponse(accumulated);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, elements: parsed.ok ? parsed.elements : undefined, error: !parsed.ok && !m.error }
                  : m,
              ),
            );
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stream failed.";
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== assistantId),
          { id: assistantId, role: "assistant", content: msg, error: true },
        ]);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages],
  );

  return { messages, isStreaming, send, stop, clear };
}

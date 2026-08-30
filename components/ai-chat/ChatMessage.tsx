"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner } from "@/components/ui";
import type { ChatMessage } from "./useAiStream";

interface Props {
  message: ChatMessage;
  onApply?: (elements: unknown[]) => void;
}

export function ChatMessageBubble({ message, onApply }: Props) {
  const isUser = message.role === "user";
  const hasElements = message.elements && message.elements.length > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-[14px] leading-relaxed ${
          isUser
            ? "bg-[#6965db] text-white"
            : message.error
              ? "bg-[#ffc9c9] text-[#1b1b1f]"
              : "bg-[#f5f5f5] text-[#1b1b1f]"
        }`}
      >
        {!isUser && !message.content && !message.error && (
          <div className="flex items-center gap-2 text-[#868686]">
            <Spinner /> Thinking...
          </div>
        )}

        {message.content && (
          <div className="prose prose-sm max-w-none break-words">
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            )}
          </div>
        )}

        {hasElements && onApply && (
          <button
            onClick={() => onApply(message.elements!)}
            className="mt-2 rounded-lg bg-[#6965db] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#5a56c9] transition-colors"
          >
            Apply {message.elements!.length} elements to canvas
          </button>
        )}
      </div>
    </div>
  );
}

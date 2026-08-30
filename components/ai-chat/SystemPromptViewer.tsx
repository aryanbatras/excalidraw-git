"use client";

import { useState } from "react";
import { SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { getApiKey, setApiKey, type AiProvider } from "@/lib/ai-providers";

interface Props {
  provider: AiProvider;
}

export function SystemPromptViewer({ provider }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState(getApiKey(provider));

  const handleSaveKey = () => {
    setApiKey(provider, keyValue);
    setShowKeyInput(false);
  };

  const providerLabel = provider === "groq" ? "Groq" : "Mistral";
  const keyUrl = provider === "groq" ? "https://console.groq.com/keys" : "https://console.mistral.ai/api-keys";

  return (
    <div className="border-t border-[#e5e5e5] px-4 py-3 space-y-2">
      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="text-[12px] text-[#868686] hover:text-[#1b1b1f] transition-colors"
      >
        {showPrompt ? "Hide system prompt" : "View system prompt"}
      </button>

      {showPrompt && (
        <pre className="max-h-48 overflow-auto rounded-lg bg-[#f5f5f5] p-3 text-[11px] leading-relaxed text-[#1b1b1f] whitespace-pre-wrap">
          {SYSTEM_PROMPT}
        </pre>
      )}

      <button
        onClick={() => setShowKeyInput(!showKeyInput)}
        className="text-[12px] text-[#868686] hover:text-[#1b1b1f] transition-colors"
      >
        {showKeyInput ? "Hide key input" : `Set ${providerLabel} API key`}
      </button>

      {showKeyInput && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={`sk-... (${providerLabel})`}
              className="flex-1 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[13px] text-[#1b1b1f] outline-none focus:border-[#6965db]"
            />
            <button
              onClick={handleSaveKey}
              className="rounded-lg bg-[#6965db] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#5a56c9] transition-colors"
            >
              Save
            </button>
          </div>
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#6965db] hover:underline"
          >
            Get a free {providerLabel} API key
          </a>
        </div>
      )}
    </div>
  );
}

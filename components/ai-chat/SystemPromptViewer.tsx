"use client";

import { useState } from "react";
import { getApiKey, setApiKey, type AiProvider } from "@/lib/ai-providers";

interface Props {
  provider: AiProvider;
}

export function SystemPromptViewer({ provider }: Props) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyValue, setKeyValue] = useState(getApiKey(provider));

  const handleSaveKey = () => {
    setApiKey(provider, keyValue);
    setShowKeyInput(false);
  };

  const providerLabel = provider === "groq" ? "Groq" : "Mistral";
  const keyUrl = provider === "groq" ? "https://console.groq.com/keys" : "https://console.mistral.ai/api-keys";

  return (
    <div className="relative">
      <button
        onClick={() => setShowKeyInput(!showKeyInput)}
        className="text-[11px] text-[#868686] hover:text-[#1b1b1f] transition-colors"
      >
        {showKeyInput ? "Hide" : `Set ${providerLabel} key`}
      </button>

      {showKeyInput && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-[#e5e5e5] bg-white p-3 shadow-lg">
          <div className="flex gap-1.5">
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={`sk-... (${providerLabel})`}
              className="flex-1 rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-[12px] text-[#1b1b1f] outline-none focus:border-[#6965db]"
            />
            <button
              onClick={handleSaveKey}
              className="rounded-lg bg-[#6965db] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#5a56c9] transition-colors"
            >
              Save
            </button>
          </div>
          <a
            href={keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-[10px] text-[#6965db] hover:underline"
          >
            Get a free {providerLabel} API key
          </a>
        </div>
      )}
    </div>
  );
}

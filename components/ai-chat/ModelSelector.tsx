"use client";

import type { AiProvider } from "@/lib/ai-providers";
import { getProviderConfig } from "@/lib/ai-providers";

interface Props {
  value: AiProvider;
  onChange: (p: AiProvider) => void;
}

export function ModelSelector({ value, onChange }: Props) {
  const providers: AiProvider[] = ["groq", "mistral"];

  return (
    <div className="flex items-center gap-1 rounded-lg bg-[#f5f5f5] p-0.5">
      {providers.map((p) => {
        const config = getProviderConfig(p);
        const active = value === p;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              active ? "bg-white text-[#1b1b1f] shadow-sm" : "text-[#868686] hover:text-[#1b1b1f]"
            }`}
          >
            {config.name}
            <span className="rounded bg-[#b2f2bb] px-1 py-0.5 text-[9px] font-semibold text-[#2b8a3e]">
              free
            </span>
          </button>
        );
      })}
    </div>
  );
}

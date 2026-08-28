"use client";

import { useMemo } from "react";

export function TextViewer({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div className="flex h-full overflow-auto bg-white text-[13px]">
      {/* Line numbers */}
      <div className="sticky left-0 flex shrink-0 select-none flex-col border-r border-border bg-surface py-4 pr-3 pl-4 font-mono text-[12px] leading-[1.6] text-text-faint">
        {lines.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>

      {/* Content */}
      <pre className="min-w-0 flex-1 overflow-x-auto py-4 pl-4 pr-8 font-mono text-[13px] leading-[1.6] text-text whitespace-pre">
        {content}
      </pre>
    </div>
  );
}

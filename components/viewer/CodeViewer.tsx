"use client";

import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { LANG_BY_EXT } from "@/lib/fileTypes";

export function CodeViewer({
  content,
  extension,
}: {
  content: string;
  extension: string;
}) {
  const lang = LANG_BY_EXT[extension] ?? "text";

  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div className="flex h-full overflow-auto bg-white text-[13px]">
      {/* Line numbers */}
      <div className="sticky left-0 flex shrink-0 select-none flex-col border-r border-border bg-surface py-4 pr-3 pl-4 font-mono text-[12px] leading-[1.6] text-text-faint">
        {lines.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>

      {/* Code */}
      <div className="min-w-0 flex-1 overflow-x-auto py-4 pl-4 pr-8">
        {lang === "text" ? (
          <pre className="font-mono text-[13px] leading-[1.6] text-text whitespace-pre">
            {content}
          </pre>
        ) : (
          <SyntaxHighlighter
            style={oneLight}
            language={lang}
            PreTag="div"
            showLineNumbers={false}
            customStyle={{
              margin: 0,
              padding: 0,
              background: "transparent",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}

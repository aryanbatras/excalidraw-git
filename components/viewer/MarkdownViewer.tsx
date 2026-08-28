"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-slate max-w-none px-8 py-6 text-[14px] leading-relaxed text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: "1em 0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    lineHeight: "1.5",
                  }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              );
            }
            return (
              <code
                className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-text"
                {...props}
              >
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border-b border-border px-3 py-2 text-left font-semibold text-text">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border-b border-border/50 px-3 py-2 text-text-muted">
                {children}
              </td>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
              >
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ""}
                className="my-4 max-w-full rounded-lg"
              />
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 border-l-4 border-accent/30 pl-4 text-text-muted italic">
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return (
              <h1 className="mt-8 mb-4 text-2xl font-bold text-text">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="mt-6 mb-3 text-xl font-semibold text-text">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="mt-5 mb-2 text-lg font-semibold text-text">
                {children}
              </h3>
            );
          },
          ul({ children }) {
            return <ul className="my-3 list-disc pl-6 text-text-muted">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-3 list-decimal pl-6 text-text-muted">{children}</ol>;
          },
          li({ children }) {
            return <li className="my-1">{children}</li>;
          },
          hr() {
            return <hr className="my-6 border-border" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

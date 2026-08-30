"use client";

import { useReducer, useEffect } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft } from "@phosphor-icons/react";
import type { RepoRef } from "@/lib/types";
import { classifyFile, fileExt } from "@/lib/fileTypes";
import { MarkdownViewer } from "./MarkdownViewer";
import { CodeViewer } from "./CodeViewer";
import { ImageViewer } from "./ImageViewer";
import { TextViewer } from "./TextViewer";

const PdfViewer = dynamic(
  () => import("./PdfViewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center text-[13px] text-text-muted">
        Loading PDF viewer…
      </div>
    ),
  },
);

type State = {
  content: string | null;
  blobUrl: string | null;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: "loaded-text"; content: string }
  | { type: "loaded-blob"; blobUrl: string }
  | { type: "loaded-scene"; scene: string }
  | { type: "error"; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded-text":
      return { content: action.content, blobUrl: null, loading: false, error: null };
    case "loaded-blob":
      return { content: null, blobUrl: action.blobUrl, loading: false, error: null };
    case "loaded-scene":
      return { content: action.scene, blobUrl: null, loading: false, error: null };
    case "error":
      return { ...state, loading: false, error: action.error };
  }
}

export function FileViewer({
  repo,
  path,
  onBack,
}: {
  repo: RepoRef;
  path: string;
  onBack?: () => void;
}) {
  const kind = classifyFile(path);
  const ext = fileExt(path);

  const [state, dispatch] = useReducer(reducer, null, (): State => ({
    content: null,
    blobUrl: null,
    loading: true,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(path)}`;

    fetch(`/api/file?${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`);

        if (kind === "excalidraw") {
          const data = await res.json();
          if (!cancelled) dispatch({ type: "loaded-scene", scene: JSON.stringify(data.scene, null, 2) });
          return;
        }

        if (kind === "image" || kind === "pdf") {
          const blob = await res.blob();
          if (!cancelled) dispatch({ type: "loaded-blob", blobUrl: URL.createObjectURL(blob) });
          return;
        }

        const text = await res.text();
        if (!cancelled) dispatch({ type: "loaded-text", content: text });
      })
      .catch((e) => {
        if (!cancelled) dispatch({ type: "error", error: (e as Error).message });
      });

    return () => {
      cancelled = true;
    };
  }, [repo, path, kind]);

  if (state.loading) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-[13px] text-text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          <span>Loading {path.split("/").pop()}…</span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-[14px] font-medium text-danger">Failed to load file</p>
          <p className="mt-1 text-[13px] text-text-muted">{state.error}</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#6965db] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#5a56c9]"
            >
              <ArrowLeft size={14} />
              Back to files
            </button>
          )}
        </div>
      </div>
    );
  }

  const viewerContent = (() => {
    switch (kind) {
      case "markdown":
        return <MarkdownViewer content={state.content ?? ""} />;
      case "code":
        return <CodeViewer content={state.content ?? ""} extension={ext} />;
      case "image":
        return state.blobUrl ? (
          <ImageViewer blobUrl={state.blobUrl} fileName={path} />
        ) : null;
      case "pdf":
        return state.blobUrl ? <PdfViewer blobUrl={state.blobUrl} /> : null;
      case "text":
      default:
        return <TextViewer content={state.content ?? ""} />;
    }
  })();

  // Wrap non-excalidraw viewers with a back button header
  if (kind === "excalidraw") return viewerContent;

  return (
    <div className="flex h-full flex-col">
      {/* Back button header */}
      <div className="flex items-center gap-3 border-b border-[#e5e5e5] bg-white px-4 py-2.5">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        <span className="truncate text-[13px] font-medium text-[#1b1b1f]">
          {path.split("/").pop()}
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        {viewerContent}
      </div>
    </div>
  );
}

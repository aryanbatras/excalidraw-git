"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";

function EditorSkeleton(): ReactNode {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

// Excalidraw touches window/document at import time; load client-only.
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <EditorSkeleton /> },
);

type Api = {
  // minimal imperative API surface we use
  getSceneElements?: () => unknown[];
  getAppState?: () => unknown;
  getFiles?: () => unknown;
  updateScene?: (s: unknown) => void;
};

export function ExcalidrawStage({
  initialData,
  path,
  onChange,
  onApiReady,
}: {
  initialData: Record<string, unknown>;
  path: string;
  onChange: (elements: unknown, appState: unknown, files: unknown) => void;
  onApiReady?: (api: Api | null) => void;
}) {
  const apiRef = useRef<Api | null>(null);

  return (
    <Excalidraw
      key={path}
      initialData={initialData as never}
      excalidrawAPI={(api: unknown) => {
        apiRef.current = api as Api;
        onApiReady?.(apiRef.current);
      }}
      onChange={(elements: unknown, appState: unknown, files: unknown) => {
        onChange(elements, appState, files);
      }}
      theme="light"
      UIOptions={{
        canvasActions: {
          saveToActiveFile: false,
          loadScene: false,
          toggleTheme: false,
          export: { saveFileToDisk: true },
          changeViewBackgroundColor: true,
          clearCanvas: true,
        },
      }}
    />
  );
}

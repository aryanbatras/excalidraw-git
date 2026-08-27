"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useStore } from "@/lib/store";
import { LIBRARIES } from "@/lib/libraries/registry";

function EditorSkeleton(): ReactNode {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <EditorSkeleton /> },
);

export function ExcalidrawStage({
  initialData,
  path,
  onChange,
  onApiReady,
}: {
  initialData: Record<string, unknown>;
  path: string;
  onChange: (elements: unknown, appState: unknown, files: unknown) => void;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const loadedLibs = useRef(new Set<string>());
  const enabledLibraries = useStore((s) => s.enabledLibraries);

  const loadLibraries = useCallback(
    async (api: ExcalidrawImperativeAPI) => {
      for (const libId of enabledLibraries) {
        if (loadedLibs.current.has(libId)) continue;
        const meta = LIBRARIES.find((l) => l.id === libId);
        if (!meta) continue;
        try {
          const res = await fetch(meta.file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const items = await loadLibraryFromBlob(blob, "published");
          await api.updateLibrary({
            libraryItems: items,
            merge: true,
            prompt: false,
            openLibraryMenu: false,
          });
          loadedLibs.current.add(libId);
        } catch (err) {
          console.error(`Failed to load library ${libId}:`, err);
        }
      }
    },
    [enabledLibraries],
  );

  const handleAPI = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      onApiReady?.(api);
      void loadLibraries(api);
    },
    [onApiReady, loadLibraries],
  );

  return (
    <Excalidraw
      key={path}
      initialData={initialData as never}
      excalidrawAPI={handleAPI}
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

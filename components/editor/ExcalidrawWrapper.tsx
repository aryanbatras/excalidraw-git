"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
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

type Api = {
  getSceneElements?: () => unknown[];
  getAppState?: () => unknown;
  getFiles?: () => unknown;
  updateScene?: (s: unknown) => void;
  updateLibrary?: (opts: {
    libraryItems: unknown[];
    merge?: boolean;
    prompt?: boolean;
  }) => Promise<unknown>;
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
  const loadedLibs = useRef(new Set<string>());
  const enabledLibraries = useStore((s) => s.enabledLibraries);

  const loadLibraries = useCallback(
    async (api: Api) => {
      for (const libId of enabledLibraries) {
        if (loadedLibs.current.has(libId)) continue;
        const meta = LIBRARIES.find((l) => l.id === libId);
        if (!meta) continue;
        try {
          const res = await fetch(meta.file);
          if (!res.ok) continue;
          const lib = await res.json();
          // Support both v1 (library) and v2 (libraryItems) formats
          const items = lib.libraryItems ?? lib.library ?? [];
          if (items.length === 0) continue;
          // Normalize v1 format: each item in v1 is an array of elements
          const normalized = items.map((item: any, i: number) => {
            if (Array.isArray(item)) {
              return {
                status: "published",
                id: `lib-${libId}-${i}`,
                name: `Item ${i + 1}`,
                elements: item,
              };
            }
            return item;
          });
          await api.updateLibrary?.({
            libraryItems: normalized,
            merge: true,
            prompt: false,
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
    (api: unknown) => {
      const typed = api as Api;
      apiRef.current = typed;
      onApiReady?.(typed);
      if (typed) {
        void loadLibraries(typed);
      }
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

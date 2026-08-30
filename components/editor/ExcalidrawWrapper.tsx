"use client";

import dynamic from "next/dynamic";
import { useRef, useCallback, type ReactNode } from "react";
import "@excalidraw/excalidraw/index.css";
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { FolderOpen } from "@phosphor-icons/react";
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
  onToggleSidebar,
}: {
  initialData: Record<string, unknown>;
  path: string;
  onChange: (elements: unknown, appState: unknown, files: unknown) => void;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
  onToggleSidebar?: () => void;
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

  /**
   * Section 5: Image compression notification.
   * Detect large images in the scene and notify the user.
   * Actual compression happens at save time (scene serialization).
   */
  const prevFilesRef = useRef<Set<string>>(new Set());

  const handleChange = useCallback(
    (elements: unknown, appState: unknown, files: unknown) => {
      const filesMap = files as Record<string, { mimeType?: string; size?: number; id?: string; dataURL?: string }> | undefined;
      if (filesMap && typeof filesMap === "object") {
        const entries = Object.entries(filesMap);
        for (const [fileId, fileData] of entries) {
          if (
            fileData?.mimeType?.startsWith("image/") &&
            (fileData.mimeType === "image/jpeg" || fileData.mimeType === "image/webp") &&
            fileData.size &&
            fileData.size > 1 * 1024 * 1024 &&
            !prevFilesRef.current.has(fileId)
          ) {
            prevFilesRef.current.add(fileId);
            const api = apiRef.current;
            if (api && fileData.dataURL) {
              void (async () => {
                try {
                  const imageCompression = (await import("browser-image-compression")).default;
                  const res = await fetch(fileData.dataURL!);
                  const blob = await res.blob();
                  const file = new File([blob], `${fileId}.${fileData.mimeType?.split("/")[1] ?? "png"}`, { type: fileData.mimeType });
                  const compressed = await imageCompression(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: false,
                  });
                  const reader = new FileReader();
                  reader.onload = () => {
                    const compressedDataURL = reader.result as string;
                    api.updateScene({
                      files: {
                        ...filesMap,
                        [fileId]: { ...filesMap[fileId], dataURL: compressedDataURL, size: compressed.size },
                      },
                    } as never);
                  };
                  reader.readAsDataURL(compressed);
                } catch {
                  /* compression failed — keep original */
                }
              })();
            }
          }
        }
      }

      onChange(elements, appState, files);
    },
    [onChange],
  );

  return (
    <Excalidraw
      key={path}
      initialData={initialData as never}
      excalidrawAPI={handleAPI}
      onChange={handleChange}
      theme="light"
      renderTopRightUI={
        onToggleSidebar
          ? () => (
              <button
                onClick={onToggleSidebar}
                className="h-9 w-9 rounded-lg bg-white/90 p-1.5 text-[#868686] shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-[#1b1b1f]"
                title="Toggle file explorer"
              >
                <FolderOpen size={18} />
              </button>
            )
          : undefined
      }
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

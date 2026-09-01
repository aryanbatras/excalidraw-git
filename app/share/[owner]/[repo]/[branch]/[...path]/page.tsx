"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { GithubLogo, ArrowLeft } from "@phosphor-icons/react";
import type { Scene } from "@/lib/types";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => (
    <div className="grid h-full w-full place-items-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#6965db]" />
    </div>
  ) },
);

function ViewerSkeleton() {
  return (
    <div className="grid h-full min-h-[100dvh] w-full place-items-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#6965db]" />
    </div>
  );
}

function computeViewportFit(elements: Record<string, unknown>[]): {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
} {
  if (!elements || elements.length === 0) {
    return { scrollX: 0, scrollY: 0, zoom: { value: 1 } };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const x = (el.x as number) ?? 0;
    const y = (el.y as number) ?? 0;
    const w = (el.width as number) ?? 0;
    const h = (el.height as number) ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  const contentW = maxX - minX || 100;
  const contentH = maxY - minY || 100;

  // Use window dimensions with padding for UI chrome.
  const viewW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const viewH = typeof window !== "undefined" ? window.innerHeight : 800;
  const padding = 100;

  const scaleX = (viewW - padding * 2) / contentW;
  const scaleY = (viewH - padding * 2) / contentH;
  const zoomValue = Math.min(scaleX, scaleY, 1);

  // Center content in viewport.
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scrollX = viewW / 2 - centerX * zoomValue;
  const scrollY = viewH / 2 - centerY * zoomValue;

  return { scrollX, scrollY, zoom: { value: zoomValue } };
}

export default function SharePage() {
  const params = useParams<{ owner: string; repo: string; branch: string; path: string[] }>();

  const owner = params?.owner;
  const repo = params?.repo;
  const branch = params?.branch;
  const path = Array.isArray(params?.path) ? params.path.join("/") : (params?.path as string) ?? "";

  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repo || !branch || !path) return;
    let alive = true;
    const qs = `owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`;
    fetch(`/api/share?${qs}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error || `Failed (${res.status})`);
        }
        const data = (await res.json()) as { scene: Scene };
        if (alive) setScene(data.scene);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => { alive = false; };
  }, [owner, repo, branch, path]);

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-white px-4">
        <div className="w-[420px] max-w-full rounded-2xl p-6 text-center shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
          <p className="text-[15px] font-semibold text-[#1b1b1f]">Diagram unavailable</p>
          <p className="mt-2 text-[13px] text-[#868686]">{error}</p>
        </div>
      </div>
    );
  }

  const viewport = scene?.elements
    ? computeViewportFit(scene.elements as Record<string, unknown>[])
    : null;

  const initialData = scene && viewport
    ? {
        elements: scene.elements,
        appState: {
          viewModeEnabled: true,
          scrollX: viewport.scrollX,
          scrollY: viewport.scrollY,
          zoom: viewport.zoom,
        },
        files: scene.files,
      }
    : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      <div className="absolute inset-0 z-0">
        {initialData ? (
          <Excalidraw
            initialData={initialData as never}
            viewModeEnabled
            theme="light"
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                toggleTheme: false,
                export: { saveFileToDisk: true },
                changeViewBackgroundColor: false,
                clearCanvas: false,
              },
            }}
          />
        ) : (
          <ViewerSkeleton />
        )}
      </div>

      {/* Top bar */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <a
          href={`/?fromShare=${encodeURIComponent(owner ?? "")}/${encodeURIComponent(repo ?? "")}/${encodeURIComponent(branch ?? "")}/${path.split("/").map(encodeURIComponent).join("/")}`}
          className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-[12px] font-medium text-[#1b1b1f] shadow-sm backdrop-blur-sm transition hover:bg-white"
          title="Edit a copy of this diagram"
        >
          <ArrowLeft size={14} />
          Edit locally
        </a>
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm">
          <GithubLogo size={14} weight="fill" className="text-[#868686]" />
          <span className="text-[12px] text-[#868686]">
            <span className="font-medium text-[#1b1b1f]">Read-only</span>
            <span className="mx-1.5">·</span>
            {owner}/{repo}
          </span>
        </div>
      </div>
    </div>
  );
}

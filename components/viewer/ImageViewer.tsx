"use client";

import { useState, useCallback, useRef } from "react";
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut, Download } from "@phosphor-icons/react";

export function ImageViewer({
  blobUrl,
  fileName,
}: {
  blobUrl: string;
  fileName: string;
}) {
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.25, 5)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.25, 0.25)), []);
  const resetZoom = useCallback(() => setScale(1), []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName.split("/").pop() ?? "image";
    a.click();
  }, [blobUrl, fileName]);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-white px-3 py-1.5">
        <button
          onClick={zoomOut}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          title="Zoom out"
        >
          <MagnifyingGlassMinus size={15} />
        </button>
        <span className="min-w-[3rem] text-center text-[12px] font-medium text-text-muted">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          title="Zoom in"
        >
          <MagnifyingGlassPlus size={15} />
        </button>
        <button
          onClick={resetZoom}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          title="Reset zoom"
        >
          <ArrowsOut size={15} />
        </button>
        <div className="flex-1" />
        <button
          onClick={handleDownload}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          title="Download"
        >
          <Download size={15} />
        </button>
      </div>

      {/* Image */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-6"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={fileName}
          className="max-w-full object-contain transition-transform duration-150"
          style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  CaretLeft,
  CaretRight,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
} from "@phosphor-icons/react";

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfViewer({ blobUrl }: { blobUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
      setPageNumber(1);
      setLoading(false);
    },
    [],
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  const prevPage = useCallback(
    () => setPageNumber((p) => Math.max(1, p - 1)),
    [],
  );
  const nextPage = useCallback(
    () => setPageNumber((p) => Math.min(numPages, p + 1)),
    [numPages],
  );
  const zoomIn = useCallback(() => setScale((s) => Math.min(s + 0.2, 3)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(s - 0.2, 0.4)), []);

  if (error) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-danger">
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-white px-3 py-1.5">
        <button
          onClick={prevPage}
          disabled={pageNumber <= 1}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
        >
          <CaretLeft size={15} />
        </button>
        <span className="min-w-[6rem] text-center text-[12px] font-medium text-text-muted">
          {loading ? "Loading…" : `${pageNumber} / ${numPages}`}
        </span>
        <button
          onClick={nextPage}
          disabled={pageNumber >= numPages}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
        >
          <CaretRight size={15} />
        </button>
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          onClick={zoomOut}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <MagnifyingGlassMinus size={15} />
        </button>
        <span className="min-w-[3rem] text-center text-[12px] font-medium text-text-muted">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <MagnifyingGlassPlus size={15} />
        </button>
      </div>

      {/* PDF pages */}
      <div className="flex flex-1 justify-center overflow-auto p-6">
        <Document
          file={blobUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="grid h-64 place-items-center text-[13px] text-text-muted">
              Loading PDF…
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </div>
  );
}

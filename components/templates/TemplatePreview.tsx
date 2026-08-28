"use client";

import { useState, useEffect, useMemo } from "react";
import type { Scene } from "@/lib/types";

/**
 * Lightweight live preview of an Excalidraw scene.
 * Renders a simplified SVG from scene elements when a thumbnail file is missing.
 * NOT a full Excalidraw mount — just enough for a card image.
 */
export function TemplatePreview({ file }: { file: string }) {
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(file)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setScene(data as Scene);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [file]);

  const viewBox = useMemo(() => {
    if (!scene?.elements?.length) return "0 0 400 300";
    const els = scene.elements as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of els) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + (el.width ?? 0) > maxX) maxX = el.x + (el.width ?? 0);
      if (el.y + (el.height ?? 0) > maxY) maxY = el.y + (el.height ?? 0);
    }
    const w = maxX - minX || 400;
    const h = maxY - minY || 300;
    const pad = 20;
    return `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [scene]);

  if (!scene?.elements?.length) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent/5 to-accent/10">
        <span className="text-[11px] text-text-faint">Preview unavailable</span>
      </div>
    );
  }

  return (
    <svg
      viewBox={viewBox}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {(scene.elements as Array<Record<string, unknown>>).map((el, i) => {
        const type = el.type as string;
        const x = (el.x as number) ?? 0;
        const y = (el.y as number) ?? 0;
        const w = (el.width as number) ?? 0;
        const h = (el.height as number) ?? 0;
        const stroke = (el.strokeColor as string) ?? "#1b1b1f";
        const fill =
          el.fillStyle === "solid" || el.fillStyle === "hachure"
            ? (el.backgroundColor as string) ?? "transparent"
            : "transparent";
        const strokeWidth = ((el.strokeWidth as number) ?? 1) * 0.5;

        if (type === "rectangle" || type === "frame" || type === "text") {
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={fill === "transparent" ? "none" : fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              rx={4}
            />
          );
        }
        if (type === "ellipse") {
          return (
            <ellipse
              key={i}
              cx={x + w / 2}
              cy={y + h / 2}
              rx={w / 2}
              ry={h / 2}
              fill={fill === "transparent" ? "none" : fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        }
        if (type === "diamond") {
          return (
            <polygon
              key={i}
              points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`}
              fill={fill === "transparent" ? "none" : fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        }
        if (type === "line" || type === "arrow") {
          const points = (el.points as number[][]) ?? [[0, 0], [w, h]];
          const d = points
            .map((p, j) => `${j === 0 ? "M" : "L"}${x + p[0]} ${y + p[1]}`)
            .join(" ");
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              markerEnd={type === "arrow" ? "url(#arrowhead)" : undefined}
            />
          );
        }
        if (type === "freedraw") {
          const points = (el.points as number[][]) ?? [];
          if (points.length < 2) return null;
          const d = points
            .map((p, j) => `${j === 0 ? "M" : "L"}${x + p[0]} ${y + p[1]}`)
            .join(" ");
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        // Fallback: render as a rectangle
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w || 10}
            height={h || 10}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      })}
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#1b1b1f" />
        </marker>
      </defs>
    </svg>
  );
}

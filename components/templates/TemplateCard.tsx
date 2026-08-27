"use client";

import { useState } from "react";
import Image from "next/image";
import type { GalleryTemplate } from "@/lib/templates/gallery";

export function TemplateCard({
  template,
  onClick,
}: {
  template: GalleryTemplate;
  onClick: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl bg-white text-left transition hover:shadow-md"
    >
      {/* Thumbnail (400×300 preview); falls back to a plain-text tile if missing */}
      <div className="relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br from-accent/5 to-accent/10">
        {imgFailed ? (
          <span className="px-1 text-center text-[12px] font-medium leading-tight text-text-muted">
            {template.name}
          </span>
        ) : (
          <Image
            src={template.thumbnail}
            alt={template.name}
            width={400}
            height={300}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <span className="text-[12px] font-medium text-text">{template.name}</span>
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted">
          {template.description}
        </span>
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {template.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
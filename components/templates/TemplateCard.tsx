"use client";

import { useState } from "react";
import type { GalleryTemplate } from "@/lib/templates/gallery";
import { TemplatePreview } from "./TemplatePreview";

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
      className="group flex flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm transition hover:shadow-lg"
    >
      {/* Thumbnail — big and prominent */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-accent/5 to-accent/10">
        {imgFailed ? (
          <TemplatePreview file={template.file} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
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

      {/* Info */}
      <div className="flex flex-1 flex-col p-3.5">
        <span className="text-[14px] font-semibold text-text">
          {template.name}
        </span>
        <span className="mt-1 text-[12px] leading-snug text-text-muted">
          {template.description}
        </span>
        <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
          {template.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-accent-weak px-2 py-0.5 text-[10px] font-medium text-accent"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

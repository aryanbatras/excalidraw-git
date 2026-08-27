"use client";

import { CATEGORY_META, type GalleryTemplate } from "@/lib/templates/gallery";

export function TemplateCard({
  template,
  onClick,
}: {
  template: GalleryTemplate;
  onClick: () => void;
}) {
  const cat = CATEGORY_META[template.category];
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white text-left transition hover:shadow-md hover:border-accent/40"
    >
      {/* Thumbnail placeholder */}
      <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-accent/5 to-accent/10 text-3xl">
        {cat.icon}
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

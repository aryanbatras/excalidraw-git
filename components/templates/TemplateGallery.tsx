"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import {
  GALLERY_TEMPLATES,
  CATEGORY_META,
  type TemplateCategory,
  type GalleryTemplate,
} from "@/lib/templates/gallery";
import { TemplateCard } from "./TemplateCard";

const ALL_CATEGORIES: TemplateCategory[] = Object.keys(CATEGORY_META) as TemplateCategory[];

export function TemplateGallery({
  onClose,
  onSelect,
  canAppend,
}: {
  onClose: () => void;
  onSelect: (template: GalleryTemplate, mode: "append" | "new") => void;
  canAppend: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<GalleryTemplate | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTemplate) {
          setSelectedTemplate(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selectedTemplate]);

  // Focus the dialog on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    let list = GALLERY_TEMPLATES;
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      );
    }
    return list;
  }, [activeCategory, search]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Centered dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="fixed inset-4 z-50 mx-auto my-auto flex max-h-[85vh] max-w-[720px] flex-col rounded-2xl bg-white shadow-[0_16px_64px_rgba(0,0,0,0.16)] outline-none sm:inset-auto sm:top-[8vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <h2 className="flex-1 text-[16px] font-semibold text-text">Templates</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border px-6 py-3">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-xl bg-surface px-4 py-2.5 text-[13px] text-text outline-none placeholder:text-text-faint focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-6 py-2.5 scrollbar-none">
          <Tab
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            All
          </Tab>
          {ALL_CATEGORIES.map((cat) => (
            <Tab
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_META[cat].label}
            </Tab>
          ))}
        </div>

        {/* Big card grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-text-muted">
              No templates found.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onClick={() => setSelectedTemplate(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        <div className="border-t border-border px-6 py-2.5 text-[11px] text-text-muted">
          {filtered.length} template{filtered.length !== 1 && "s"}
        </div>
      </div>

      {/* Append/New choice — inline in the dialog overlay */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/30"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="w-[360px] rounded-2xl bg-white p-6 shadow-[0_16px_64px_rgba(0,0,0,0.16)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold text-text">
              {selectedTemplate.name}
            </h3>
            <p className="mt-1 text-[13px] text-text-muted">
              {selectedTemplate.description}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {canAppend ? (
                <button
                  onClick={() => {
                    onSelect(selectedTemplate, "append");
                    setSelectedTemplate(null);
                    onClose();
                  }}
                  className="rounded-xl bg-surface px-4 py-3 text-left text-[13px] font-medium text-text transition hover:shadow-sm"
                >
                  Append to current file
                  <span className="mt-0.5 block text-[11px] font-normal text-text-muted">
                    Adds elements to the right of your diagram
                  </span>
                </button>
              ) : (
                <div className="rounded-xl bg-surface px-4 py-3 text-[11px] text-text-faint">
                  Open a file first to append templates.
                </div>
              )}
              <button
                onClick={() => {
                  onSelect(selectedTemplate, "new");
                  setSelectedTemplate(null);
                  onClose();
                }}
                className="rounded-xl bg-surface px-4 py-3 text-left text-[13px] font-medium text-text transition hover:shadow-sm"
              >
                Create new file
                <span className="mt-0.5 block text-[11px] font-normal text-text-muted">
                  Opens a new file with the template content
                </span>
              </button>
            </div>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="mt-3 w-full text-center text-[12px] text-text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition ${
        active
          ? "bg-text text-white"
          : "bg-surface-2 text-text-muted hover:bg-surface hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  CaretRight,
  CaretDown,
  Folder,
  FolderOpen,
  PencilSimple,
  Trash,
  Plus,
} from "@phosphor-icons/react";
import type { RepoRef, TreeEntry } from "@/lib/types";
import { useStore } from "@/lib/store";

const ICON_MAP: Record<string, { color: string; label: string }> = {
  md: { color: "#868686", label: "MD" },
  txt: { color: "#868686", label: "TXT" },
  json: { color: "#b45309", label: "JSON" },
  ts: { color: "#3178c6", label: "TS" },
  tsx: { color: "#3178c6", label: "TSX" },
  js: { color: "#f7df1e", label: "JS" },
  jsx: { color: "#f7df1e", label: "JSX" },
  py: { color: "#3776ab", label: "PY" },
  rs: { color: "#ce422b", label: "RS" },
  go: { color: "#00add8", label: "GO" },
  html: { color: "#e34c26", label: "HTML" },
  css: { color: "#264de4", label: "CSS" },
  yaml: { color: "#cb171e", label: "YAML" },
  yml: { color: "#cb171e", label: "YML" },
  toml: { color: "#9c4221", label: "TOML" },
  xml: { color: "#f16529", label: "XML" },
  sh: { color: "#4eaa25", label: "SH" },
  bash: { color: "#4eaa25", label: "BASH" },
  dockerfile: { color: "#2496ed", label: "DF" },
  sql: { color: "#336791", label: "SQL" },
  csv: { color: "#217346", label: "CSV" },
  pdf: { color: "#ff0000", label: "PDF" },
  png: { color: "#868686", label: "PNG" },
  jpg: { color: "#868686", label: "JPG" },
  jpeg: { color: "#868686", label: "JPEG" },
  gif: { color: "#868686", label: "GIF" },
  svg: { color: "#ffb13b", label: "SVG" },
  webp: { color: "#868686", label: "WEBP" },
};

const FileIcon = memo(function FileIcon({ name, isExcalidraw }: { name: string; isExcalidraw: boolean }) {
  if (isExcalidraw) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#6965db]">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.2" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const info = ICON_MAP[ext] || { color: "#868686", label: ext.toUpperCase().slice(0, 3) || "?" };
  return (
    <span
      className="inline-flex h-4 min-w-[28px] items-center justify-center rounded-[3px] px-1 text-[9px] font-bold leading-none"
      style={{ backgroundColor: `${info.color}18`, color: info.color }}
    >
      {info.label}
    </span>
  );
});

export const TreeNode = memo(function TreeNode({
  entry,
  depth,
  repo,
  onOpen,
  onNewFile,
  onRename,
  onDelete,
}: {
  entry: TreeEntry;
  depth: number;
  repo: RepoRef;
  onOpen: (path: string) => void;
  onNewFile: (dirPath: string) => void;
  onRename: (entry: TreeEntry) => void;
  onDelete: (entry: TreeEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const dirCache = useStore((s) => s.dirCache);
  const loadedDirs = useStore((s) => s.loadedDirs);
  const setDir = useStore((s) => s.setDir);
  const selectedPath = useStore((s) => s.selectedPath);
  const dirty = useStore((s) => s.dirty);

  const isDir = entry.type === "dir";
  const children = loadedDirs[entry.path] ? dirCache[entry.path] : undefined;
  const loaded = !!loadedDirs[entry.path];

  const isDirty = useMemo(() => {
    if (dirty[entry.path]) return true;
    if (!isDir) return false;
    const prefix = entry.path + "/";
    return Object.keys(dirty).some((p) => p.startsWith(prefix) && dirty[p]);
  }, [dirty, entry.path, isDir]);

  useEffect(() => {
    if (!isDir || !expanded || loaded) return;
    let alive = true;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(entry.path)}`;
        const res = await fetch(`/api/tree?${qs}`, { signal: controller.signal });
        if (!res.ok) {
          if (alive) setDir(entry.path, []);
          return;
        }
        const data = (await res.json()) as { entries: TreeEntry[] };
        if (alive) setDir(entry.path, data.entries);
      } catch (e) {
        if (alive && !(e instanceof DOMException && e.name === "AbortError")) {
          setDir(entry.path, []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [isDir, expanded, loaded, entry.path, repo.owner, repo.repo, repo.branch, setDir]);

  const toggle = useMemo(() => {
    if (!isDir) return undefined;
    return () => setExpanded((v) => !v);
  }, [isDir]);

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={selectedPath === entry.path}
        tabIndex={0}
        onClick={() => (isDir ? toggle?.() : onOpen(entry.path))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (isDir) toggle?.();
            else onOpen(entry.path);
          }
        }}
        className={`group flex h-[34px] cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] transition-colors ${
          selectedPath === entry.path
            ? "bg-[#6965db]/10 text-[#6965db] font-medium"
            : "text-[#1b1b1f] hover:bg-black/5"
        }`}
        style={{ paddingLeft: 12 + depth * 18 }}
      >
        {isDir ? (
          <>
            <span className="text-[#868686]">
              {expanded ? <CaretDown size={11} /> : <CaretRight size={11} />}
            </span>
            {expanded ? (
              <FolderOpen size={16} className="text-[#868686]" weight="fill" />
            ) : (
              <Folder size={16} className="text-[#868686]" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon name={entry.name} isExcalidraw={entry.isExcalidraw} />
          </>
        )}
        <span className="flex-1 truncate leading-tight">{entry.name}</span>
        {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" />}
        {isDir && (
          <button
            title="New file here"
            onClick={(e) => {
              e.stopPropagation();
              onNewFile(entry.path);
            }}
            className="hidden shrink-0 text-[#868686] hover:text-[#1b1b1f] group-hover:block"
          >
            <Plus size={14} />
          </button>
        )}
        {!isDir && entry.isExcalidraw && (
          <span className="hidden shrink-0 gap-1 group-hover:flex">
            <button
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                onRename(entry);
              }}
              className="text-[#868686] hover:text-[#1b1b1f]"
            >
              <PencilSimple size={13} />
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry);
              }}
              className="text-[#868686] hover:text-[#dc3545]"
            >
              <Trash size={13} />
            </button>
          </span>
        )}
        {loading && <span className="text-[#868686]">...</span>}
      </div>
      {isDir && expanded && children && (
        <div role="group">
          {children.length === 0 ? (
            <div className="py-1.5 pl-8 text-[12px] text-[#868686]">Empty</div>
          ) : (
            children.map((c) => (
              <TreeNode
                key={c.path}
                entry={c}
                depth={depth + 1}
                repo={repo}
                onOpen={onOpen}
                onNewFile={onNewFile}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
});

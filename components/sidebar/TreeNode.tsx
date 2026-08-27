"use client";

import { useEffect, useState } from "react";
import { CaretRight, CaretDown, File, Folder, FolderOpen } from "@phosphor-icons/react";
import type { RepoRef, TreeEntry } from "@/lib/types";
import { useStore } from "@/lib/store";

export function TreeNode({
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
  const isDirty = dirty[entry.path] || (isDir && Object.keys(dirty).some((p) => p.startsWith(entry.path + "/") && dirty[p]));

  // If this dir is expanded but not loaded (first expand, or its cache was
  // invalidated by a mutation), fetch it.
  useEffect(() => {
    if (!isDir || !expanded || loaded) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(entry.path)}`;
        const res = await fetch(`/api/tree?${qs}`);
        if (!res.ok) {
          if (alive) setDir(entry.path, []);
          return;
        }
        const data = (await res.json()) as { entries: TreeEntry[] };
        if (alive) setDir(entry.path, data.entries);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isDir, expanded, loaded, entry.path, repo.owner, repo.repo, repo.branch, setDir]);

  function toggle() {
    if (!isDir) return;
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={selectedPath === entry.path}
        tabIndex={0}
        onClick={() => (isDir ? toggle() : onOpen(entry.path))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (isDir) toggle();
            else onOpen(entry.path);
          }
        }}
        className={`group flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[6px] pr-2 text-[13px] ${
          selectedPath === entry.path
            ? "bg-accent-weak text-text shadow-[inset_3px_0_0_0_#6965db]"
            : "text-text hover:bg-surface-2"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {isDir ? (
          <>
            <span className="text-text-faint">
              {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
            </span>
            {expanded ? (
              <FolderOpen size={15} className="text-text-muted" />
            ) : (
              <Folder size={15} className="text-text-muted" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            <File size={15} className={entry.isExcalidraw ? "text-accent" : "text-text-muted"} />
          </>
        )}
        <span className="flex-1 truncate">{entry.name}</span>
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-status-dirty" title="Unsaved changes" />}
        {isDir && (
          <button
            title="New file here"
            onClick={(e) => {
              e.stopPropagation();
              onNewFile(entry.path);
            }}
            className="hidden text-text-faint hover:text-text group-hover:block"
          >
            <File size={14} />
          </button>
        )}
        {!isDir && entry.isExcalidraw && (
          <span className="hidden gap-1 group-hover:flex">
            <button
              title="Rename"
              onClick={(e) => {
                e.stopPropagation();
                onRename(entry);
              }}
              className="text-text-faint hover:text-text"
            >
              ✎
            </button>
            <button
              title="Delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry);
              }}
              className="text-text-faint hover:text-danger"
            >
              🗑
            </button>
          </span>
        )}
        {loading && <span className="text-text-faint">…</span>}
      </div>
      {isDir && expanded && children && (
        <div role="group">
          {children.length === 0 ? (
            <div className="py-1 pl-8 text-[12px] text-text-faint">empty</div>
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
}

"use client";

import { useEffect } from "react";
import type { RepoRef, TreeEntry } from "@/lib/types";
import { useStore } from "@/lib/store";
import { TreeNode } from "./TreeNode";

export function FileTree({
  repo,
  onOpen,
  onNewFile,
  onRename,
  onDelete,
}: {
  repo: RepoRef;
  onOpen: (path: string) => void;
  onNewFile: (dirPath: string) => void;
  onRename: (entry: TreeEntry) => void;
  onDelete: (entry: TreeEntry) => void;
}) {
  const dirCache = useStore((s) => s.dirCache);
  const loadedDirs = useStore((s) => s.loadedDirs);
  const setDir = useStore((s) => s.setDir);

  useEffect(() => {
    let alive = true;
    (async () => {
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=`;
      const res = await fetch(`/api/tree?${qs}`);
      if (!res.ok) return;
      const data = (await res.json()) as { entries: TreeEntry[] };
      if (alive) setDir("", data.entries);
    })();
    return () => {
      alive = false;
    };
  }, [repo.owner, repo.repo, repo.branch, setDir]);

  const root = loadedDirs[""] ? dirCache[""] : undefined;

  return (
    <div className="scroll-thin flex-1 overflow-y-auto px-1.5 py-1" role="tree">
      {root === undefined ? (
        <div className="px-2 py-3 text-[12px] text-text-faint">Loading…</div>
      ) : root.length === 0 ? (
        <div className="px-2 py-3 text-[12px] text-text-faint">
          No files. Use “New diagram” to create one.
        </div>
      ) : (
        root.map((c) => (
          <TreeNode
            key={c.path}
            entry={c}
            depth={0}
            repo={repo}
            onOpen={onOpen}
            onNewFile={onNewFile}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}

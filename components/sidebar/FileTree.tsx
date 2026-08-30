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
  // Subscribing to the boolean re-runs the fetch whenever a mutation
  // (create/rename/delete) invalidates the root directory.
  const rootLoaded = !!loadedDirs[""];

  useEffect(() => {
    if (rootLoaded) return;
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
  }, [repo.owner, repo.repo, repo.branch, rootLoaded, setDir]);

  const root = loadedDirs[""] ? dirCache[""] : undefined;

  return (
    <div className="scroll-thin flex-1 overflow-y-auto px-2 py-2" role="tree">
      {root === undefined ? (
        <div className="px-3 py-4 text-[13px] text-[#868686]">Loading...</div>
      ) : root.length === 0 ? (
        <div className="px-3 py-4 text-[13px] text-[#868686]">
          No files yet. Click + to create one.
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

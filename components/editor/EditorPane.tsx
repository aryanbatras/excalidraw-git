"use client";

import { useCallback, useEffect, useRef } from "react";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ExcalidrawStage } from "./ExcalidrawWrapper";
import { useStore } from "@/lib/store";
import { saveScene } from "@/lib/idb";
import { sceneToBase64 } from "@/lib/excalidraw-serialize";
import type { RepoRef, Scene } from "@/lib/types";

export function EditorPane({
  repo,
  path,
  initialScene,
  initialSha,
  registerSave,
  onApiReady,
}: {
  repo: RepoRef;
  path: string;
  initialScene: Scene;
  initialSha: string;
  registerSave: (fn: (() => void) | null) => void;
  onApiReady?: (api: ExcalidrawImperativeAPI | null) => void;
}) {
  const cacheScene = useStore((s) => s.cacheScene);
  const markDirty = useStore((s) => s.markDirty);
  const setStatus = useStore((s) => s.setStatus);
  const getCached = useStore((s) => s.getCached);
  const setHead = useStore((s) => s.setHead);

  const latest = useRef<{ scene: Scene; sha: string }>({ scene: initialScene, sha: initialSha });
  const debounce = useRef<number | null>(null);
  // True when there are edits not yet written to the store cache / IndexedDB.
  const pendingEdit = useRef(false);

  const flushEdit = useCallback(
    (persist: boolean) => {
      const scene = latest.current.scene;
      const key = `${repo.owner}/${repo.repo}/${path}`;
      if (persist) {
        cacheScene(path, scene, latest.current.sha);
        void saveScene(key, scene, latest.current.sha);
      }
      pendingEdit.current = false;
      if (debounce.current) {
        window.clearTimeout(debounce.current);
        debounce.current = null;
      }
      markDirty(path, true);
    },
    [repo, path, cacheScene, markDirty],
  );

  const handleChange = useCallback(
    (elements: unknown, appState: unknown, files: unknown) => {
      const json = serializeAsJSON(elements as never, appState as never, files as never, "local");
      const scene = JSON.parse(json) as Scene;
      latest.current = { scene, sha: latest.current.sha };
      pendingEdit.current = true;
      if (debounce.current) window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => {
        debounce.current = null;
        flushEdit(true);
      }, 800);
    },
    [flushEdit],
  );

  const saveCurrent = useCallback(async () => {
    const scene = latest.current.scene ?? getCached(path)?.scene;
    if (!scene) return;

    // Conflict check: abort if the branch head moved since we loaded the file.
    try {
      const headRes = await fetch(
        `/api/head?owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`,
      );
      if (headRes.ok) {
        const { sha: headSha } = (await headRes.json()) as { sha: string };
        const baseHead = useStore.getState().headSha[`${repo.owner}/${repo.repo}`];
        if (headSha && baseHead && headSha !== baseHead) {
          setStatus("error", "Remote changed — reload the file to continue");
          return;
        }
      }
    } catch {
      // head check is best-effort; proceed if it fails
    }

    const b64 = sceneToBase64(scene);
    setStatus("saving");
    try {
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
      const res = await fetch(`/api/commit?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [{ path, content: b64 }], message: `update ${path}` }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `commit failed (${res.status})`);
      }
      const data = (await res.json()) as { commitSha: string };
      latest.current = { scene, sha: data.commitSha };
      pendingEdit.current = false;
      cacheScene(path, scene, data.commitSha);
      void saveScene(`${repo.owner}/${repo.repo}/${path}`, scene, data.commitSha);
      markDirty(path, false);
      setHead(`${repo.owner}/${repo.repo}`, data.commitSha);
      setStatus("saved", "All changes saved");
    } catch (e) {
      setStatus("error", (e as Error).message);
    }
  }, [repo, path, getCached, cacheScene, markDirty, setStatus, setHead]);

  useEffect(() => {
    registerSave(() => void saveCurrent());
    return () => registerSave(null);
  }, [registerSave, saveCurrent]);

  // manual save shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveCurrent]);

  // Unmount (file-switch): flush any edit still inside the debounce window so
  // nothing is lost and the global auto-save can pick this file up immediately.
  useEffect(() => {
    return () => {
      if (pendingEdit.current) flushEdit(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // crash-safe flush on tab hide/close
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        const hasUncommitted = useStore.getState().dirty[path] || pendingEdit.current;
        if (pendingEdit.current) flushEdit(true);
        if (hasUncommitted) void saveCurrent();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [repo, path, getCached, saveCurrent, flushEdit]);

  return (
    <ExcalidrawStage
      initialData={initialScene as unknown as Record<string, unknown>}
      path={path}
      onChange={handleChange}
      onApiReady={onApiReady}
    />
  );
}

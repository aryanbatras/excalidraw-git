"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useStore } from "@/lib/store";
import { RepoPicker } from "@/components/RepoPicker";
import { FileTree } from "@/components/sidebar/FileTree";
import { FloatingToolbar } from "@/components/FloatingToolbar";
import { Modal, Button } from "@/components/ui";
import type { Scene, TreeEntry } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";
import { GithubLogo } from "@phosphor-icons/react";
import type { GalleryTemplate } from "@/lib/templates/gallery";
import { sceneToBase64 } from "@/lib/excalidraw-serialize";
import { loadScene, saveScene, clearScene } from "@/lib/idb";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { FileViewer } from "@/components/viewer/FileViewer";
import { classifyFile } from "@/lib/fileTypes";
import { AiChatPopup } from "@/components/ai-chat/AiChatPopup";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { withRepoLock, repoKey } from "@/lib/commit-lock";

// Editor must never load on the server (Excalidraw touches window at import).
const EditorPane = dynamic(
  () => import("@/components/editor/EditorPane").then((m) => m.EditorPane),
  { ssr: false, loading: () => <div className="grid h-full place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#6965db]" /></div> },
);

export function AppShell() {
  const { data: session } = useSession();
  const repo = useStore((s) => s.repo);
  const clearRepo = useStore((s) => s.clearRepo);
  const selectedPath = useStore((s) => s.selectedPath);
  const setSelectedPath = useStore((s) => s.setSelectedPath);
  const cacheScene = useStore((s) => s.cacheScene);
  const getCachedLocal = useStore((s) => s.getCached);
  const invalidateDir = useStore((s) => s.invalidateDir);
  const setHead = useStore((s) => s.setHead);
  const markDirty = useStore((s) => s.markDirty);
  const setStatus = useStore((s) => s.setStatus);
  const setLogin = useStore((s) => s.setLogin);
  const dirty = useStore((s) => s.dirty);
  const setSource = useStore((s) => s.setSource);

  const [current, setCurrent] = useState<{ path: string; scene: Scene; sha: string } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  // Section 3: Instant file-switch feedback — track which file we're switching to
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  // Monotonic token: only the most recent openFile() request may write current state.
  const loadSeq = useRef(0);
  const saveRef = useRef<((() => void | Promise<void>) | null)>(null);
  // Live Excalidraw imperative API — needed to push template-append changes onto the canvas.
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const onApiReady = useCallback((api: ExcalidrawImperativeAPI | null) => {
    excalidrawRef.current = api;
    setExcalidrawApi(api);
  }, []);
  const registerSave = useCallback((fn: ((() => void | Promise<void>) | null)) => {
    saveRef.current = fn;
  }, []);

  // modals
  const [newState, setNewState] = useState<{ dir: string; template: TemplateId } | null>(null);
  const [newName, setNewName] = useState("");
  const [renameEntry, setRenameEntry] = useState<TreeEntry | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteEntry, setDeleteEntry] = useState<TreeEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  // ── Share flow ──
  // Save-first prompt: shown before creating a share link when there are unsaved changes.
  const [shareSavePrompt, setShareSavePrompt] = useState(false);
  const shareSaveResolve = useRef<((proceed: boolean) => void) | null>(null);
  const savingForShare = useRef(false);

  // ── Save As flow (share-sourced / un-owned docs) ──
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState("");
  const [saveAsBusy, setSaveAsBusy] = useState(false);
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  type ShareRef = { owner: string; repo: string; branch: string; path: string };
  const [pendingShare, setPendingShare] = useState<ShareRef | null>(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search).get("fromShare");
    if (!q) return null;
    const seg = q.split("/").map(decodeURIComponent);
    const [owner, repo, branch, ...rest] = seg;
    if (!owner || !repo || !branch || rest.length === 0) return null;
    return { owner, repo, branch, path: rest.join("/") };
  });

  // Left sidebar overlay — slides from left edge, floats over canvas
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global auto-save: commits all dirty files at the configured interval
  const autoSaveEnabled = useStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useStore((s) => s.autoSaveIntervalSeconds);
  useEffect(() => {
    if (!autoSaveEnabled || !repo) return;
    // Auto-save is paused for share-sourced (un-owned) docs: there is no repo to
    // commit to yet, and saving must go through the explicit Save As flow.
    if (useStore.getState().source.kind !== "repo") return;
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      const state = useStore.getState();
      for (const [path, isDirty] of Object.entries(state.dirty)) {
        if (!isDirty || cancelled) continue;
        const cached = state.sceneCache[path];
        if (!cached) continue;
        if (path === state.selectedPath) {
          saveRef.current?.();
          continue;
        }
        // Background commit for non-active files
        try {
          const controller = new AbortController();
          const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
          const res = await withRepoLock(repoKey(repo.owner, repo.repo), async () => {
            return fetch(`/api/commit?${qs}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files: [{ path, content: sceneToBase64(cached.scene) }],
                message: `auto-save: ${path}`,
              }),
              signal: controller.signal,
            });
          });
          if (res.ok) {
            const { commitSha } = await res.json() as { commitSha: string };
            state.markDirty(path, false);
            state.cacheScene(path, cached.scene, commitSha);
            state.setHead(`${repo.owner}/${repo.repo}`, commitSha);
          } else {
            state.markDirty(path, true);
          }
        } catch { /* best-effort */ }
      }
    }, autoSaveInterval * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [autoSaveEnabled, autoSaveInterval, repo]);

  useEffect(() => {
    if (session?.user?.login) setLogin(session.user.login);
  }, [session, setLogin]);

  const openFile = useCallback(
    async (path: string) => {
      if (!repo) return;
      const seq = ++loadSeq.current;

      // Section 3: Instant file-switch feedback
      // Set switchingTo immediately (before any await) so the header + overlay update instantly.
      setSwitchingTo(path);
      setLoadingFile(true);

      // A different file is about to replace the editor; drop the old canvas
      // API immediately (Excalidraw never fires excalidrawAPI(null) on unmount).
      // For the same path the editor does NOT remount, so keep the current API.
      if (useStore.getState().selectedPath !== path) excalidrawRef.current = null;
      setSelectedPath(path);
      try {
        // In-session switch: store cache already holds local edits → instant.
        const cached = getCachedLocal(path);
        if (cached?.scene) {
          if (seq === loadSeq.current) {
            setCurrent({ path, scene: cached.scene, sha: cached.sha });
            setSwitchingTo(null);
          }
          return;
        }
        const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(path)}`;
        const res = await fetch(`/api/file?${qs}`);
        if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);

        // Check if this is a non-excalidraw file — if so, we don't need to parse as scene
        const kind = classifyFile(path);
        if (kind !== "excalidraw") {
          // Non-excalidraw file — just mark as loaded, FileViewer handles the rest
          if (seq === loadSeq.current) {
            setCurrent(null); // No scene to display — FileViewer takes over
            setSwitchingTo(null);
          }
          return;
        }

        const data = (await res.json()) as { scene: Scene; sha: string };
        if (seq !== loadSeq.current) return; // a newer open superseded this one
        const key = `${repo.owner}/${repo.repo}/${path}`;
        // Boot recovery: prefer a divergent IndexedDB mirror (unsaved local work).
        // The local version is always kept — reverting to a remote snapshot remains
        // possible via Git history, so no "reload from GitHub" UI is needed.
        const idbRec = await loadScene(key);
        const sceneToUse =
          idbRec?.scene && JSON.stringify(idbRec.scene) !== JSON.stringify(data.scene)
            ? idbRec.scene
            : data.scene;
        if (seq !== loadSeq.current) return;
        setCurrent({ path, scene: sceneToUse, sha: data.sha });
        setSwitchingTo(null);
        cacheScene(path, sceneToUse, data.sha);
        // record the branch head commit sha at load time (for conflict checks)
        try {
          const hRes = await fetch(
            `/api/head?owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`,
          );
          if (hRes.ok) {
            const { sha: hSha } = (await hRes.json()) as { sha: string };
            if (hSha) setHead(`${repo.owner}/${repo.repo}`, hSha);
          }
        } catch {
          /* best-effort */
        }
      } catch (e) {
        if (seq === loadSeq.current) {
          setStatus("error", (e as Error).message);
          setSwitchingTo(null);
        }
      } finally {
        if (seq === loadSeq.current) {
          setLoadingFile(false);
          setSwitchingTo(null);
        }
      }
    },
    [repo, setSelectedPath, cacheScene, getCachedLocal, setStatus, setHead],
  );

  // open persisted selection on mount
  useEffect(() => {
    if (pendingShare) return; // a shared-doc load is in progress
    if (repo && selectedPath && (!current || current.path !== selectedPath)) {
      // Intended orchestration: restore the persisted selection exactly once;
      // openFile performs async I/O and its sync prefix sets the loading state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void openFile(selectedPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, selectedPath]);

  async function createFile(dir: string, template: TemplateId) {
    if (!repo || creating) return;
    const name = newName.trim();
    if (!name) return;
    const safe = name.endsWith(".excalidraw") ? name : `${name}.excalidraw`;
    const path = dir ? `${dir}/${safe}` : safe;
    setCreating(true);
    try {
      const { buildTemplate } = await import("@/lib/templates");
      const scene = buildTemplate(template);
      const b64 = sceneToBase64(scene);
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
      const res = await fetch(`/api/file?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content: b64 }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      invalidateDir(dir);
      setNewState(null);
      setNewName("");
      void clearScene(`${repo.owner}/${repo.repo}/${path}`);
      await openFile(path);
    } catch (e) {
      setStatus("error", (e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function doRename() {
    if (!repo || !renameEntry || renaming) return;
    const dir = renameEntry.path.includes("/")
      ? renameEntry.path.slice(0, renameEntry.path.lastIndexOf("/"))
      : "";
    const name = renameName.trim().endsWith(".excalidraw")
      ? renameName.trim()
      : `${renameName.trim()}.excalidraw`;
    const to = dir ? `${dir}/${name}` : name;
    const from = renameEntry.path;
    setRenaming(true);
    try {
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
      const res = await fetch(`/api/file?${qs}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, oldBlobSha: renameEntry.sha }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      invalidateDir(dir || "");
      if (selectedPath === from) {
        setSelectedPath(to);
        setCurrent((c) => (c && c.path === from ? { ...c, path: to } : c));
      }
      setRenameEntry(null);
    } catch (e) {
      setStatus("error", (e as Error).message);
    } finally {
      setRenaming(false);
    }
  }

  async function doDelete() {
    if (!repo || !deleteEntry || deleting) return;
    const dir = deleteEntry.path.includes("/")
      ? deleteEntry.path.slice(0, deleteEntry.path.lastIndexOf("/"))
      : "";
    setDeleting(true);
    try {
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(deleteEntry.path)}`;
      const res = await fetch(`/api/file?${qs}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      void clearScene(`${repo.owner}/${repo.repo}/${deleteEntry.path}`);
      invalidateDir(dir || "");
      if (selectedPath === deleteEntry.path) {
        setSelectedPath(null);
        setCurrent(null);
        markDirty(deleteEntry.path, false);
      }
      setDeleteEntry(null);
    } catch (e) {
      setStatus("error", (e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  // Section 6: Non-destructive history restore
  // Restores to the SAME file (no "-restored" copy) and appends a new history entry.
  async function restoreVersion(sha: string) {
    if (!repo || !selectedPath) return;
    try {
      // 1. Fetch the checkpoint scene
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(selectedPath)}&ref=${sha}`;
      const res = await fetch(`/api/file?${qs}`);
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const data = (await res.json()) as { scene: Scene };

      // 2. Get checkpoint position for the commit message
      // (N = position in history list, newest = 1)
      let checkpointNum = "?";
      try {
        const historyRes = await fetch(
          `/api/history?owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(selectedPath)}`,
        );
        if (historyRes.ok) {
          const historyData = (await historyRes.json()) as { commits: Array<{ sha: string }> };
          const idx = historyData.commits.findIndex((c) => c.sha === sha);
          checkpointNum = idx >= 0 ? String(idx + 1) : "?";
        }
      } catch { /* best-effort */ }

      // 3. Commit restored scene to the SAME path (not a new "-restored" file)
      const b64 = sceneToBase64(data.scene);
      const cRes = await fetch(`/api/commit?owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ path: selectedPath, content: b64 }],
          message: `Restore checkpoint #${checkpointNum}`,
        }),
      });
      if (!cRes.ok) throw new Error((await cRes.text()) || `Failed (${cRes.status})`);
      const { commitSha } = (await cRes.json()) as { commitSha: string };

      // 4. Reload the file into the editor
      cacheScene(selectedPath, data.scene, commitSha);
      setCurrent({ path: selectedPath, scene: data.scene, sha: commitSha });
      markDirty(selectedPath, false);
      setStatus("saved", `Restored checkpoint #${checkpointNum}`);
    } catch (e) {
      setStatus("error", (e as Error).message);
    }
  }

  // Create a brand-new file directly from a template (no modal — the gallery is the create UI).
  async function createFromTemplate(template: GalleryTemplate) {
    if (!repo) return;
    const res = await fetch(template.file);
    if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
    const tplScene = (await res.json()) as Scene;
    const safe = (template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "template");
    const dir = selectedPath && selectedPath.includes("/")
      ? selectedPath.slice(0, selectedPath.lastIndexOf("/"))
      : "";
    const existing = new Set((useStore.getState().dirCache[dir] ?? []).map((e) => e.name));
    let base = safe;
    let n = 1;
    while (existing.has(`${base}.excalidraw`)) {
      n += 1;
      base = `${safe}-${n}`;
    }
    const path = dir ? `${dir}/${base}.excalidraw` : `${base}.excalidraw`;
    const b64 = sceneToBase64(tplScene);
    const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
    const cRes = await fetch(`/api/file?${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content: b64 }),
    });
    if (!cRes.ok) throw new Error((await cRes.text()) || `Failed (${cRes.status})`);
    invalidateDir(dir);
    void clearScene(`${repo.owner}/${repo.repo}/${path}`);
    await openFile(path);
    setStatus("saved", `Created "${template.name}"`);
  }

  async function handleTemplateSelect(template: GalleryTemplate, mode: "append" | "new") {
    if (!repo) return;
    if (mode === "new") {
      try {
        await createFromTemplate(template);
      } catch (e) {
        setStatus("error", (e as Error).message);
      }
      return;
    }
    // Append mode: merge template elements into the LIVE canvas.
    if (!current) {
      setStatus("error", "Open a file first to append template elements.");
      return;
    }
    const api = excalidrawRef.current;
    if (!api) {
      setStatus("error", "Editor is still loading — try again in a moment.");
      return;
    }
    try {
      const res = await fetch(template.file);
      if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
      const tplScene = (await res.json()) as Scene;
      // Use the canvas's current elements, not the mount-time snapshot, so any
      // unsaved edits before the append are preserved.
      const live = (api.getSceneElements?.() ?? current.scene.elements ?? []) as unknown[];
      const { appendTemplateToScene } = await import("@/components/templates/appendTemplate");
      const merged = appendTemplateToScene(live, tplScene.elements ?? []);
      if (merged.length === 0) {
        setStatus("error", "Template contains no drawable elements.");
        return;
      }
      // 1. Push the merged elements into the live canvas.
      api.updateScene({ elements: merged as never });
      // 2. Keep every mirror in sync: React state, store cache, IndexedDB.
      const mergedScene: Scene = { ...current.scene, elements: merged };
      setCurrent({ ...current, scene: mergedScene });
      cacheScene(current.path, mergedScene, current.sha);
      void saveScene(`${repo.owner}/${repo.repo}/${current.path}`, mergedScene, current.sha);
      // 3. Mark dirty so save/Cmd+S/auto-save pick up the appended content.
      markDirty(current.path, true);
      setStatus("saved", `Appended "${template.name}" to canvas`);
    } catch (e) {
      setStatus("error", (e as Error).message);
    }
  }

  // hasUnsavedChanges: true when any file is dirty (regardless of auto-save mode)
  const hasUnsavedChanges = useMemo(() => Object.values(dirty).some(Boolean), [dirty]);

  // ── Share flow ────────────────────────────────────────────────────────────
  // Open a document received via a shared link (?fromShare=owner/repo/branch/path).
  // The scene is fetched through the unauthenticated /api/share route and opened
  // as an un-owned (share-sourced) document: editing is allowed locally, but
  // saving always goes through "Save As" so the origin repo is never overwritten.
  const openFromShare = useCallback(
    async (ref: { owner: string; repo: string; branch: string; path: string }) => {
      const qs = `owner=${encodeURIComponent(ref.owner)}&repo=${encodeURIComponent(ref.repo)}&branch=${encodeURIComponent(ref.branch)}&path=${encodeURIComponent(ref.path)}`;
      const res = await fetch(`/api/share?${qs}`);
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || `Failed (${res.status})`);
      }
      const { scene } = (await res.json()) as { scene: Scene };
      const base = ref.path.split("/").pop() ?? "diagram";
      const name = base.replace(/\.excalidraw$/i, "") || "diagram";
      // Placeholder path under the current repo's dir; replaced by Save As.
      const dir = selectedPath && selectedPath.includes("/")
        ? selectedPath.slice(0, selectedPath.lastIndexOf("/"))
        : "";
      const localPath = `${dir ? dir + "/" : ""}${name}-copy.excalidraw`;
      setSource({ kind: "share", originOwner: ref.owner, originRepo: ref.repo });
      cacheScene(localPath, scene, "");
      setCurrent({ path: localPath, scene, sha: "" });
      setSelectedPath(localPath);
      markDirty(localPath, true);
      setStatus("saved", `Opened "${name}" from a shared link — save to your repo`);
    },
    [selectedPath, setSource, cacheScene, setSelectedPath, markDirty, setStatus],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("fromShare");
    if (!q) return;
    // Clear the query param so a refresh doesn't re-trigger the share load.
    const url = new URL(window.location.href);
    url.searchParams.delete("fromShare");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Once a repo is available, if a shared doc was queued (from a visitor who
  // had not yet picked a repo), load it into the editor.
  useEffect(() => {
    if (!repo || !pendingShare) return;
    const ref = pendingShare;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void openFromShare(ref)
      .catch((e) => setStatus("error", (e as Error).message))
      .finally(() => {
        if (!cancelled) setPendingShare(null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const confirmSaveBeforeShare = useCallback(async () => {
    setShareSavePrompt(false);
    if (!shareSaveResolve.current) return;
    const resolve = shareSaveResolve.current;
    shareSaveResolve.current = null;
    savingForShare.current = true;
    try {
      await saveRef.current?.();
    } finally {
      savingForShare.current = false;
    }
    resolve(true);
  }, []);

  const cancelSaveBeforeShare = useCallback(() => {
    setShareSavePrompt(false);
    shareSaveResolve.current?.(false);
    shareSaveResolve.current = null;
  }, []);

  const handleShare = useCallback(async (): Promise<{ url?: string; error?: string } | null> => {
    if (!repo || !selectedPath) return { error: "Open a file to share it." };

    if (savingForShare.current) return null;
    if (Object.values(useStore.getState().dirty).some(Boolean)) {
      const proceed = await new Promise<boolean>((resolve) => {
        shareSaveResolve.current = resolve;
        setShareSavePrompt(true);
      });
      if (!proceed) return null;
    }

    // Refuse to share private repos.
    try {
      const res = await fetch(`/api/visibility?owner=${repo.owner}&repo=${repo.repo}`);
      const vis = (await res.json()) as { private?: boolean; error?: string };
      if (vis?.private) {
        return { error: "This repo is private. Make it public on GitHub to share this diagram." };
      }
    } catch {
      return { error: "Could not check the repo's visibility. Try again." };
    }

    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
    const url = `${origin}/share/${repo.owner}/${repo.repo}/${repo.branch}/${selectedPath.split("/").map(encodeURIComponent).join("/")}`;
    return { url };
  }, [repo, selectedPath]);

  // ── Save As flow (share-sourced / un-owned docs) ─────────────────────────
  const startSaveAs = useCallback(() => {
    const base = (current?.path ?? selectedPath ?? "diagram").split("/").pop() ?? "diagram";
    setSaveAsPath(base.replace(/\.excalidraw$/i, ""));
    setSaveAsError(null);
    setSaveAsOpen(true);
  }, [current, selectedPath]);

  const confirmSaveAs = useCallback(async () => {
    if (!repo || saveAsBusy) return;
    const name = saveAsPath.trim().endsWith(".excalidraw") ? saveAsPath.trim() : `${saveAsPath.trim()}.excalidraw`;
    if (!name || name === ".excalidraw") {
      setSaveAsError("Enter a file name.");
      return;
    }
    const dir = selectedPath && selectedPath.includes("/")
      ? selectedPath.slice(0, selectedPath.lastIndexOf("/"))
      : "";
    const targetPath = dir ? `${dir}/${name}` : name;

    const scene = current?.scene ?? useStore.getState().sceneCache[selectedPath ?? ""]?.scene;
    if (!scene) {
      setSaveAsError("No diagram to save.");
      return;
    }

    setSaveAsBusy(true);
    setSaveAsError(null);
    try {
      const b64 = sceneToBase64(scene);
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
      const res = await fetch(`/api/file?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: targetPath, content: b64 }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const { commitSha } = (await res.json()) as { commitSha: string };

      cacheScene(targetPath, scene, commitSha);
      setCurrent({ path: targetPath, scene, sha: commitSha });
      setSelectedPath(targetPath);
      markDirty(targetPath, false);
      // The document is now owned by the current repo — resume normal saving.
      setSource({ kind: "repo" });
      setHead(`${repo.owner}/${repo.repo}`, commitSha);
      setSaveAsOpen(false);
      setStatus("saved", `Saved to ${repo.owner}/${repo.repo}/${targetPath}`);
    } catch (e) {
      setSaveAsError((e as Error).message);
    } finally {
      setSaveAsBusy(false);
    }
  }, [repo, saveAsBusy, saveAsPath, selectedPath, current, cacheScene, setSelectedPath, markDirty, setSource, setHead, setStatus]);

  // Save action: share-sourced (un-owned) docs route through "Save As" so the
  // user explicitly chooses the target repo/path; owned files save normally.
  const handleSaveAction = useCallback(() => {
    if (useStore.getState().source.kind === "share") {
      startSaveAs();
      return;
    }
    void saveRef.current?.();
  }, [startSaveAs]);


  if (!repo) return <RepoPicker />;

  const selectedKind = selectedPath ? classifyFile(selectedPath) : null;
  const isExcalidrawFile = selectedKind === "excalidraw";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white">
      {/* ── Canvas (fullscreen) ── */}
      <div className="absolute inset-0 z-0">
        {switchingTo && (
          <div className="absolute inset-0 z-40 grid place-items-center bg-white/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/90 px-6 py-4 shadow-[0_4px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#6965db]" />
              <span className="text-[13px] text-[#868686]">Opening {switchingTo.split("/").pop()}...</span>
            </div>
          </div>
        )}

        {selectedPath && !isExcalidrawFile && !switchingTo ? (
          <FileViewer
            repo={repo}
            path={selectedPath}
            onBack={() => {
              setSelectedPath(null);
              setCurrent(null);
            }}
          />
        ) : current ? (
          <ErrorBoundary>
            <EditorPane
              key={current.path}
              repo={repo}
              path={current.path}
              initialScene={current.scene}
              initialSha={current.sha}
              registerSave={registerSave}
              onApiReady={onApiReady}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />
          </ErrorBoundary>
        ) : loadingFile || switchingTo ? (
          <div className="grid h-full place-items-center text-[13px] text-[#868686]">Opening...</div>
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <p className="text-[14px] font-medium text-[#1b1b1f]">No diagram open</p>
              <p className="mt-1 text-[13px] text-[#868686]">
                Pick a file from the sidebar or click + to start.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Floating toolbar (top center) ── */}
      <FloatingToolbar
        repo={repo}
        selectedPath={selectedPath}
        switchingTo={switchingTo}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onSave={handleSaveAction}
        onNew={(id) => {
          setNewName(id === "blank" ? "untitled" : id);
          const dir = selectedPath && selectedPath.includes("/")
            ? selectedPath.slice(0, selectedPath.lastIndexOf("/"))
            : "";
          setNewState({ dir, template: id });
        }}
        onTemplates={() => setGalleryOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onChangeRepo={() => clearRepo()}
        onRestore={restoreVersion}
        onAi={() => setAiChatOpen(true)}
        onShare={handleShare}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* ── Sidebar overlay (glass panel, slides from left) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
          <div
            className="absolute left-0 top-0 bottom-0 z-10 w-[280px] border-r border-black/8 bg-white/90 shadow-[4px_0_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-transform duration-200 ease-out"
            style={{ transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
              <span className="text-[13px] font-semibold text-[#1b1b1f]">
                Explorer
              </span>
              <span className="group/repo flex items-center gap-1">
                <a
                  href={`https://github.com/${repo.owner}/${repo.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${repo.owner}/${repo.repo} on GitHub`}
                  className="flex items-center gap-1 text-[12px] text-[#868686] hover:text-[#1b1b1f]"
                >
                  {repo.owner}/{repo.repo}
                  <GithubLogo
                    size={13}
                    weight="fill"
                    className="hidden text-[#868686] group-hover/repo:block"
                  />
                </a>
              </span>
            </div>
            <FileTree
              repo={repo}
              onOpen={(path) => { openFile(path); setSidebarOpen(false); }}
              onNewFile={(dir) => {
                setNewName("");
                setNewState({ dir, template: "blank" });
                setSidebarOpen(false);
              }}
              onRename={(entry) => {
                setRenameName(entry.name.replace(/\.excalidraw$/, ""));
                setRenameEntry(entry);
              }}
              onDelete={(entry) => setDeleteEntry(entry)}
            />
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {newState && (
        <Modal title={`New ${newState.template} diagram`} onClose={() => setNewState(null)}>
          <label className="mb-1 block text-[12px] text-[#868686]">File name</label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-diagram"
            className="mb-3 w-full rounded-xl border border-[#e5e5e5] bg-white/80 px-3 py-2 text-[13px] outline-none backdrop-blur-sm focus:border-[#6965db]"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setNewState(null)}>Cancel</Button>
            <Button variant="primary" loading={creating} loadingText="Creating..." onClick={() => void createFile(newState.dir, newState.template)}>
              Create
            </Button>
          </div>
        </Modal>
      )}

      {renameEntry && (
        <Modal title="Rename file" onClose={() => setRenameEntry(null)}>
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            className="mb-3 w-full rounded-xl border border-[#e5e5e5] bg-white/80 px-3 py-2 text-[13px] outline-none backdrop-blur-sm focus:border-[#6965db]"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenameEntry(null)}>Cancel</Button>
            <Button variant="primary" loading={renaming} loadingText="Renaming..." onClick={() => void doRename()}>
              Rename
            </Button>
          </div>
        </Modal>
      )}

      {deleteEntry && (
        <Modal title="Delete file?" onClose={() => setDeleteEntry(null)}>
          <p className="mb-3 text-[13px] text-[#868686]">
            <span className="font-mono text-[#1b1b1f]">{deleteEntry.path}</span> will be removed in a Git commit.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleteEntry(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} loadingText="Deleting..." onClick={() => void doDelete()}>
              Delete
            </Button>
          </div>
        </Modal>
      )}

      {galleryOpen && (
        <TemplateGallery
          onClose={() => setGalleryOpen(false)}
          onSelect={handleTemplateSelect}
          canAppend={!!current}
        />
      )}

      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}

      {/* Save before sharing? */}
      {shareSavePrompt && (
        <Modal title="Save before sharing?" onClose={cancelSaveBeforeShare}>
          <p className="mb-4 text-[13px] leading-relaxed text-[#868686]">
            You have unsaved changes. Save to GitHub before creating the shared link?
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={cancelSaveBeforeShare}>Cancel</Button>
            <Button variant="primary" onClick={() => void confirmSaveBeforeShare()}>
              Save &amp; Share
            </Button>
          </div>
        </Modal>
      )}

      {/* Save As (un-owned / share-sourced document) */}
      {saveAsOpen && (
        <Modal title="Save to your repo" onClose={() => setSaveAsOpen(false)}>
          <p className="mb-3 text-[13px] leading-relaxed text-[#868686]">
            This diagram came from a shared link. Choose where to save your copy in{" "}
            <span className="font-medium text-[#1b1b1f]">{repo ? `${repo.owner}/${repo.repo}` : "your repo"}</span>.
          </p>
          <label className="mb-1 block text-[12px] text-[#868686]">File name</label>
          <input
            autoFocus
            value={saveAsPath}
            onChange={(e) => setSaveAsPath(e.target.value)}
            placeholder="my-diagram"
            className="mb-3 w-full rounded-xl border border-[#e5e5e5] bg-white/80 px-3 py-2 text-[13px] outline-none backdrop-blur-sm focus:border-[#6965db]"
          />
          {saveAsError && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{saveAsError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setSaveAsOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saveAsBusy} loadingText="Saving..." onClick={() => void confirmSaveAs()}>
              Save copy
            </Button>
          </div>
        </Modal>
      )}

      <AiChatPopup
        open={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
        excalidrawApi={excalidrawApi}
      />
    </div>
  );
}

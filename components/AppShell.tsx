"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useStore } from "@/lib/store";
import { RepoPicker } from "@/components/RepoPicker";
import { FileTree } from "@/components/sidebar/FileTree";
import { TopBar } from "@/components/topbar/TopBar";
import { Modal, Button } from "@/components/ui";
import type { Scene, TreeEntry } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";
import type { GalleryTemplate } from "@/lib/templates/gallery";
import { sceneToBase64 } from "@/lib/excalidraw-serialize";
import { loadScene, saveScene, clearScene } from "@/lib/idb";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { appendTemplateToScene } from "@/components/templates/appendTemplate";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

// Editor must never load on the server (Excalidraw touches window at import).
const EditorPane = dynamic(
  () => import("@/components/editor/EditorPane").then((m) => m.EditorPane),
  { ssr: false, loading: () => <div className="grid h-full place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" /></div> },
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

  const [current, setCurrent] = useState<{ path: string; scene: Scene; sha: string } | null>(null);
  const [recovered, setRecovered] = useState<{ path: string; remote: Scene } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const saveRef = useRef<(() => void) | null>(null);
  const registerSave = useCallback((fn: (() => void) | null) => {
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

  // Global auto-save: commits all dirty files at the configured interval
  const autoSaveEnabled = useStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useStore((s) => s.autoSaveIntervalSeconds);
  useEffect(() => {
    if (!autoSaveEnabled || !repo) return;
    const id = setInterval(async () => {
      const state = useStore.getState();
      for (const [path, isDirty] of Object.entries(state.dirty)) {
        if (!isDirty) continue;
        const cached = state.sceneCache[path];
        if (!cached) continue;
        if (path === current?.path) {
          saveRef.current?.();
          continue;
        }
        // Background commit for non-active files
        try {
          const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`;
          const res = await fetch(`/api/commit?${qs}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, content: btoa(JSON.stringify(cached.scene)), expectedBaseSha: cached.sha }),
          });
          if (res.ok) {
            const { commitSha } = await res.json() as { commitSha: string };
            state.markDirty(path, false);
            state.cacheScene(path, cached.scene, commitSha);
            state.setHead(`${repo.owner}/${repo.repo}`, commitSha);
          }
        } catch { /* best-effort */ }
      }
    }, autoSaveInterval * 1000);
    return () => clearInterval(id);
  }, [autoSaveEnabled, autoSaveInterval, repo, current?.path]);

  useEffect(() => {
    if (session?.user?.login) setLogin(session.user.login);
  }, [session, setLogin]);

  const openFile = useCallback(
    async (path: string) => {
      if (!repo) return;
      setLoadingFile(true);
      setSelectedPath(path);
      setRecovered(null);
      try {
        // In-session switch: store cache already holds local edits → instant.
        const cached = getCachedLocal(path);
        if (cached?.scene) {
          setCurrent({ path, scene: cached.scene, sha: cached.sha });
          return;
        }
        const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(path)}`;
        const res = await fetch(`/api/file?${qs}`);
        if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
        const data = (await res.json()) as { scene: Scene; sha: string };
        const key = `${repo.owner}/${repo.repo}/${path}`;
        // Boot recovery: prefer a divergent IndexedDB mirror (unsaved local work).
        const idbRec = await loadScene(key);
        let sceneToUse = data.scene;
        if (idbRec?.scene && JSON.stringify(idbRec.scene) !== JSON.stringify(data.scene)) {
          sceneToUse = idbRec.scene;
          setRecovered({ path, remote: data.scene });
        }
        setCurrent({ path, scene: sceneToUse, sha: data.sha });
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
        setStatus("error", (e as Error).message);
      } finally {
        setLoadingFile(false);
      }
    },
    [repo, setSelectedPath, cacheScene, getCachedLocal, setStatus],
  );

  // open persisted selection on mount
  useEffect(() => {
    if (repo && selectedPath && (!current || current.path !== selectedPath)) {
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

  async function restoreVersion(sha: string) {
    if (!repo || !selectedPath) return;
    try {
      const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(selectedPath)}&ref=${sha}`;
      const res = await fetch(`/api/file?${qs}`);
      if (!res.ok) throw new Error((await res.text()) || `Failed (${res.status})`);
      const data = (await res.json()) as { scene: Scene };
      const dot = selectedPath.lastIndexOf(".excalidraw");
      const restoredPath =
        (dot >= 0 ? selectedPath.slice(0, dot) : selectedPath) + "-restored.excalidraw";
      const b64 = sceneToBase64(data.scene);
      const cRes = await fetch(`/api/file?owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: restoredPath, content: b64 }),
      });
      if (!cRes.ok) throw new Error((await cRes.text()) || `Failed (${res.status})`);
      const dir = restoredPath.includes("/")
        ? restoredPath.slice(0, restoredPath.lastIndexOf("/"))
        : "";
      invalidateDir(dir);
      await openFile(restoredPath);
      setStatus("saved", "Restored version opened");
    } catch (e) {
      setStatus("error", (e as Error).message);
    }
  }

  async function handleTemplateSelect(template: GalleryTemplate, mode: "append" | "new") {
    if (!repo) return;
    if (mode === "new") {
      // Open new-file modal pre-filled with template name
      const safe = template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      setNewName(safe);
      const dir = selectedPath && selectedPath.includes("/")
        ? selectedPath.slice(0, selectedPath.lastIndexOf("/"))
        : "";
      setNewState({ dir, template: "blank" as TemplateId });
      // Fetch template file and write it as a new file
      try {
        const res = await fetch(template.file);
        const tplScene = (await res.json()) as Scene;
        const path = dir ? `${dir}/${safe}.excalidraw` : `${safe}.excalidraw`;
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
      } catch (e) {
        setStatus("error", (e as Error).message);
      }
      return;
    }
    // Append mode: merge template elements into current scene
    if (!current) {
      setStatus("error", "Open a file first to append template elements.");
      return;
    }
    try {
      const res = await fetch(template.file);
      const tplScene = (await res.json()) as { elements: any[] };
      const merged = appendTemplateToScene(current.scene.elements ?? [], tplScene.elements ?? []);
      const updatedScene: Scene = { ...current.scene, elements: merged };
      setCurrent({ ...current, scene: updatedScene });
      cacheScene(current.path, updatedScene, current.sha);
      setStatus("saved", `Appended "${template.name}" to canvas`);
    } catch (e) {
      setStatus("error", (e as Error).message);
    }
  }

  if (!repo) return <RepoPicker />;

  return (
    <div className="flex h-[100dvh] flex-col">
      <TopBar
        repo={repo}
        selectedPath={selectedPath}
        onSave={() => saveRef.current?.()}
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
      />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-surface">
          <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
            Files
          </div>
          <FileTree
            repo={repo}
            onOpen={openFile}
            onNewFile={(dir) => {
              setNewName("");
              setNewState({ dir, template: "blank" });
            }}
            onRename={(entry) => {
              setRenameName(entry.name.replace(/\.excalidraw$/, ""));
              setRenameEntry(entry);
            }}
            onDelete={(entry) => setDeleteEntry(entry)}
          />
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col bg-white">
          {recovered && current && recovered.path === current.path && (
            <div className="flex items-center gap-3 border-b border-status-dirty/30 bg-accent-weak px-3 py-2 text-[13px] text-text">
              <span className="flex-1">
                Unsaved changes from a previous session were recovered.
              </span>
              <Button
                variant="quiet"
                onClick={() => setRecovered(null)}
              >
                Keep local
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const remote = recovered.remote;
                  setCurrent({ path: recovered.path, scene: remote, sha: current!.sha });
                  cacheScene(recovered.path, remote, current!.sha);
                  void saveScene(
                    `${repo!.owner}/${repo!.repo}/${recovered.path}`,
                    remote,
                    current!.sha,
                  );
                  setRecovered(null);
                }}
              >
                Reload from GitHub
              </Button>
            </div>
          )}
          {current ? (
            <div className="min-h-0 flex-1">
              <EditorPane
                key={current.path}
                repo={repo}
                path={current.path}
                initialScene={current.scene}
                initialSha={current.sha}
                registerSave={registerSave}
              />
            </div>
          ) : loadingFile ? (
            <div className="grid flex-1 place-items-center text-[13px] text-text-faint">Opening…</div>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <p className="text-[14px] font-medium text-text">No diagram open</p>
                <p className="mt-1 text-[13px] text-text-muted">
                  Pick a <span className="font-mono">.excalidraw</span> file from the sidebar, or click “New” to start one.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* New file modal */}
      {newState && (
        <Modal title={`New ${newState.template} diagram`} onClose={() => setNewState(null)}>
          <label className="mb-1 block text-[12px] text-text-muted">File name</label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="my-diagram"
            className="mb-3 w-full rounded-[8px] border border-border px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setNewState(null)}>Cancel</Button>
            <Button variant="primary" loading={creating} loadingText="Creating…" onClick={() => void createFile(newState.dir, newState.template)}>
              Create
            </Button>
          </div>
        </Modal>
      )}

      {/* Rename modal */}
      {renameEntry && (
        <Modal title="Rename file" onClose={() => setRenameEntry(null)}>
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            className="mb-3 w-full rounded-[8px] border border-border px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenameEntry(null)}>Cancel</Button>
            <Button variant="primary" loading={renaming} loadingText="Renaming…" onClick={() => void doRename()}>
              Rename
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteEntry && (
        <Modal title="Delete file?" onClose={() => setDeleteEntry(null)}>
          <p className="mb-3 text-[13px] text-text-muted">
            <span className="font-mono text-text">{deleteEntry.path}</span> will be removed in a Git commit (recoverable from history).
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleteEntry(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} loadingText="Deleting…" onClick={() => void doDelete()}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
      {/* Template gallery */}
      {galleryOpen && (
        <TemplateGallery
          onClose={() => setGalleryOpen(false)}
          onSelect={handleTemplateSelect}
        />
      )}

      {/* Settings */}
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

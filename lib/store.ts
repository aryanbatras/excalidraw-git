import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RepoRef, TreeEntry, Scene } from "./types";

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type State = {
  repo: RepoRef | null;
  dirCache: Record<string, TreeEntry[]>;
  loadedDirs: Record<string, boolean>;
  selectedPath: string | null;
  dirty: Record<string, boolean>;
  headSha: Record<string, string>; // key = `${owner}/${repo}`
  login: string | null;
  status: SaveStatus;
  statusMsg: string | null;

  // in-memory scene cache (path -> {scene, sha})
  sceneCache: Record<string, { scene: Scene; sha: string }>;

  setRepo: (r: RepoRef) => void;
  clearRepo: () => void;
  setDir: (path: string, entries: TreeEntry[]) => void;
  markLoaded: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  markDirty: (path: string, v: boolean) => void;
  setHead: (key: string, sha: string) => void;
  setLogin: (login: string | null) => void;
  setStatus: (s: SaveStatus, msg?: string | null) => void;
  cacheScene: (path: string, scene: Scene, sha: string) => void;
  getCached: (path: string) => { scene: Scene; sha: string } | undefined;
  invalidateDir: (path: string) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      repo: null,
      dirCache: {},
      loadedDirs: {},
      selectedPath: null,
      dirty: {},
      headSha: {},
      login: null,
      status: "idle",
      statusMsg: null,
      sceneCache: {},

      setRepo: (r) => set({ repo: r, dirCache: {}, loadedDirs: {}, selectedPath: null, dirty: {} }),
      clearRepo: () => set({ repo: null, dirCache: {}, loadedDirs: {}, selectedPath: null, dirty: {} }),
      setDir: (path, entries) =>
        set((s) => ({ dirCache: { ...s.dirCache, [path]: entries }, loadedDirs: { ...s.loadedDirs, [path]: true } })),
      markLoaded: (path) => set((s) => ({ loadedDirs: { ...s.loadedDirs, [path]: true } })),
      setSelectedPath: (path) => set({ selectedPath: path }),
      markDirty: (path, v) => set((s) => ({ dirty: { ...s.dirty, [path]: v } })),
      setHead: (key, sha) => set((s) => ({ headSha: { ...s.headSha, [key]: sha } })),
      setLogin: (login) => set({ login }),
      setStatus: (status, msg) => set({ status, statusMsg: msg ?? null }),
      cacheScene: (path, scene, sha) =>
        set((s) => ({ sceneCache: { ...s.sceneCache, [path]: { scene, sha } } })),
      getCached: (path) => get().sceneCache[path],
      invalidateDir: (path) =>
        set((s) => {
          const dirCache = { ...s.dirCache };
          const loadedDirs = { ...s.loadedDirs };
          delete dirCache[path];
          delete loadedDirs[path];
          return { dirCache, loadedDirs };
        }),
    }),
    {
      name: "exgit-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (s) => ({ repo: s.repo, login: s.login }),
    },
  ),
);

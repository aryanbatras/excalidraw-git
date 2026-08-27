# Phase 04 — Editor Embed & File Open/Switch

> **Status:** Phase 4 of 11 · **Depends on:** Phase 01 (Excalidraw scaffold, `transpilePackages`), Phase 03 (`/api/tree`, selection, `TreeEntry`).
> **Research basis:** `@excalidraw/excalidraw@0.18.1` ESM imports · `dynamic(..., { ssr:false })` + `"use client"` wrapper · `EXCALIDRAW_ASSET_PATH` for fonts · `initialData` (set once) · `excalidrawAPI` ref (not state) · `onChange(elements, appState, files)` · `serializeAsJSON(elements, appState, files, "local")` · `UIOptions.canvasActions` · `theme="light"`.

---

## 1. Purpose & scope

Embed native Excalidraw and make opening/switching `.excalidraw` files **instant and lossless**:

- Click a `.excalidraw` file in the sidebar → its scene loads into Excalidraw.
- Click another → switch instantly (cached scenes), no full reload, no flicker.
- Excalidraw is the **only** editor; we manage saving (Phase 05) and file ops (Phase 06), so we hide Excalidraw's own "save to active file" / "load scene" menu items.
- White, quiet, modern editor area (design system in Phase 08).

This phase wires the **read** path (`/api/file` → scene) and the **mount/switch** mechanics. Writing/persistence is Phase 05; file CRUD is Phase 06.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| SSR | `dynamic(() => import("@excalidraw/excalidraw").then(m => m.Excalidraw), { ssr:false })` inside a `"use client"` wrapper | Excalidraw touches `window`/`document` at import; SSR build fails with `window is not defined` otherwise. |
| Fonts | Set `window.EXCALIDRAW_ASSET_PATH` via `next/script` `beforeInteractive`. Robust fallback: copy `node_modules/@excalidraw/excalidraw/dist/prod/fonts` → `public/fonts` and set path `"/"`. | 0.18 ESM bundle keeps fonts under `dist/prod/fonts`; without the asset path the hand-drawn font 404s (canvas still works). |
| Scene mount | Pass `initialData` **once**; remount per file via `key={path}`. | Excalidraw is uncontrolled; feeding state back in causes loops. `key` change cleanly resets the canvas. |
| API ref | Capture `excalidrawAPI` into a `ref` (never React state). | Storing the API in state re-renders the tree and can destabilize the editor. |
| Outward mirror | `onChange(elements, appState, files)` → serialize + mark dirty + mirror to IndexedDB. | `onChange` is the only safe place; `getFiles()` is cleared on unmount (Excalidraw #4961) so we must capture here. |
| Serialization | `serializeAsJSON(elements, appState, files, "local")` | `"local"` keeps `files` (images) embedded as base64; `"database"` strips them. We want images in the file. |
| UI trimming | `UIOptions.canvasActions`: `saveToActiveFile:false`, `loadScene:false`, `toggleTheme:false`; keep `export`, `changeViewBackgroundColor`, `clearCanvas`. `theme="light"`. | We own save/load; the white theme is a hard product requirement. |
| Scene cache | `Map<path, { scene: Scene; sha: string }>` in a module-level ref (or Zustand, non-persisted) | Switching reuses the loaded scene → instant; also stores the GitHub `sha` for later writes. |
| Image data | Read via Git Blob (Phase 03/05); `files` map passed straight into `initialData.files`. | `.excalidraw` JSON stores images as base64 `dataURL`s in `files`. |

---

## 3. API contract

### 3.1 `GET /api/file`
Query: `?owner=&repo=&branch=&path=`.
Server:
1. `token = getGithubToken(req)`; 401 if absent.
2. `const { data } = await octokit.rest.repos.getContent({ owner, repo, ref: branch, path })` → get `sha` + (optional) `content`/`encoding`.
3. For reliability across sizes, fetch the blob: `const blob = await octokit.rest.git.getBlob({ owner, repo, file_sha: data.sha })` → `blob.content` is base64.
4. `JSON.parse(Buffer.from(blob.content, "base64").toString("utf8"))` → `scene`.
5. Return `{ scene, sha: data.sha, size: data.size }`.

> Why blob and not `getContent` content: `getContent` content is base64 only ≤1MB (raw header needed above); `getBlob` is uniform up to 100MB. One code path.

Response:
```json
{ "sha": "a1b2...", "size": 4321, "scene": { "type":"excalidraw","version":2,"source":"...","elements":[...],"appState":{...},"files":{...} } }
```

Client on open:
- Show skeleton while fetching.
- On success: store `{ scene, sha }` in scene cache; set editor `key=path`; set `initialData = scene` (Excalidraw restores `elements/appState/files` automatically — no manual `restoreElements` needed).

---

## 4. Component design

### 4.1 `components/editor/ExcalidrawWrapper.tsx` (client, dynamic-imported)
```tsx
"use client";
import dynamic from "next/dynamic";
import { useRef } from "react";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

export function ExcalidrawStage({
  initialData, path, onChange,
}: { initialData: ExcalidrawInitialDataState; path: string;
     onChange: (els:any, appState:any, files:any)=>void }) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  return (
    <Excalidraw
      key={path}                         // remount per file → instant clean switch
      excalidrawAPI={(api) => { apiRef.current = api; }}
      initialData={initialData}
      onChange={onChange}
      theme="light"
      UIOptions={{
        canvasActions: {
          saveToActiveFile: false,
          loadScene: false,
          toggleTheme: false,
          export: { saveFileToDisk: true },
          changeViewBackgroundColor: true,
          clearCanvas: true,
        },
      }}
    >
      {/* Custom main menu: keep Export / Clear / Help; drop Save-to-file / Load */}
    </Excalidraw>
  );
}
```

### 4.2 `components/editor/EditorPane.tsx`
- Holds `selectedPath` from store; reads scene from cache or fetches `/api/file`.
- Renders `<ExcalidrawStage key={selectedPath} initialData={scene} onChange={handleChange} />`.
- `handleChange`: debounced (Phase 05) → `markDirty(path,true)` + serialize + IndexedDB mirror; stash latest scene in cache for instant switch.
- `Cmd/Ctrl+S` → triggers save (Phase 05 `saveCurrent()`); `preventDefault`.

### 4.3 Fonts fix (`app/layout.tsx`)
```tsx
<Script id="excalidraw-assets" strategy="beforeInteractive">
  {`window.EXCALIDRAW_ASSET_PATH = "/";`}   // or window.origin
</Script>
```
If the hand-drawn font 404s in testing, copy fonts:
```bash
mkdir -p public/fonts
cp -R node_modules/@excalidraw/excalidraw/dist/prod/fonts/* public/fonts/
```
and keep `EXCALIDRAW_ASSET_PATH = "/"`.

### 4.4 Empty / loading states
- No file selected → centered hint: "Select a diagram from the sidebar, or create a new one." (Phase 06 adds create).
- Fetching → skeleton matching editor shape (not a spinner).

---

## 5. Edge cases & failure modes

- **Corrupt `.excalidraw` JSON:** `JSON.parse` may throw or Excalidraw may reject. Wrap parse in try/catch; if invalid, show "This file is not a valid Excalidraw scene" with a "Create fresh copy" option (overwrites on save).
- **File changed on GitHub since load (sha mismatch):** Phase 06 handles write conflicts. On open we don't worry; we store the loaded `sha`.
- **Switching away with unsaved changes:** Phase 05 commits (or prompts) before switching. For this phase, switching merely updates the cache; data loss is prevented once Phase 05 lands.
- **Very large file (>a few MB):** `getBlob` handles it; parsing is fine. Rendering many elements is Excalidraw's concern (it's optimized).
- **Non-excalidraw file clicked:** Phase 03 marks `isExcalidraw:false`; sidebar either hides the open action or shows "Preview not available" (text/markdown could get a simple preview later).
- **`initialData.files` images:** pass through directly; Excalidraw renders them. Ensure `files` is an object keyed by fileId.

---

## 6. Implementation steps

1. Create `ExcalidrawWrapper.tsx` with the dynamic import, `key={path}`, `excalidrawAPI` ref, `onChange`, `UIOptions`, `theme="light"`. Validate build (no SSR error).
2. Add `EXCALIDRAW_ASSET_PATH` script in `layout.tsx`; test fonts (copy to `public/fonts` if needed).
3. Create `EditorPane.tsx`: fetch `/api/file` for `selectedPath`, render skeleton, then stage.
4. Create `/api/file/route.ts` (GET) using `getContent` → `getBlob` → decode → return `{scene, sha, size}`.
5. Wire sidebar file click (Phase 03) → `setSelectedPath` → editor opens.
6. Implement scene cache (`Map`) so switching back is instant.
7. Confirm: open file A, draw, click file B, click A again → A's scene reappears instantly with edits preserved in cache.

---

## 7. Acceptance criteria

- [ ] Excalidraw mounts client-only; `npm run build` passes with no `window` SSR error.
- [ ] Hand-drawn font renders (no 404 in network tab).
- [ ] Clicking a `.excalidraw` file opens it; clicking another switches instantly via cache.
- [ ] Excalidraw's own "Save to active file" and "Load" menu items are hidden; theme is locked light.
- [ ] `onChange` fires and updates the scene cache + dirty flag (visible in store/console).
- [ ] `Cmd/Ctrl+S` is captured (no browser save dialog) and routes to a save handler (wired fully in Phase 05).
- [ ] Corrupt files and large files handled gracefully.
- [ ] No GitHub token in client traffic; `/api/file` is server-proxied.

---

## 8. Dependencies & env

- Requires: `@excalidraw/excalidraw@0.18.1`, `octokit`, `getGithubToken`, scene cache store (Zustand).
- Types: `@excalidraw/excalidraw/types` (note 0.18 path). If a type path errors, fall back to `import type { ... } from "@excalidraw/excalidraw"` top-level or `@excalidraw/excalidraw/element/types` for element types.
- No new packages.

# Plan 02 — Research Notes (verified against docs + package types)

Sources: official Excalidraw docs, `node_modules/@excalidraw/excalidraw@0.18.1` type definitions,
downloaded `.excalidrawlib`/`.excalidraw` files, Next.js 16 docs.

## 1. Imperative API access
- The `excalidrawAPI` prop is a **callback**, not a ref: `excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void`
  (`dist/types/excalidraw/types.d.ts` line 408). Ref support was removed in v0.17.0.
- The callback fires once when the API instance is created — and with `undefined`/null on unmount
  (guard for that).
- `ExcalidrawImperativeAPI` (line 603) exposes `updateScene`, `updateLibrary`, `getSceneElements`,
  `getAppState`, `getFiles`, `scrollToContent`, etc.
- Docs: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api

## 2. updateLibrary signature (verified in types)
```
updateLibrary({
  libraryItems,               // LibraryItems | LibraryItems_v1 | LibraryItemsSource
  merge?,                     // default true
  prompt?,                    // default true  -> MUST set false to avoid a confirm dialog
  openLibraryMenu?,           // default true  -> set false to avoid opening the sidebar
  defaultStatus?,             // "published" | "unpublished"
}) => Promise<LibraryItems>
```

## 3. .excalidrawlib file format (verified against downloaded files)
- **v1** (`version: 1`): `{ type: "excalidrawlib", version: 1, source?, library: [[el...], [el...]] }`
  — each array = one library item's elements. (`software-logos`, `uml-er` are v1.)
- **v2** (`version: 2`): `{ type: "excalidrawlib", version: 2, source?, libraryItems: [{status, elements, id, created, name}] }`
  — `created` is a required epoch-ms timestamp; `status` is `"published" | "unpublished"`.
  (`aws-architecture` is v2, 249 items.)
- Recommended loader: `loadLibraryFromBlob(blob, defaultStatus?) => Promise<LibraryItem[]>`
  (verified in `dist/types/excalidraw/data/blob.d.ts`) normalizes BOTH versions and adds
  `created`. Prefer it over hand-rolled parsing.
- `restoreElements`/`convertToExcalidrawElements` from the package are the canonical normalizers
  for raw element arrays (e.g. template scene files).

## 4. The 6 confirmed bugs found during research (fixed in phases 02/03/05)

| # | Phase | Bug | Fix |
|---|-------|-----|-----|
| 1 | 02 | Template "append" updated React state + cache only; Excalidraw mounts with `key={path}` + `initialData` so the **live canvas never re-renders** | Thread `onApiReady` ref → `excalidrawAPI.updateScene({ elements })` |
| 2 | 02 | Template offset only applied to X (vertical overlap) | Offset both axes using full bounding boxes (+60px gap X, +80px gap Y) |
| 3 | 02 | After append, file was never marked dirty | call `markDirty(path, true)` + bump `version` |
| 4 | 02 | "New file from template" flashed the new-file modal (`setNewState` + immediate create) | bypass modal, create directly from `template.name` |
| 5 | 03 | Global auto-save posted `{path, content, expectedBaseSha}` but `/api/commit` expects `{files:[{path,content}], message}` → **400 every tick** | background commit posts `{files, message, content: sceneToBase64(scene)}` |
| 6 | 03 | `btoa(JSON.stringify(scene))` fails on non-Latin1 (emoji/unicode) | use `sceneToBase64()` (UTF-8-safe) from `lib/excalidraw-serialize.ts` |
| 7 | 05 | Library v1→v2 hand-normalization omitted required `created` | use `loadLibraryFromBlob(blob, "published")` |
| 8 | 05 | Hand-rolled `Api` type instead of official type | type refs as `ExcalidrawImperativeAPI \| null` |

## 5. Design system (verified)
- Assistant font; accent `#6965db`; text `#1b1b1f`; muted `#868686`; hairlines `#e5e5e5`;
  dominant radius 8px (buttons 6px, dialogs 12px).
- Phase 04 shipped this already; no further changes required.

## 6. Library download status
- Available (downloaded, working): software-logos (v1, 18), aws-architecture (v2, 249),
  devops-icons (29), uml-er (v1, 21), network-topology (10), aws-serverless (24).
- 404 from libraries.excalidraw.com (dropped): gcp-services, azure-services, database-icons.
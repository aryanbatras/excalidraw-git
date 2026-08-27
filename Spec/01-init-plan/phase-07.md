# Phase 07 — Images & Assets

> **Status:** Phase 7 of 11 · **Depends on:** Phase 04 (`onChange` + `files` map), Phase 05 (`/api/commit` transport), Phase 06 (file ops).
> **Research basis:** Excalidraw embeds images in `.excalidraw` `files` map as base64 `dataURL`s (`serializeAsJSON(...,"local")`) · drag/drop & paste handled natively by Excalidraw · Git Blob API up to 100MB · GitHub 100MB hard limit per file · Excalidraw `#4961` (`getFiles()` cleared on unmount).

---

## 1. Purpose & scope

Support the user's requirement: **drag/drop images into Excalidraw and have them committed to GitHub as part of the diagram.**

- Excalidraw already supports drag/drop and paste of images into the canvas; those become entries in the `files` map.
- Because we serialize with `"local"`, images are stored **inside the `.excalidraw` JSON as base64** — so no separate asset upload is required for MVP. The whole scene (drawing + images) is one committed file.
- This phase primarily ensures the **read/write path preserves images** end-to-end and documents the **size boundary** and an optional future **external asset** strategy.

Keep MVP "brutally small": images live in the file. No separate `assets/` folder, no image CDN, for v1.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Storage location | Images embedded in `.excalidraw` `files` (base64 `dataURL`) within the same file | `serializeAsJSON(elements, appState, files, "local")` keeps `files`; one commit = drawing + images. |
| Capture | Rely on Phase 04 `onChange(elements, appState, files)` → serialize includes `files` | `files` passed to `onChange` third arg; we already mirror it. |
| Write path | Same Git DB blob commit (Phase 05) — `content` is the full base64 JSON (may be large) | Blob API accepts up to 100MB; covers typical diagrams with several images. |
| Read path | `/api/file` returns `files` map; `initialData.files` rehydrates images | Excalidraw renders `files` by fileId referenced in `elements`. |
| Size guard | If serialized size > ~90MB, warn the user before commit; hard stop >100MB | GitHub rejects >100MB blobs; better to warn than fail mysteriously. |
| Unmount safety | Mirror `files` on every `onChange` to IDB (Phase 05) | `getFiles()` is cleared on unmount (#4961); our `onChange` capture is the source of truth. |
| Future external assets (v2) | Optional: store images as separate blobs in `assets/` and rewrite `files[].dataURL` to a GitHub raw URL | Documented only; not built now. Keeps repo cleaner for huge images. |

---

## 3. Data flow (end-to-end)

```
User drags image → Excalidraw adds to `files` (base64 dataURL)
  ↓ onChange(elements, appState, files)
EditorPane: latestScene = serializeAsJSON(...,"local")  // includes files
  ↓ debounce 800ms
IndexedDB mirror (crash buffer)
  ↓ auto-save / manual save
POST /api/commit → Git Blob (base64 JSON w/ images) → Tree → Commit → Ref
  ↓ push
GitHub repo: single .excalidraw file containing drawing + images
```
Read:
```
GET /api/file → getBlob → decode JSON (with files) → initialData.files → Excalidraw renders images
```

---

## 4. Implementation notes

- **No new API** needed; reuse `/api/file` (read) and `/api/commit` (write).
- In `EditorPane.handleChange`, ensure the serialized payload used for IDB and commit is produced via `serializeAsJSON(elements, appState, files, "local")` — already the plan in Phase 04.
- Add a size check before commit: `const bytes = Buffer.byteLength(base64, "base64")` (server) or `content.length` estimate (client). If `> 100MB` → block with message; if `> 90MB` → soft warning toast "Large file — consider fewer/smaller images."
- Ensure `initialData.files` is passed exactly (object keyed by fileId) when opening; do not strip it.

---

## 5. Edge cases & failure modes

- **Pasted image from clipboard:** same path as drag/drop; Excalidraw normalizes to `files`. No extra code.
- **Repeated large images → >100MB:** commit rejected by GitHub. Block client-side first; message explains the limit and suggests reducing image count/size or (future) external assets.
- **Image in file but `files` not rehydrated on open:** would show broken images. Guarantee `files` travels with `scene` through `/api/file` and `initialData`.
- **IndexedDB mirror of large scene:** fine; IDB handles MBs easily.
- **Concurrent edits dropping an image:** since we serialize on every `onChange`, the latest state always includes current `files`. The only risk is the Phase 06 conflict case (handled by reload prompt).

---

## 6. Implementation steps

1. Confirm `serializeAsJSON(...,"local")` is used everywhere a scene is captured (Phase 04/05 already specify it; verify).
2. Add the size guard in `EditorPane` before save and in `/api/commit` server-side (belt-and-suspenders).
3. Verify a drag/drop image: draw → auto-save → reload from GitHub → image still present.
4. Document the v2 external-asset option in README/roadmap (Phase 11), not implemented.

---

## 7. Acceptance criteria

- [ ] Dragging an image onto the canvas and saving results in the image present after reload from GitHub.
- [ ] Pasted images behave identically.
- [ ] A file exceeding 100MB is blocked with a clear message; >90MB warns.
- [ ] `files` map is preserved through open/switch/IDB mirror (no broken images).
- [ ] No separate asset endpoint is required for MVP (images live in the `.excalidraw` file).

---

## 8. Dependencies & env

- Requires: Excalidraw native image handling, `serializeAsJSON("local")`, `/api/commit`, `/api/file`, IDB mirror.
- No new packages. No new env.

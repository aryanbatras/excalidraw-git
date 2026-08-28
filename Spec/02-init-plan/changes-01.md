# changes-01 — UX & File-Support Overhaul

Feedback round covering: template gallery UX, guaranteed thumbnails, instant file-switch feedback, multi-format file rendering (Markdown / code / image / PDF), image-upload compression, non-destructive history restore, and a redesigned header with an overlay title-menu toggle.

Guideline: **spec first, then build.** Everything below is the contract for the implementation pass.

---

## 1. Templates section → popup dialog with big cards

### Problem
The gallery is a **right-hand slide-over panel** (`components/templates/TemplateGallery.tsx`) with a dense 3-column grid of small cards. Cards are too small to judge a template; a panel doesn't read as a first-class picker. User wants **big cards** with visible thumbnails and a **centered popup dialog**, not a side panel.

### Approach
- Convert the gallery into a **centered modal dialog** (reuse the existing `Modal` + backdrop pattern from `components/ui`). Return-to-background click and `Esc` close it.
- **Big cards**: 2-column grid (responsive down to 1 on narrow screens), each card ~w-64:
  - **400×300 thumbnail** rendered large and sharp (no upscale blur) — this is the visual anchor.
  - template name + full description (no line-clamp truncation hiding content),
  - tags (pill badges),
  - a primary **"Use template"** action on the card itself (opens the Append/New chooser inline, not a second stacked modal).
- Keep search box + category tabs (plain-text pills, per the no-emoji rule).
- Keep the Append (right of current diagram) vs Create-new-file chooser, but present it as a **confirmation section inside the dialog body** rather than a second stacked modal. When no file is open, "new file" is the only option and runs immediately (no chooser needed).
- Focus is trapped inside the dialog; `Esc` and backdrop click close it.

### Acceptance Criteria
- [ ] Gallery opens as a centered modal dialog (not the right slide-over).
- [ ] Cards are big (2-column); thumbnails are the visual anchor; name + description fully readable.
- [ ] Search and category pills still work.
- [ ] "Use template" reveals Append/Create inline; both actions work end-to-end.
- [ ] Backdrop click and Esc close the dialog; focus is trapped.
- [ ] When no file is open, "Use template" directly creates a new file (no chooser prompt).

---

## 2. Thumbnails are mandatory (regenerable via Python OR a live view)

### Problem
Thumbnails currently come only from `scripts/generate-thumbs.mjs` (Node + sharp SVG replication). If a scene or generator changes and no one re-runs it, or the generator can't render a shape, a card silently shows a fallback tile. The user wants thumbnails **guaranteed** and **reproducible** by an independent renderer. Python replication is the primary independent method; a live React preview is the fallback.

### Approach
- **Independent replication** — add `scripts/thumbnails.py` that parses an `.excalidraw` scene and renders its own SVG→PNG/WebP (Pillow + cairosvg):
  - Supports: rect, ellipse, diamond, line, arrow (+arrowhead), freedraw, text, sticky note, image-placeholder.
  - Supports: hachure, cross-hatch, dashed styles, rotation, viewport-fit scaling.
  - Same output contract as the Node generator: **400×300 webp** in `_thumbs/`.
  - Exits non-zero on any render failure.
- **Live preview fallback (the "view")** — a tiny client component `TemplatePreview` that renders a scene (fetched `.excalidraw` JSON) as static SVG/HTML in the dialog. Used as the card image when a thumbnail file is missing, so the UI is never empty. This is a read-only simplified renderer — not a full Excalidraw mount.
- **Enforcement** — extend `scripts/test-templates.mjs`: every registered template must have a thumbnail file; add `npm run thumbs` → runs both `node scripts/generate-thumbs.mjs` AND `python3 scripts/thumbnails.py` (the Python one validates the Node output).
- All templates keep 1:1 named thumbs (`_thumbs/<cat>/<slug>.webp`), and registry `thumbnail` stays derived from `file`.

### Acceptance Criteria
- [ ] Every registered template has a 400×300 webp thumbnail (test fails otherwise).
- [ ] `python3 scripts/thumbnails.py` regenerates all thumbnails byte-identical in geometry to the Node generator (within tolerance) and exits non-zero on any failure.
- [ ] If a thumbnail is missing, the gallery card renders a live SVG preview of the scene, not text/emoji.
- [ ] New templates added to the registry are caught by the thumbnail check in `npm test`.

---

## 3. Instant file-switch feedback (no stale canvas)

### Problem
Clicking file B while file A is open triggers a network fetch, but the **old canvas keeps displaying until B's scene arrives**. `loadingFile` only renders its "Opening…" state when `!current`, so there is no visual indication and the user perceives the switch as stale/broken. Even though the file switch itself takes time, the **UI must reflect the new file name and show a loading state immediately**.

### Approach (`components/AppShell.tsx`, `components/editor/EditorPane.tsx`)
- Track a `switchingTo: string | null` state. The instant a different path is requested by `openFile(path)`:
  1. set `switchingTo = path` synchronously (before any await),
  2. tree selection updates immediately (`setSelectedPath(path)` already runs synchronously),
  3. the **header file name updates immediately** to the new file's name (even though the canvas hasn't loaded yet),
  4. render a **full-canvas overlay** (spinner + "Opening {name}…") over the existing editor until the new `current` arrives,
  5. on success clear `switchingTo`; on error keep overlay with error + Retry.
- Suppress stale content flash: while `switchingTo` is set, the old `current` canvas is visually masked (opacity-0 or pointer-events-none overlay).
- Keep the in-session cache fast-path (cached scene → immediate render, overlay only a tick — not perceptible).
- The key insight: **the file name in the header must change instantly** even if the canvas takes 1–2s. The user sees: new file name + loading spinner immediately. They never see the old file name with old content.

### Acceptance Criteria
- [ ] Clicking a file shows immediate feedback: header file name changes + tree highlight + overlay spinner before any network call resolves.
- [ ] The old file's canvas is covered (no interaction) while switching.
- [ ] Fast-path (cached file) still renders almost instantly with the overlay not perceptible.
- [ ] Load error shows in the overlay with Retry; switching away mid-load cancels cleanly (existing `loadSeq` guard respected).
- [ ] At no point does the user see a stale file name paired with stale canvas content.

---

## 4. Multi-format file rendering (Markdown / code / image / PDF)

### Problem
Only `.excalidraw` files can be opened. Markdown, code (`.java`, `.cpp`, …), images, and PDFs sitting in the repo can't be previewed. User wants a **complete rendering support system** for common file types from GitHub.

### Approach
- **Router in `AppShell.openFile`** by extension (using `classifyFile()` from `lib/fileTypes.ts`):
  - `.excalidraw` → existing editor path (unchanged).
  - `.md` / `.markdown` / `.mdx` → **Markdown viewer** using `react-markdown` + `remark-gfm` (headings, lists, tables, code fences). Code blocks highlighted with `react-syntax-highlighter`.
  - code/text (`.java`, `.cpp`, `.ts`, `.js`, `.py`, `.json`, `.yaml`, `.toml`, `.txt`, `.csv`, `.html`, `.css`, `.go`, `.rs`, …) → read-only viewer with extension-aware syntax highlighting (via `react-syntax-highlighter` + Prism) + line numbers. Also render `.md` files as raw code if the user toggles to "raw" mode.
  - `.png/.jpg/.jpeg/.gif/.svg/.webp/.bmp/.avif` → **image viewer**: render actual image bytes at natural size, with scroll/zoom. Max-width constraint with aspect ratio preserved.
  - `.pdf` → **PDF viewer** using `react-pdf` + `pdfjs-dist`: page navigation (prev/next), zoom controls, page number display.
  - Unknown extensions → raw text fallback (try UTF-8 decode; show hex dump header if binary).
- **Backend byte delivery**: extend `app/api/file/route.ts`:
  - For non-excalidraw paths return the raw blob with correct `Content-Type` derived from `MIME_BY_EXT` (already implemented in `lib/fileTypes.ts`).
  - Use the Git **blobs/gitdb** path (already used in `lib/github.ts getFileContent`) so files >1MB (Contents API limit) still load.
  - Add `X-File-Size` header for large-file UI (show file size before render).
- **New component hierarchy**:
  ```
  components/viewer/FileViewer.tsx          ← top-level router by FileKind
  components/viewer/MarkdownViewer.tsx      ← react-markdown + remark-gfm + syntax highlighting
  components/viewer/CodeViewer.tsx          ← react-syntax-highlighter + line numbers + raw toggle
  components/viewer/ImageViewer.tsx         ← <img> with zoom/scroll controls
  components/viewer/PdfViewer.tsx           ← react-pdf with page nav + zoom
  components/viewer/TextViewer.tsx          ← fallback raw text with monospace
  ```
  All viewers are **read-only** for this iteration. Shown in the `<main>` area where the editor would be.
- **File tree differentiation**: sidebar `isExcalidraw` accent still distinguishes diagram files; tree rows for other file types show a file-type icon (code, markdown, image, pdf) and open the viewer.
- **Dependencies to add**: `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`, `react-pdf`, `pdfjs-dist`.

### Markdown Viewer Detail
```tsx
// components/viewer/MarkdownViewer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// Render: headings, bold, italic, links, images (relative → resolve against repo),
// tables (remark-gfm), task lists, code fences with language-specific highlighting.
// External links open in new tab. Images use the raw /api/file?path= URL.
```

### Image Viewer Detail
```tsx
// components/viewer/ImageViewer.tsx
// Fetch raw bytes via /api/file → createObjectURL → <img>.
// Controls: zoom in/out (CSS transform scale), reset to fit, download.
// Max container: full width/height of main area, center-aligned.
// SVG: render inline (not as <img>) for crisp scaling.
```

### PDF Viewer Detail
```tsx
// components/viewer/PdfViewer.tsx
// react-pdf with pdfjs-dist worker (import from "pdfjs-dist/build/pdf.worker.min.mjs").
// Controls: page prev/next, page number input, zoom slider.
// Load from blob URL (fetched via /api/file).
// Handle large PDFs: show first page immediately, lazy-load rest.
```

### Acceptance Criteria
- [ ] Clicking a `.md` renders formatted Markdown (headings, lists, tables, code blocks) with working code highlighting.
- [ ] Clicking `.java`/`.cpp` opens a read-only, syntax-highlighted view with line numbers.
- [ ] Clicking a PNG/JPEG/GIF/SVG renders the actual image bytes at correct size.
- [ ] Clicking a PDF renders it with page navigation and zoom.
- [ ] Binary/PDF ≥1MB load via blob path (not Contents API limit).
- [ ] The sidebar `isExcalidraw` accent still distinguishes diagram files; tree rows for other file types open the viewer.
- [ ] Unknown binary files show a "Cannot preview" message with file size.
- [ ] All viewers handle loading states (spinner) and error states (retry).

---

## 5. Image upload to Excalidraw → compress first (`browser-image-compression`)

### Problem
Dropping/embedding a large photo into the canvas stores the full-size image as a base64 dataURI inside the scene — bloating the `.excalidraw` file (user goal: keep files small, ≤ a few MB).

### Approach
- Add dependency `browser-image-compression`.
- **Intercept image insertion** on the canvas (drag-drop and paste): when an image enters, run it through compression before Excalidraw embeds the dataURI.
- Implementation strategy: monitor `files` in `ExcalidrawStage.onChange`. When a new raster image file appears with size over the threshold, re-compress and `api.updateScene`/`api.addFiles` with the compressed replacement. Single migration step, no user action, toggled off during migration to avoid infinite loops.
- Compression config:
  ```ts
  import imageCompression from "browser-image-compression";
  
  const compressedFile = await imageCompression(file, {
    maxSizeMB: 1,              // target max 1MB
    maxWidthOrHeight: 1920,    // resize if larger
    useWebWorker: true,        // off main thread
    initialQuality: 0.8,       // JPEG/WebP quality
  });
  ```
- **Preserve transparency**: PNG with alpha channel and GIF animations are NOT re-encoded lossy — only resized if they exceed `maxWidthOrHeight`. JPEG/WebP fall under the quality threshold.
- Configurable `MAX_IMAGE_BYTES` (default ~1MB) — exposed later in Settings.
- Show a subtle toast: "Image compressed from 5.2MB → 890KB" when compression occurs (informational, not blocking).

### Acceptance Criteria
- [ ] Dropping a ~5MB JPEG into the canvas results in a ≤~1MB embedded dataURI.
- [ ] Transparent PNGs and GIFs are not corrupted by the pipeline.
- [ ] Existing scenes with large embedded images load unchanged; watermark/quality acceptable at 1920px max.
- [ ] The saved `.excalidraw` file's size stays reasonable (multi-MB photo → well under limit).
- [ ] Compression toast appears briefly (non-blocking) confirming size reduction.
- [ ] No infinite loop: compression check guards against re-compressing already-compressed images.

---

## 6. History restore must not destroy history

### Problem
`restoreVersion(sha)` in `AppShell.tsx` currently creates a **new `*-restored.excalidraw` file** and opens it. The History dropdown then lists only that brand-new file's commits, so it looks like the file's whole history was wiped. User wants restore to be **non-destructive**: it changes the file in-place and appends a new history entry to the same stack.

### Approach
- Restore becomes an **in-place restore on the same file**:
  1. Read the checkpoint scene for `selectedPath` at `sha` (existing `/api/file?path&ref=`).
  2. Commit the restored scene to the **same path** via `/api/commit` with message:
     ```
     Restore checkpoint #<N>
     ```
     where `N` is the checkpoint's 1-based position in the history list (newest = 1, matching the display order in the History dropdown).
  3. Reload the file into the editor and clear dirty state.
  4. **Do NOT create `-restored` files.**
- History modal labeling: each row is labeled `Checkpoint #<N>` (N=1 for newest commit, counting up). The restore button on each row triggers the in-place restore.
- After restore, the history list shows:
  ```
  Checkpoint #1  ← the new "Restore checkpoint #<N>" commit (just created)
  Checkpoint #2  ← previous newest
  Checkpoint #3  ← ...
  ...
  ```
  The stack **grows** — previous entries are preserved, and the new restore commit is appended on top.
- Keep existing conflict/head checks in `saveCurrent`.

### Acceptance Criteria
- [ ] Restoring a checkpoint rewrites the same file (no `-restored` copy is created).
- [ ] History after restore lists prior checkpoints plus the new `Restore checkpoint #<N>` entry.
- [ ] Dirty state cleared; IDB mirror and store cache updated; status shows "Restored checkpoint #<N>".
- [ ] Works for any depth (>1 restore in a row keeps the full stack).
- [ ] The History dropdown shows checkpoint numbers in order; restore always references the correct N.

---

## 7. Header redesign + overlay title-menu toggle

### Problem
The top bar is a thin (h-12) single-row toolbar; app/file identity and actions feel cramped. User wants a **bigger, clean, modern header** where a **down-arrow overlay control at top-right toggles the title menu**.

### Approach (`components/topbar/TopBar.tsx`)
- **Taller header** (`h-16` ~ `h-20`, responsive): app brand + repo identity left, file name + dirty state + save status in a clear "title area", actions grouped right (New, Templates, History, Save, Settings, Account).
- **Visual language**: surface backgrounds, 12px radius on elements, soft shadow, consistent icon buttons (phosphor), larger active/file styling. Keep no-emoji rule and existing tokens (accent `#6965db`, text `#1b1b1f`).
- **Overlay title-menu toggle**: a floating `ChevronDown` button pinned at the **top-right corner** of the viewport (over the main content area). Behavior:
  - Click → **slides down a panel** under the header (a title menu overlay that shows: current repo card, file switcher hint, saving status, quick actions, keyboard shortcuts reference).
  - Click again (or `Esc` / outside click) → **retracts the panel**.
  - It is a **toggle drawer**, not a hover dropdown — stays open until explicitly closed.
  - The ChevronDown icon rotates 180° when the panel is open (becomes ChevronUp).
  - The panel has a subtle shadow and matches the dialog/surface design language.
- **Main header layout** (simplified, always visible):
  ```
  [← Repo] | [📄 filename ●dirty] | [Saving…] | [+New] [Templates] [History] [Save] [⚙] [⏻]
  ```
- **Overlay panel content** (when toggled open):
  ```
  ┌──────────────────────────────────────────────┐
  │  📦 owner/repo@branch                       │
  │  Last saved: 2m ago · 3 unsaved files        │
  │  ──────────────────────────────              │
  │  Quick actions:                              │
  │    Cmd+S  Save    Cmd+Z  Undo               │
  │    Cmd+N  New     Cmd+T  Templates          │
  │  ──────────────────────────────              │
  │  File switcher: type to search…              │
  └──────────────────────────────────────────────┘
  ```
- When the overlay is closed, it never blocks editor keyboard shortcuts. When open, `Esc` closes it and returns focus to the editor.

### Acceptance Criteria
- [ ] Header is visibly taller and modern (visual), still responsive at small widths.
- [ ] Top-right `ChevronDown` overlay button toggles the title menu open/closed (pinned state, not hover-only).
- [ ] ChevronDown rotates to ChevronUp when the panel is open.
- [ ] All existing top-bar actions (New, Templates, History/Restore, Save, Settings, sign out, change repo) remain reachable — either pinned in the bar or in the pulled-down menu.
- [ ] File name, dirty dot, and save status are prominent in the new layout.
- [ ] The overlay panel: repo info, quick actions, keyboard hints, file switcher — all visible when open.
- [ ] `Esc` and outside click close the overlay; focus returns to editor.
- [ ] Overlay panel never blocks editor keyboard shortcuts when closed.

---

## Out of scope (tracked separately)
- AI chat editing of the selected portion (separate proposal awaiting provider choice).
- Editing/writing of non-excalidraw files (viewer is read-only this round).
- Auto-save was already moved to opt-in (not re-opening here).
- React Quill rich text editing (out of scope — Markdown viewer is render-only for now; Quill may be added in a future iteration for editable Markdown).

## Files touched (planned)
- `Spec/02-init-plan/changes-01.md` (this file)
- `components/templates/TemplateGallery.tsx`, `components/templates/TemplateCard.tsx`
- `scripts/thumbnails.py` (new), `scripts/generate-thumbs.mjs`, `scripts/test-templates.mjs`, `package.json`
- `components/AppShell.tsx`, `components/editor/EditorPane.tsx`, `components/topbar/TopBar.tsx`
- `components/viewer/FileViewer.tsx` (new), `components/viewer/MarkdownViewer.tsx` (new), `components/viewer/CodeViewer.tsx` (new), `components/viewer/ImageViewer.tsx` (new), `components/viewer/PdfViewer.tsx` (new), `components/viewer/TextViewer.tsx` (new)
- `components/templates/TemplatePreview.tsx` (new)
- `lib/github.ts`, `app/api/file/route.ts` (raw byte delivery — already partially done)
- `components/editor/ExcalidrawWrapper.tsx` (image compression hook)
- `lib/fileTypes.ts` (already has `classifyFile` + `MIME_BY_EXT` — may need minor additions)
- Dependency additions: `react-markdown`, `remark-gfm`, `react-syntax-highlighter`, `@types/react-syntax-highlighter`, `react-pdf`, `pdfjs-dist`, `browser-image-compression`

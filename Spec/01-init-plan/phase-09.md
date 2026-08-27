# Phase 09 — Templates (Gantt, Flowchart, Timeline)

> **Status:** Phase 9 of 11 · **Depends on:** Phase 04 (scene open/switch), Phase 05 (commit), Phase 06 (create file).
> **Research basis:** Excalidraw `convertToExcalidrawElements` utility to build elements from a terse spec · Excalidraw element schema (`type`, `x`, `y`, `width`, `height`, `points`, `text`, `id`, `version`, `versionNonce`, `seed`) · `serializeAsJSON` to wrap into a `.excalidraw` file · "New diagram" flow (Phase 06).

---

## 1. Purpose & scope

MVP bonus: let users start from a **template** so they don't face a blank canvas for common diagram types — **Gantt chart, flowchart, timeline**.

Deliverables:
- A `lib/templates.ts` with builders that produce valid Excalidraw `elements` (+ `appState`) for each template.
- A "New diagram ▾" menu offering: Blank, Gantt, Flowchart, Timeline.
- Selecting a template creates a new `.excalidraw` file pre-filled with the template scene (commit via Phase 06 `POST /api/file`, passing a prebuilt scene).

This is **content generation**, not a new integration — we reuse the file-create path and just seed `initialData`.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Element creation | Use `convertToExcalidrawElements([...])` (Excalidraw util) to turn a compact spec into full elements with ids/versions/nonces | Avoids hand-authoring every required field; Excalidraw documents this for programmatic scenes. |
| Templates as specs | Each template = an array of rects/texts/arrows/lines in a grid | `convertToExcalidrawElements` accepts `rectangle`, `text`, `arrow`, `line`, `ellipse`, etc. with relative coords. |
| File creation | Build `Scene` via `serializeAsJSON(elements, appState, {}, "local")` then `POST /api/file` with that scene | Reuses Phase 06 create; no new endpoint. |
| Auto-layout helpers | Small local helpers for row/column grids (Gantt bars, timeline ticks) | Keep templates readable; no external layout lib (stay small). |
| Naming | Template files default to `untitled-<type>.excalidraw`; user can rename (Phase 06) | Avoid collisions; user owns final name. |

---

## 3. Template specs

### 3.1 Blank
Empty `elements: []`, `appState: { viewBackgroundColor:"#ffffff" }`. (Already the default create in Phase 06.)

### 3.2 Flowchart
- 3 connected rounded rectangles (Start → Process → End) with arrows.
- Use `convertToExcalidrawElements` with `type:"rectangle"` (rounded via `roundness`), `label`, and `type:"arrow"` linking them.
- Provide 2–3 example nodes the user can duplicate.

### 3.3 Timeline
- A horizontal line (spine) + evenly spaced tick marks (short vertical lines) + date labels (text) above/below.
- Optional milestone diamonds (ellipse) at ticks.
- Helper `timelineTicks(count, startX, y, gap)` returns line + ticks + labels.

### 3.4 Gantt
- Header row with task names (text) on the left; a grid of task rows.
- Each task = a bar (`rectangle`) whose width encodes duration; rows spaced by `rowH`.
- Helper `ganttBar(taskX, rowY, durationCols, colW)` → rectangle; `ganttRow(label, y)` → text + bar.
- Include a simple date axis at top (text labels per column).

---

## 4. API / flow

`lib/templates.ts`:
```ts
export type TemplateId = "blank" | "flowchart" | "timeline" | "gantt";
export function buildTemplate(id: TemplateId): Scene {
  const elements = convertToExcalidrawElements(specFor(id)); // full elements
  return serializeAsJSON(elements, { viewBackgroundColor:"#ffffff" }, {}, "local");
}
```
`New diagram ▾` menu → on pick: `POST /api/file { path, scene: buildTemplate(id) }` → open the new file (Phase 04). For `blank`, send no scene (Phase 06 default).

---

## 5. Edge cases & failure modes

- `convertToExcalidrawElements` shape drift between versions: pin Excalidraw 0.18.1; if a field is rejected, fall back to hand-built minimal elements (rect/text/arrow with explicit ids).
- Very large Gantt (many rows): fine; keep default ~6 rows, user extends.
- Template opens but user wants blank: they can Select All + Delete; not a blocker.

---

## 6. Implementation steps

1. `lib/templates.ts`: `buildTemplate` for the 4 ids; grid helpers for timeline/gantt.
2. `TopBar` "New diagram ▾" menu lists Blank/Gantt/Flowchart/Timeline.
3. On select: create file with seeded scene; open it.
4. Verify each template opens, renders, and saves to GitHub as a valid `.excalidraw`.

---

## 7. Acceptance criteria

- [ ] "New diagram" menu offers Blank, Flowchart, Timeline, Gantt.
- [ ] Each template creates a valid, openable `.excalidraw` committed to GitHub.
- [ ] Flowchart shows connected nodes; Timeline shows spine+ticks+labels; Gantt shows task bars aligned to a date axis.
- [ ] Templates are not blank but are easily editable (standard Excalidraw elements).

---

## 8. Dependencies & env

- Requires: `convertToExcalidrawElements` (Excalidraw 0.18.1), `serializeAsJSON`, `POST /api/file` (Phase 06).
- No new packages.

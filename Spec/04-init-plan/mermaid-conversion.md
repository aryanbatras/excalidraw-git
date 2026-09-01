# Mermaid → Excalidraw Conversion — Deep-Verified

## Problem
AI must NOT emit raw Excalidraw element JSON (the current approach). It emits **Mermaid**, and we
convert via the official parser, whose layout engine produces correct positions/arrows, fixing
"overlapped / wrong arrow marks".

## Verified API (@excalidraw/mermaid-to-excalidraw@2.2.2)
- **Two-step**:
```ts
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

const { elements, files } = await parseMermaidToExcalidraw(mermaidDefinition, {
  themeVariables: { fontSize: "25px" }, // optional
  flowchart: { curve: "linear" },        // optional
  maxEdges, maxTextSize,
});

const excalidrawElements = convertToExcalidrawElements(elements, { regenerateIds: true });

// apply to live canvas:
excalidrawAPI.updateScene({ elements: excalidrawElements });
if (files) excalidrawAPI.addFiles(files);
excalidrawAPI.scrollToContent(excalidrawAPI.getSceneElements(), { animate: true, fitToContent: true });
```
  - `parseMermaidToExcalidraw` returns `{ elements: ExcalidrawElementSkeleton[]; files?: BinaryFiles }`
    (NOT plain elements). Conversion to full elements is required.
  - `convertToExcalidrawElements(skeleton, { regenerateIds: true })` → `OrderedExcalidrawElement[]`
    (confirmed `data/transform.d.ts`). Use `regenerateIds: true` when appending to an existing
    canvas to avoid ID collisions.
  - `scrollToContent(..., { fitToContent: true })` is valid at 0.18.1 (confirmed in bundle).

## Diagram types actually supported (CORRECTED from web docs)
`graphToExcalidraw`/`parseMermaid` handle: **flowchart (graph/flowchart-v2), sequence, class (classDiagram),
er (erd), state (stateDiagram)**. Anything else → **`graphImage`** fallback: rendered as an SVG
`data:image/svg+xml` binary file (via `files`) + an image element. So we can support 5 native types
plus bitmap fallback for Gantt/gitGraph/etc.

Sub-type fallbacks within flowchart: Subroutine/Cylindrical/Asymmetric/Hexagon/Parallelogram/
Trapezoid → Rectangle; Markdown strings → plain text; FontAwesome icons dropped; `x--x` cross
arrows → bar arrowheads.

## CRITICAL: browser-only
`parseMermaid` calls `document.createElement`, `document.body.appendChild`, `mermaid.render`,
`btoa`. **This cannot run on the server.** It must be dynamically imported client-side only
(NOT in the SSR bundle). Wrap in `await import("@excalidraw/mermaid-to-excalidraw")` inside a
`"use client"` component / browser handler.

## Package install
- It is ALREADY present (transitive dep of `@excalidraw/excalidraw@0.18.1`, hoisted). But we **must**
  add it to OUR `package.json`:
  ```
  npm i @excalidraw/mermaid-to-excalidraw@^2.2.2
  ```
  Never rely on a hoisted transitive dep for a direct import (fragile, breaks with version
  changes/deduping).

## Integration points
- New `lib/mermaid.ts`: `mermaidToScene(mermaid: string)` wrapping parse + convert + optional
  `addFiles`, returning `{ elements, files }`.
- Replace `parseAiResponse`/element-JSON generation in `AiChatPopup.generateDiagram` (lines ~160-192)
  with: AI returns Mermaid → `mermaidToScene` → `updateScene` (append with regenerateIds + offset).
- Replace `SYSTEM_PROMPT` in `lib/ai-prompts.ts` with a Mermaid-first prompt (see ai-to-mermaid.md).
- Optional: expose a "Paste Mermaid" entry in the editor to convert pasted Mermaid directly
  (mirrors Excalidraw's own built-in paste-to-Mermaid behavior).
- Parse errors: catch and show "Could not parse that Mermaid" + run the LLM error-recovery loop.

## Recommended surface
- Primary: AI chat produces Mermaid → auto-convert → render/appends to current canvas.
- Constrain which types AI may emit (flowchart/sequence/class/er/state) and require code-only output.

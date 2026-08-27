# Phase 02 — Template Gallery System

## Overview
Add a "Templates" button (separate from "New") that opens a scrollable gallery panel. Templates are real community `.excalidraw` scene files, categorized and tagged. Selecting a template **appends** its elements to the current file (never replaces).

## Template Format
Each template is a `.excalidraw` JSON file stored in `public/templates/<category>/<slug>.excalidraw`. A registry file `lib/templates/gallery.ts` exports metadata for all templates:

```ts
type GalleryTemplate = {
  id: string;                    // e.g. "system-design/load-balancer"
  name: string;                  // "Load Balancer Pattern"
  description: string;           // One-line description
  category: TemplateCategory;    // Enum value
  tags: string[];                // ["cloud", "aws", "networking"]
  thumbnail: string;             // "/templates/_thumbs/system-design/load-balancer.webp"
  file: string;                  // "/templates/system-design/load-balancer.excalidraw"
};
```

## Template Categories
| Category | Slug | Examples |
|----------|------|----------|
| System Design | system-design | Load balancer, pub/sub, CQRS, rate limiter, cache |
| Cloud Architecture | cloud-arch | AWS 3-tier, serverless API, microservices |
| UML & ER | uml-er | Class diagram, sequence diagram, ER diagram |
| Wireframes | wireframes | Mobile app, landing page, dashboard |
| Mind Maps | mind-maps | Brainstorm, project planning |
| Workflows | workflows | CI/CD pipeline, approval flow, data pipeline |
| Network | network | Home office, datacenter topology |
| Algorithms | algorithms | Binary tree, hash table, graph traversal |

## Thumbnail Generation
Thumbnails are 400×300 WebP images generated from each template file. Store in `public/templates/_thumbs/<category>/<slug>.webp`. These are static assets — no runtime generation.

## UI: Template Gallery Panel
- Triggered by a "Templates" button in the TopBar (next to "New")
- Opens a **slide-over panel** (right side, 480px wide, full height, white bg, z-50)
- Panel contains:
  - Header: "Templates" + close button
  - **Category tabs** (horizontal scrollable pills)
  - **Search input** (filter by name + tags)
  - **3-column grid** of cards (scrollable body)
  - Each card: thumbnail image, name, description (1 line truncated), tag pills
  - Click card → confirm modal ("Append to current file?" or "Create new file from template?")
- Two append modes:
  1. **Append to current**: elements added to current scene, offset by bounding box + 50px gap
  2. **New file**: creates a new .excalidraw file with the template scene (existing "New" flow)

## Append Logic (core)
```ts
function appendTemplateToScene(
  currentElements: ExcalidrawElement[],
  templateElements: ExcalidrawElement[],
): ExcalidrawElement[] {
  // 1. Normalize template elements via restoreElements() (they come from raw files —
  //    may be missing fields Excalidraw expects at runtime).
  // 2. Calculate bounding box of current elements (+ their x/y/width/height).
  // 3. Find bounding box of template elements.
  // 4. Offset ALL template elements: x += (currentRight + 60 - templateMinX),
  //    y += (currentBottom + 80 - templateMinY). Offset both axes so templates placed
  //    diagonally below-right never overlap existing work.
  // 5. Generate new unique IDs for template elements (avoid collisions) and remap
  //    groupIds / containerId / boundElements / frameId to the new IDs.
  // 6. Return [...currentElements, ...offsetTemplateElements].
}
```

## CRITICAL — Appending must update the LIVE canvas
The Excalidraw stage is mounted with `key={path}` and only renders `initialData` at mount time.
Updating React state (`current.scene`) does NOT re-render the canvas. The append must flow
through the imperative API:

1. `AppShell` must own a ref to the live API. Thread it down:
   - AppShell keeps `const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null)`.
   - A new prop `onApiReady?: (api: ExcalidrawImperativeAPI | null) => void` is passed to
     `EditorPane` → `ExcalidrawStage` → `Excalidraw`'s `excalidrawAPI` prop
     (`excalidrawAPI={(api) => onApiReady?.(api)}` — the callback fires once on ready and
     with `null` on unmount).
   - `ExcalidrawImperativeAPI` is imported as a type from `@excalidraw/excalidraw`
     (exported alongside the component in the package entry; see phase-05 notes).
2. After `handleTemplateSelect` computes the merged elements:
   - `setCurrent({ ...current, scene: mergedScene, version: current.version + 1 })` to keep
     React state + `cacheScene` consistent, AND
   - `excalidrawRef.current?.updateScene({ elements: mergedElements })` to push them into
     the live canvas, AND
   - `markDirty(current.path, true)` so the dirty indicator + save bar reflect unsaved changes.
   - Safeguard: if `excalidrawRef.current` is null (stage not yet mounted), fall back to
     bumping `version` and rely on the `key={path}` remount path showing new initialData.

## "New file from template" — DO NOT open the New-file modal
`handleTemplateSelect(..., "new")` currently calls `setNewState(...)` (opens the modal) and
then immediately creates the file, causing a visible modal flash. Instead: bypass the modal —
create the `.excalidraw` file directly with the template scene (reusing the create flow, but
come up with a name from `template.name`), then switch to it. The choice modal is only shown
when a file is ALREADY open; when no file is open, "new file" is the only option and runs
immediately.

## Template Source Files
- Curate 15-20 high-quality templates from community repos:
  - `aretecode/system-design-templates-excalidraw` (system design)
  - `ryo-arima/aws-excalidraw-template` (cloud arch)
  - `excalidraw/excalidraw-libraries` (some .excalidrawlib items as scenes)
  - Original templates for mind maps, workflows, algorithms
- All templates must be valid Excalidraw scenes (parseable, renderable)
- Store as raw JSON in public/templates/

## Files to Create/Modify
- `lib/templates/gallery.ts` — template registry (metadata only)
- `public/templates/<category>/*.excalidraw` — template scene files
- `public/templates/_thumbs/<category>/*.webp` — thumbnails
- `components/templates/TemplateGallery.tsx` — gallery panel component
- `components/templates/TemplateCard.tsx` — individual card
- `components/templates/appendTemplate.ts` — append logic
- `components/topbar/TopBar.tsx` — add Templates button
- `components/AppShell.tsx` — add gallery state + open/close handler

## Acceptance Criteria
- [ ] Templates button in TopBar opens gallery panel
- [ ] Gallery shows 3-column card grid with thumbnails, names, tags
- [ ] Category filter tabs work
- [ ] Search filters by name + tags
- [ ] Clicking a template shows append/new-file choice
- [ ] "Append" adds elements to current scene at live canvas via `updateScene`, both-axis offset, no ID collisions, marks file dirty
- [ ] "New file" creates a new file with the template content WITHOUT flashing the new-file modal
- [ ] Works when no file is open (only "new file" option available)
- [ ] At least 15 templates across 5+ categories

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
  // 1. Calculate bounding box of current elements
  // 2. Find bounding box of template elements
  // 3. Offset all template elements: x += (currentRight + 50 - templateLeft), y unchanged
  // 4. Generate new unique IDs for template elements (to avoid ID collisions)
  // 5. Return [...currentElements, ...offsetTemplateElements]
}
```

Use `excalidrawAPI.updateScene({ elements: newElements })` to apply.

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
- [ ] "Append" adds elements to current scene at correct offset, no ID collisions
- [ ] "New file" creates a new file with the template content
- [ ] Works when no file is open (only "new file" option available)
- [ ] At least 15 templates across 5+ categories

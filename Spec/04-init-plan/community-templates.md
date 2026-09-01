# Community Template Contribution (idea — not started)

## Idea
Extend the template system (`lib/templates.ts`, `TemplateId = "blank" | "flowchart" | "timeline"
| "gantt"`) with a **community templates** gallery / contribution flow.

## Verified reference points
- Official Excalidraw libraries live at `libraries.excalidraw.com` (many 404 in practice).
- Existing `.excalidrawlib` (v1/v2) + `.excalidraw` loading infra already in the repo
  (`loadLibraryFromBlob` normalizes both versions; see `Spec/02-init-plan/00-research-notes.md`).
- `buildTemplate` in `lib/templates.ts` is the current in-repo authoring surface.

## Possible contribution UX
- A template *authoring* mode: build a scene, then export as a shareable/reusable template file.
- A *library* mechanism: users submit `.excalidraw` scenes into a dedicated repo/folder; app pulls
  them as community templates (mirrors how software-logos / aws-architecture libraries are fetched).
- Not committing to a design this round — flagging as a candidate after the higher-priority
  share / mermaid / MCP items.

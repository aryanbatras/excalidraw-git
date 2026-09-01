# Plan 04 — Research Notes (DEEP-VERIFIED against installed code, not just web summaries)

> Status: RESEARCH ONLY — no code changed. This supersedes the earlier draft in this folder.
> Every claim below was checked against `node_modules/@excalidraw/excalidraw@0.18.1` compiled
> source/types, `node_modules/@excalidraw/mermaid-to-excalidraw@2.2.2` source, GitHub API docs,
> and the project's own code.

## CRITICAL CORRECTIONS to earlier assumptions
1. **`viewModeEnabled` is a top-level `<Excalidraw>` prop** (confirmed `types.d.ts:436`). It is
   a **UX-only** read-only flag (cannot modify/delete/paste; CAN select/copy/zoom/pan/export).
   It is NOT security.
2. **`UIOptions` in 0.18.1 is minimal** — only `dockedSidebarBreakpoint`, `canvasActions`
   (`tools.image`, `export`, `loadScene`, `saveToActiveFile`, ...), `tools.image`, deprecated
   `welcomeScreen`. The `interactiveContent`/`browserZoom`/`navigation` props seen in the
   upstream master CHANGELOG are **NOT available at 0.18.1**. DO NOT design around them.
3. **`@excalidraw/mermaid-to-excalidraw@2.2.2` supports MORE than flowcharts.** It parses
   flowchart, **sequence, class, er, state**, and falls back to a SVG `graphImage` for anything
   else. (Earlier web docs said "flowcharts only" — that's outdated.)
4. **`parseMermaidToExcalidraw(definition, config?)` returns `{ elements: ExcalidrawElementSkeleton[]; files?: BinaryFiles }`**
   and then you MUST call `convertToExcalidrawElements(elements)` — still two-step, confirmed from
   `dist/index.js`. Returns **skeleton** elements requiring conversion.
5. **It is browser/DOM-only**: `parseMermaid.js` uses `document.createElement`, `document.body.appendChild`,
   `mermaid.render`, `btoa`, `unescape`. **Must run client-side, never SSR.**
6. **The package is ALREADY installed** as a direct dep of `@excalidraw/excalidraw@0.18.1` (hoisted to
   `node_modules/@excalidraw/mermaid-to-excalidraw`). We must still add it to OUR `package.json`
   dependencies (never rely on a transitive dep for a direct import).
7. **Public read (share links)**: raw.githubusercontent.com does NOT accept auth, has tightened
   unauth rate limits (2025-05), and REST unauth = 60/hr/IP. Robust path = our own server route
   using `process.env.GITHUB_TOKEN` (already preferred by `getGithubToken`).
8. **`scrollToContent` IS available in 0.18.1** with `{ fitToContent, animate, duration, canvasOffsets }`
   (confirmed in bundled `App` source). The newer `fit:` API is upstream, not here.

## Verified types / signatures (0.18.1)
```ts
// components: types.d.ts
viewModeEnabled?: boolean;                                  // :436 top-level prop
excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;     // :408 callback (NOT ref)

// convert: data/transform.d.ts
convertToExcalidrawElements(
  skeleton: ExcalidrawElementSkeleton[] | null,
  opts?: { regenerateIds: boolean },
): OrderedExcalidrawElement[];

// restore: data/restore.d.ts
restore(data, localAppState, localElements, opts?): RestoredDataState; // elements,appState,files
restoreElements(elements, localElements, opts?): OrderedExcalidrawElement[];

// imperative API (types.d.ts): getSceneElements(), updateScene({elements,appState,files}),
//   addFiles(BinaryFiles), scrollToContent(target, opts)
```

## Project grounding (audited)
- Save/autosave + repo + dirty tracking live in `components/AppShell.tsx` + `lib/store.ts`
  (`zustand`). `hasUnsavedChanges` = any `dirty[path]` true (AppShell.tsx:443).
- AI flow: `components/ai-chat/AiChatPopup.tsx` streams → `parseAiResponse` (expects **element
  JSON skeleton**) → `convertToExcalidrawElements(..., {regenerateIds:true})` → `updateScene`.
  This is the code path to REPLACE with Mermaid (the element-JSON authoring is what causes
  overlapping/wrong-arrow output).
- `lib/ai-prompts.ts` `SYSTEM_PROMPT` currently instructs the model to emit raw skeleton JSON
  with hand-authored x/y coords — the source of inaccurate layouts. Replace with a Mermaid-first
  prompt.
- GitHub: `lib/github.ts` uses `octokit@5`; `getRepos` already reads `r.private`;
  `octokit.rest.repos.get()` returns `data.private`/`data.visibility`.
- `lib/auth-token.ts` `getGithubToken` prefers `process.env.GITHUB_TOKEN`, else session JWT.
- Editor mounts once per path with `key={path}`; imperative API via `onApiReady` callback
  (`excalidrawRef`/`excalidrawApi` in AppShell).

## How each feature maps to code
| Task | Files |
|------|-------|
| Share button + save-first + repo-visibility | `AppShell.tsx`, `FloatingToolbar.tsx`, `lib/github.ts` (`getRepoVisibility`), new API route |
| Read-only rendering (`viewModeEnabled`) | `components/editor/ExcalidrawWrapper.tsx` / viewer route `initialData.appState.viewModeEnabled` or prop |
| Public share read | new `app/api/share/*/route.ts` using `getGithubToken` (env PAT preferred) |
| Mermaid conversion | new `lib/mermaid.ts`, `AiChatPopup.tsx` (`generateDiagram`), `lib/ai-prompts.ts` |
| Un-owned shared doc state ("Save As") | `lib/store.ts` flags, `AppShell.tsx` save flow, `RepoPicker.tsx` |

Full per-feature detail + phases: see share-readonly.md, mermaid-conversion.md, mcp-integration.md,
ai-to-mermaid.md, blocked-rejected.md.

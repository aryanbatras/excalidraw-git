# Phase-by-Phase Implementation Plan (rigorous, verified)

> Grounded in the deep-verified facts in 00-research-notes.md and the per-feature docs.
> READ "00-research-notes.md" first — it lists the corrections that override earlier drafts.
> Do NOT implement until the user approves this plan.

## Phase 0 — Prereqs (5 min)
- [ ] `npm i @excalidraw/mermaid-to-excalidraw@^2.2.2` (add as DIRECT dependency — never rely on the
      hoisted transitive).
- [ ] Confirm `@excalidraw/excalidraw@0.18.1` still provides `convertToExcalidrawElements`,
      `restore`, `restoreElements`, `scrollToContent({fitToContent})` (already verified).
- [ ] Set `GITHUB_TOKEN` in `.env`/prod for reliable shared-link reads (fallback = anonymous REST).

## Phase 1 — Mermaid conversion (fix inaccurate AI diagrams)
Rationale: this is the root fix; it also unblocks "AI draws live" without MCP. Deliver alone, cheap
to verify.

- [ ] `lib/mermaid.ts` (client-only):
      `mermaidToScene(mermaid)` → dynamic `import("@excalidraw/mermaid-to-excalidraw")`,
      `parseMermaidToExcalidraw`, `convertToExcalidrawElements(elements, {regenerateIds:true})`,
      collect `files`. Return `{ elements, files }`; throw typed errors with parser message.
- [ ] `lib/ai-prompts.ts`: replace `SYSTEM_PROMPT` (element-JSON) with **Mermaid-first** prompt
      (rules in ai-to-mermaid.md: exact type, code-only, id sanitation, label quoting, size caps).
      Update QA + enhance prompts to reference Mermaid output.
- [ ] `components/ai-chat/AiChatPopup.tsx`: replace `parseAiResponse`/element-JSON path with
      Mermaid extraction → `mermaidToScene` → `excalidrawAPI.updateScene({elements})` +
      `addFiles(files)` + `scrollToContent(...,{fitToContent:true})`.
- [ ] **Validation + retry loop** (mandatory): on parse throw, send Mermaid + parser error back to
      model (≤2-3 attempts) to autocorrect; else show readable error + source Mermaid block.
- [ ] (Optional stretch) "Paste Mermaid" editor entry, mirroring Excalidraw's built-in behavior.

Verify: chat a diagram containing parentheses/slashes in labels → converts with correct layout &
arrows; feed a deliberately-broken Mermaid → retry loop recovers or surfaces error. All client-side,
no SSR crash.

## Phase 2 — Read-only share (save-first + privacy + view-only)
- [ ] `lib/github.ts`: add `getRepoVisibility(token, owner, repo)` → `{ private, visibility }`
      (`octokit.rest.repos.get`).
- [ ] New public route `app/api/share/[...]` GET: token = `getGithubToken` (PAT preferred); fetch
      scene; **re-verify public** (reject if now private); return scene JSON. No auth headers
      required from visitor.
- [ ] Share button (top-right, `FloatingToolbar.tsx`):
      1. if `hasUnsavedChanges` (AppShell.tsx:443) → modal "Save before sharing?" [Save & Share]/[Cancel], await save;
      2. `getRepoVisibility` → if private, block: "This repo is private. Make it public, then share.";
      3. build `https://<app>/share/<owner>/<repo>/<branch>/<path>`, copy-to-clipboard.
- [ ] Viewer: `/share/...` route (dedicated, anonymous-safe, no sidebar/RepoPicker) rendering
      `<Excalidraw>` with `initialData.appState.viewModeEnabled = true` (or prop) + scene from the
      route.
- [ ] Do NOT use upstream-only `interactiveContent`/`browserZoom` (not in 0.18.1).

Verify: private repo → blocked; public repo → link opens read-only; visitor cannot edit/save;
re-privatized repo → route refuses.

## Phase 3 — Un-owned/shared-doc state ("very critical")
- [ ] `lib/store.ts`: add `CurrentSource` union:
      `{kind:"repo", owner, repo, branch}` | `{kind:"share", originRepo?, originBranch?}`;
      set source when a shared link/file is opened.
- [ ] Save flow (`AppShell.tsx`): in `share` source → **pause auto-save**; Save action opens
      "Save As… / choose repo" (`RepoPicker.tsx`) + new path; never overwrite the origin repo.
- [ ] Keep normal repo source behavior unchanged (existing commit path).
- [ ] Guard: editing allowed locally; only persistence requires a repo decision.

Verify: open a shared foreign repo doc → edits kept in memory, no commits fired; Save → repo picker;
original repo untouched.

## Phase 4 — MCP (only after 1–3, and only if agent-facing need exists)
- [ ] Do NOT retrofit the in-app AI to MCP; it stays on Mermaid (Direction B).
- [ ] Document Direction A decision (mcp-integration.md): we would expose our canvas as an MCP
      **server** (`@modelcontextprotocol/server`, Streamable HTTP, stateless new-spec) whose tools
      map to our git scenes, consumed by external coding agents. Only pursue with a concrete goal.

## Cross-cutting
- Lint + typecheck after each phase (`npm run lint`, `npm run typecheck` if present).
- Re-read Next.js docs under `node_modules/next/dist/docs/` for route/file conventions before code
  (per AGENTS.md) — this repo uses `proxy.ts` convention, not `route.ts`, for some paths.
- Push research folder to repo after approval.
- Highest-risk correctness item = Phase 3 source flag; test thoroughly before moving on.

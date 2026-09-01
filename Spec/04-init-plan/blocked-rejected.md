# Blocked / Rejected / Risk Items

## Rejected (user decisions, confirmed)
- **Live collaborative editing** — rejected. Keep git-commit model + race-safe commit locking
  (`lib/commit-lock.ts`).
- **Google Drive storage** — rejected (API limits). Stay git/GitHub-backed.

## Read-only is UX-only, not security
- `viewModeEnabled` prevents modification but anyone with the scene JSON (incl. a public shared
  link) can copy/edit locally. If the user wants to prevent *export/copying entirely*, that is NOT
  achievable client-side. For access control, use our share route + (optionally) a signed/expiring
  token — but redistribution of a public repo file is unavoidable once it's public on GitHub.

## Public share read: ops dependency
- Anonymous shared-link reads rely on a server route. For reliability set `GITHUB_TOKEN` env in
  production (else anonymous REST = 60/hr/IP shared by all visitors on that IP).
- A repo could be **re-privatized after a link is created** → share route must re-verify visibility
  on every read and refuse (404/locked message) if now private.

## Mermaid conversion caveats
- Browser-only (no SSR). Must be dynamically imported client-side.
- Flowchart sub-shapes (subroutine/cylinder/hexagon/parallelogram/trapezoid) collapse to rectangles;
  FontAwesome icons/markdown-in-labels dropped. Non-supported diagram types become a bitmap image.
- LLM-generated Mermaid often has syntax errors (esp. unquoted labels with special chars) → the
  validation + retry loop is not optional.

## MCP decision risk
- Do NOT over-engineer. In-app "AI draws live" should use the Mermaid path (Direction B), not an MCP
  client/server. MCP (Direction A) is a separate, later, agent-facing integration requiring a
  long-running host for stateful canvases. Revisit only when there's a concrete agent-integration goal.

## Phasing note
None of these features touch the existing save/commit correctness guarantees if the "un-owned shared
doc" flag is implemented correctly (never auto-save a share-sourced doc to an unknown repo). This is
the highest-risk correctness item — isolate it and test thoroughly.

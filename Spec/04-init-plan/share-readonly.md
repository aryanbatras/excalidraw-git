# Share as Read-Only Link — Deep-Verified Design

## User requirements
1. Share button in **top-right** of a file.
2. If **unsaved**, prompt/ask to save first.
3. Creates a link to the Git repo file that opens **read-only** on our site.
4. **Refuse to share if the repo is private** ("make it public, then you can share").
5. Shared doc editing allowed locally, but **saving asks which repo to save to** (no repo
   association initially) — "very critical and crucial" state management.
6. Rejected: Google Drive storage, live collaborative editing.

## Verified: read-only rendering
- `viewModeEnabled?: boolean` prop on `<Excalidraw>` (`types.d.ts:436`).
- Behavior (from 0.18.1 source): disables element modification/deletion/paste; still allows
  selection, copy, zoom, pan, export, link-open. Confirmed via `handleCanvasPointerDown`
  viewMode guards and keyboard handler returning early when `viewModeEnabled`.
- **Set it via `initialData.appState.viewModeEnabled`** (restored) OR the prop directly.
- **Do NOT use `interactiveContent`/`browserZoom`** — not in 0.18.1 (upstream only).

## Verified: repo visibility check
- `octokit.rest.repos.get({ owner, repo })` → `data.private: boolean`, `data.visibility`.
- Add helper in `lib/github.ts`:
```ts
export async function getRepoVisibility(token, owner, repo) {
  const { data } = await getOctokit(token).rest.repos.get({ owner, repo });
  return { private: data.private, visibility: data.visibility };
}
```
- `getRepos` already returns `private` per repo (`lib/github.ts:33`).

## Verified: public (unauthenticated) read — IMPORTANT CORRECTIONS
Reading an `.excalidraw` scene for an anonymous shared-link visitor currently FAILS because
`app/api/file` GET requires `getGithubToken` (401 without). Options studied:

| Approach | Auth | Rate limit | CORS | Verdict |
|----------|------|-----------|------|---------|
| Client fetch raw.githubusercontent.com | not supported (ignored) | tightened 2025-05, undisclosed; shares IP | `*` works for non-credentialed GET | Fragile, per-IP shared, can't detect private cleanly |
| Anonymous REST `/repos/{o}/{r}/contents/{p}` | none | **60/hr/IP shared by all users on that IP** | n/a (server) | Unreliable under load (office/school IPs) |
| **Our own server route using `process.env.GITHUB_TOKEN`** | PAT (server-held) | 5000/hr, server owns it | n/a (server→server) | **ROBUST — recommended** |

- **Recommendation:** new public route (`app/api/share/...`) that (a) verifies the repo is PUBLIC
  (reject otherwise with a clear message — even though we refuse to share private at creation, the
  repo could be re-privatized later), (b) reads the scene via `getGithubToken` which prefers
  `process.env.GITHUB_TOKEN` (else anonymous REST as a degraded fallback), (c) returns the scene
  JSON.
- **Ops note:** For share links to be reliable in production, set a `GITHUB_TOKEN` env var.
- Optionally cache public scenes (e.g. revalidate) to protect GitHub quota.

## Share URL scheme
```
https://<app>/share/<owner>/<repo>/<branch>/<path>?v=1
```
A dedicated viewer page (or a `?view=1` mode) renders `<Excalidraw>` with `viewModeEnabled` and
reads the scene from the public share route.

## Save-first flow (AppShell.tsx:443 `hasUnsavedChanges`)
On Share click:
1. If `hasUnsavedChanges` → Modal: "You have unsaved changes. Save before sharing?" **[Save &
   Share]** / **[Cancel]**.
2. Trigger the existing save (`saveRef.current?.()`), await it.
3. `getRepoVisibility`. If private → block with: "This repo is private. Make it public on GitHub,
   then share again."
4. Build share URL → copy-to-clipboard dialog.

## CRITICAL state management (un-owned shared doc)
- A shared doc opened by a visitor has **no repo association** by default, even if logged in
  (unless it's their own repo).
- Track explicitly in store, e.g.:
```ts
type CurrentSource =
  | { kind: "repo"; owner; repo; branch }          // owned, normal save
  | { kind: "share"; originRepo?; originBranch? }  // share-sourced or foreign repo
```
- In `share` source: **editing is allowed locally** (standard canvas edits). On **Save**, open the
  **RepoPicker / "Save As"** flow asking which repo (+ new file path) to save to. NEVER overwrite
  the original source repo blindly.
- Save button label/behavior in this mode should read "Save As… / Choose repo". Auto-save must be
  **paused** for share-sourced docs (no repo to commit to).
- This decoupling is the crucial correctness point — don't let the editor hang onto the 
  source-repo just because it was loaded from there.

## Open implementation questions
- Dedicated `/share/...` viewer route vs reusing editor + `?view=1` — decide in phase; a dedicated
  route is cleaner for anonymous visitors (no sidebar/RepoPicker).
- Whether the owner (logged in) viewing their own shared link can toggle edit. Recommend: view-only
  for everyone on share links; edit happens by opening in the normal editor.

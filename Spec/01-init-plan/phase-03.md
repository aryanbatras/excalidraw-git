# Phase 03 — Repository Explorer (repos, branches, lazy file tree)

> **Status:** Phase 3 of 11 · **Depends on:** Phase 01 (scaffold, `lib/github.ts` stub), Phase 02 (auth + `getGithubToken`).
> **Research basis:** Octokit `rest.repos.listForAuthenticatedUser` · `rest.repos.getBranch` / default branch · `rest.repos.getContent` (Contents API, lazy per-directory) · `rest.git.getTree` (recursive fallback, truncation handling) · GitHub Contents API 1000-file-per-dir limit · 5000 req/hr authenticated rate limit.

---

## 1. Purpose & scope

After login, the user must choose **which repository** holds their Excalidraw files, and then browse its **folder structure** in a VS Code-like sidebar.

Deliverables:
- `/api/repos` — list the authenticated user's repositories (with search).
- `/api/tree` — list **one directory** at a time (lazy), returning entries with type and (for files) `sha` + `isExcalidraw`.
- A client **virtual filesystem** cache (in Zustand) that remembers which directories have been loaded, so expanding a folder is instant on second view and switching files never re-fetches the whole repo.
- Branch awareness: default branch is used unless the user switches; the chosen `owner/repo/branch` is persisted.

This phase is **read-only**: no file opening yet (Phase 04), no writes (Phase 05/06).

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Repo listing | `octokit.rest.repos.listForAuthenticatedUser({ per_page, page })` + optional `q` search via `rest.search.repositories` | Standard; paginated. Search improves UX for users with many repos. |
| Tree strategy | **Lazy per-directory** via Contents API `getContent({path})` | VS Code-like UX; avoids one giant recursive payload; folders expand on demand. |
| Recursive fallback | `rest.git.getTree({tree_sha: branch, recursive:true})` only when a directory exceeds 1000 entries or "expand all" is requested | Contents API caps at 1000 files/dir; recursive tree caps at 100k/7MB and may set `truncated:true`. |
| File identity | Capture `sha` from the listing for each file | Used later to read the blob (Phase 04) and to satisfy the update `sha` if we ever use Contents API writes. |
| Caching | Client Zustand map `Map<dirPath, TreeEntry[]>` + SWR `fallback`/cache | Instant re-expand; reduces GitHub API calls (rate limit 5000/hr). |
| Persistence of selection | `owner/repo/branch` in `localStorage` (via Zustand `persist`) | Survives reload; not secret, safe in localStorage. |
| Branch default | `rest.repos.get({owner,repo}).default_branch` | Avoids assuming `main`. |

---

## 3. API contract

### 3.1 `GET /api/repos`
Query: `?search=` (optional).
Response:
```json
{
  "repos": [
    { "owner": "aryan", "name": "diagrams", "defaultBranch": "main", "private": false }
  ]
}
```
Server: `const octokit = getOctokit(token);` then list; map to `{owner, name, defaultBranch, private}`. Honor pagination (loop `page` until `< per_page`).

### 3.2 `GET /api/tree`
Query: `?owner=&repo=&branch=&path=` (`path` defaults to repo root `""`).
Response:
```json
{
  "path": "diagrams",
  "entries": [
    { "name": "auth.excalidraw", "path": "diagrams/auth.excalidraw", "type": "file", "sha": "abc...", "size": 1234, "isExcalidraw": true },
    { "name": "assets", "path": "diagrams/assets", "type": "dir", "isExcalidraw": false }
  ],
  "truncated": false
}
```
Server logic:
1. `octokit.rest.repos.getContent({ owner, repo, ref: branch, path })`.
2. If `path === ""` and response is an array → it's the root listing.
3. If a single file (not a dir) is requested → return `{ entries: [], truncated:false }` or 404; client only calls with dir paths.
4. Map each item: `type = item.type === "dir" ? "dir" : "file"`; `isExcalidraw = type==="file" && name.endsWith(".excalidraw")`; keep `sha`, `size`.
5. Sort: **directories first**, then files, alphabetically (VS Code convention).
6. If `Array.length` hits the 1000 cap or GitHub signals truncation, set `truncated:true` and the client may request the recursive fallback (§5).

### 3.3 `GET /api/tree?recursive=1` (fallback)
Returns the full flattened tree (used rarely). Implement with `rest.git.getTree({tree_sha: branch, recursive:"1"})`; if `truncated`, walk sub-trees. Client builds the FS from the flat list.

---

## 4. Client state (Zustand)

```ts
// lib/store.ts (relevant slice)
type FSState = {
  repo: RepoRef | null;                 // {owner, repo, branch}
  dirCache: Record<string, TreeEntry[]>; // path -> entries (path "" = root)
  loadedDirs: Set<string>;
  selectedPath: string | null;          // currently open .excalidraw file
  dirty: Record<string, boolean>;       // path -> unsaved?
  setRepo: (r: RepoRef) => void;
  setDir: (path: string, entries: TreeEntry[]) => void;
  markDirty: (path: string, v: boolean) => void;
};
```
Use `zustand/middleware` `persist` for `repo` only (not the cache). Use `swr` for the actual fetches (`/api/repos`, `/api/tree?path=`) so loading/error states are free; on success, write into `dirCache`.

---

## 5. Edge cases & failure modes

- **Directory has >1000 files:** Contents API returns at most 1000 and may not signal clearly. If `entries.length === 1000` or `truncated`, the client offers "Load all (recursive)" which calls the recursive fallback. Document this to the user via a small note in the sidebar, not a crash.
- **`truncated:true` from recursive tree:** recursively fetch sub-trees to complete the listing. Keep rare; most repos are small.
- **Repo has no commits (empty):** `getContent` on root may 404. Handle by showing "This repository is empty — create a file to get started" (Phase 06 handles first-file creation; Git DB write path creates the initial ref).
- **Private repo without `repo` scope:** would 404/403. Already mitigated by requesting `repo` scope in Phase 02; still handle 403 → friendly "No access to this repository" message.
- **Rate limit (403 + `X-RateLimit-Remaining: 0`):** respond 429 with `retryAfter`; client shows "GitHub API rate limit reached, retrying soon." Cache prevents repeated hits.
- **Branch does not exist / deleted:** `getContent` 404 → reset selection to default branch.
- **Renamed/moved files while open:** `sha` from listing may be stale; Phase 06 re-fetches `sha` at write time (or uses Git DB commit which doesn't need file `sha`).

---

## 6. Implementation steps

1. Extend `lib/github.ts`:
   - `getRepos(token, search?)` → list + map.
   - `getDir(token, repo, path)` → Contents API listing → `TreeEntry[]` (+ `truncated`).
   - `getDefaultBranch(token, owner, repo)`.
2. Create `app/api/repos/route.ts` (GET) and `app/api/tree/route.ts` (GET).
   - Both: `const token = await getGithubToken(req); if(!token) return 401;`
   - Validate `owner/repo` present; return 400 on missing.
3. Build `components/sidebar/FileTree.tsx` + `TreeNode.tsx`:
   - Renders `dirCache[""]` root; each `dir` node lazy-fetches its children on first expand via SWR; caches in store.
   - Keyboard: ArrowUp/Down move, Right expands, Left collapses, Enter opens (file) — Phase 04 wires open.
   - Folders first, then `.excalidraw` files, then other files.
   - `isExcalidraw` files get a distinct icon; non-excalidraw files are shown but not openable as diagrams (openable types can show a read-only note).
4. Build the **repo selector** (topbar or a modal on first load): lists `/api/repos`, search box, selects `RepoRef`, persists to store.
5. Wire `app/page.tsx`: if no `repo` in store → show repo selector; else → show editor shell (Phase 04 fills the editor; for now show the sidebar + empty canvas placeholder).
6. Confirm lazy expansion works and the second expand is instant (from cache).

---

## 7. Acceptance criteria

- [ ] `/api/repos` returns the user's repos; search filters them.
- [ ] Selecting a repo stores `owner/repo/branch` and persists across reload.
- [ ] `/api/tree?path=` returns one directory's entries, dirs first, with `isExcalidraw` and `sha`.
- [ ] Sidebar expands folders lazily; re-expanding uses the cache (no second network call).
- [ ] Non-`.excalidraw` files are visible but not treated as diagrams.
- [ ] Empty repo, >1000-file dir, 403, and rate-limit cases show graceful messages (no white-screen crash).
- [ ] No GitHub token appears in client network traffic (all `/api/*` calls are server-proxied).

---

## 8. Dependencies & env

- Requires: `octokit` (Phase 01), `zustand` + `swr` (Phase 01), `getGithubToken` (Phase 02).
- No new packages.
- Env unchanged from Phase 02.

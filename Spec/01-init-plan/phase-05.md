# Phase 05 — Persistence (auto-save, manual save, crash safety)

> **Status:** Phase 5 of 11 · **Depends on:** Phase 02 (`getGithubToken`), Phase 03 (`repo`, `TreeEntry.sha`), Phase 04 (`onChange` mirror, scene cache).
> **Research basis:** IndexedDB via `idb` (≥5MB, survives tabs) · `serializeAsJSON` (Phase 04) · Git Database API commit (`createBlob` → `createTree` w/ `base_tree` → `createCommit` → `updateRef`) · `rest.git.getRef` (base sha) · `rest.git.createBlob` (`content` base64, `encoding:"base64"`) · blob `content` size limit 100MB · debounce + `setInterval` 15 min · `visibilitychange` / `beforeunload` flush.

---

## 1. Purpose & scope

Make saving **automatic, safe, and Git-native** so the user never loses work and GitHub remains the source of truth:

- As you draw, edits are mirrored to **IndexedDB** immediately (debounced) → crash/refresh safe.
- **Auto-save every 15 minutes** commits all dirty files to GitHub (one commit per file, or one combined commit — configurable; default: one commit per dirty file with a clear message).
- **Manual Save** (button + `Cmd/Ctrl+S`) commits immediately.
- On tab hide / close, flush the IndexedDB mirror (best-effort); if online, attempt a commit so a closed tab isn't lost.
- GitHub history = undo. We never overwrite with force; we always build on the current branch ref.

No UI for "save status" beyond a small dirty/ok indicator (Phase 08 styles it).

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Local mirror | `idb` IndexedDB, keyed by `owner/repo/path` → `{ scene, sha, updatedAt }` | localStorage 5MB cap unsafe for image-heavy scenes; IndexedDB is the crash buffer. |
| Outbound throttle | Debounce mirror to IndexedDB ~800ms on `onChange` | Avoids thrashing IDB on every pointer move. |
| Commit transport | **Git Database API** (blob→tree→commit→ref), NOT Contents API `put` | Atomic multi-file, no 1MB getContent header juggling, uniform to 100MB, preserves history cleanly. |
| Base for tree | `getRef(branch)` → `ref.object.sha` as `base_tree` | Ensures we commit against the latest tree; required by createTree. |
| Blob encoding | `createBlob({ content: base64, encoding:"base64" })` | Avoid corrupting UTF-8/JSON; also supports binary if ever needed. |
| Commit message | `chore(excalidraw): autosave <file>` / `update <file>` (manual) · include `Co-Authored-By: Excalidraw Git <noreply@excalidrawgit.app>` | Clear, searchable history. |
| Committer identity | `tree[].sha` + commit `author/committer` = `{ name: login, email: login+"@users.noreply.github.com" }` (login from session) | GitHub requires author/committer; noreply email is valid. |
| Auto-save cadence | `setInterval(commitDirty, 15*60*1000)` + immediate on manual + on `visibilitychange==="hidden"` | Meets the "auto-save every 15 minutes" requirement; hidden-tab flush catches closing. |
| Dirty model | `dirty: Record<path, boolean>` in store + persisted to IDB | Prevents no-op commits; auto-save only touches dirty files. |
| Conflict handling | **Defer** to Phase 06; assume single-user/low-contention for MVP. If `updateRef` 422 (stale base), re-fetch ref and retry once. | Keep MVP small; real merge UI later. |

---

## 3. API contract

### 3.1 `POST /api/commit` (manual) / `PUT /api/commit` (auto) — same body
Body:
```json
{
  "owner": "aryan", "repo": "diagrams", "branch": "main",
  "files": [
    { "path": "auth.excalidraw", "content": "<base64 JSON>", "encoding": "base64" }
  ],
  "message": "update auth.excalidraw"
}
```
Server:
1. `token = getGithubToken(req)`; 401 if absent.
2. `const base = (await octokit.rest.git.getRef({owner,repo,ref:`heads/${branch}`})).data.object.sha`
3. `const blobs = await Promise.all(files.map(f => octokit.rest.git.createBlob({owner,repo,content:f.content,encoding:"base64"})))`
4. `const tree = await octokit.rest.git.createTree({ owner, repo, base_tree: base, tree: files.map((f,i)=>({ path:f.path, mode:"100644", type:"blob", sha: blobs[i].data.sha })) })`
5. `const commit = await octokit.rest.git.createCommit({ owner, repo, message, tree: tree.data.sha, parents:[base], author, committer })`
6. `await octokit.rest.git.updateRef({ owner, repo, ref:`heads/${branch}`, sha: commit.data.sha })`
7. return `{ commitSha, paths: files.map(f=>f.path) }`

> Retry-once if `updateRef` returns 422 (base moved). After retry, return new sha or 409 if still conflicting (client surfaces "Pull/reload needed").

### 3.2 IndexedDB schema (`lib/idb.ts`)
```ts
const db = await openDB("exgit", 1, {
  upgrade(d){ d.createObjectStore("scenes", { keyPath:"key" }); }
});
// key = `${owner}/${repo}/${path}` → { key, scene, sha, updatedAt }
```
`saveScene(key, scene, sha)`, `loadScene(key)`, `allDirty()` (recover on boot).

---

## 4. Client flow

`components/editor/EditorPane.tsx`:
- `onChange` → debounce 800ms → `idb.saveScene(key, latestScene, sha)` + `store.markDirty(path,true)`.
- `saveCurrent()` (manual + Cmd/S): serialize latest scene → `base64` → `POST /api/commit` → on 200 clear dirty + update cached `sha`.
- `autosaveTick()` (every 15 min): for each dirty path in current repo → `POST /api/commit` (or batch into one commit) → clear dirty.
- `visibilitychange==="hidden"`: flush IDB (always) + if dirty, attempt one commit (best-effort, no await blocking close).

Boot recovery (Phase 03/04 load): if a scene key exists in IDB newer than the GitHub `sha`, show a "Recovered unsaved changes" badge offering to keep or discard (keeps the local version; discard reloads from GitHub).

---

## 5. Edge cases & failure modes

- **Offline at auto-save:** commit fails → keep dirty; IDB retains edits; retry on next tick / on reconnect (`navigator.onLine` + `online` event). No data loss.
- **Tab closed mid-edit:** `beforeunload`/`visibilitychange` flush IDB; on next open, recovery badge offers the unsaved version.
- **GitHub 422/409 (someone pushed):** retry once with fresh base; if still failing, stop, mark "needs reload," show toast. (Real conflict UI = Phase 06/11.)
- **Huge image scene >100MB:** blob API rejects; show "File too large for GitHub (100MB limit)."
- **`beforeunload` can't await network:** only flush IDB synchronously-ish; commit is best-effort and may not finish — that's acceptable because IDB recovery covers it.
- **Multiple dirty files:** one combined commit per auto-save tick (single history entry) is cleaner; manual save commits the active file only. Make this a constant `AUTOSAVE_COMBINE=true`.
- **Rate limit:** if 403 rate-limited, defer commits; dirty stays true; retry later.

---

## 6. Implementation steps

1. `lib/idb.ts`: open DB, `saveScene`/`loadScene`/`clearDirty`.
2. Extend `lib/github.ts`: `commitFiles(token, repo, branch, files[], message, author)`.
3. `app/api/commit/route.ts`: implement the Git DB flow (§3.1) with retry-once.
4. `EditorPane`: wire `onChange` debounce → IDB + dirty; `saveCurrent`; 15-min interval; `visibilitychange` flush; Cmd/S.
5. Boot recovery: on file open, compare IDB `updatedAt`/`sha` vs GitHub; show recovery badge.
6. TopBar (Phase 08) shows dirty dot / "Saving…" / "All changes saved."

---

## 7. Acceptance criteria

- [ ] Drawing mirrors to IndexedDB within ~1s (verify in DevTools → Application → IndexedDB).
- [ ] Manual Save commits the file to GitHub; `sha` updates; dirty clears.
- [ ] Auto-save fires every 15 min and commits only dirty files.
- [ ] Closing the tab and reopening offers recovery of unsaved edits (IDB).
- [ ] Switching away with unsaved edits either auto-commits or preserves via IDB (no silent loss).
- [ ] Offline edits survive; commit retries on reconnect.
- [ ] 422/409 handled with retry + user-facing "reload needed" state, not a crash.
- [ ] Git commit appears in the repo with the expected message and author identity.

---

## 8. Dependencies & env

- Requires: `idb` (Phase 01), `octokit` (Phase 01), `getGithubToken` (Phase 02), scene cache (Phase 04), store dirty (Phase 03).
- No new packages.

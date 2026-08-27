# Phase 06 — File Operations (create, delete, rename, conflict UX)

> **Status:** Phase 6 of 11 · **Depends on:** Phase 03 (`/api/tree`, `TreeEntry`), Phase 04 (`/api/file`), Phase 05 (`/api/commit` Git DB flow).
> **Research basis:** Git Database API create/delete via tree entries (`mode:"100644"`, `type:"blob"`, or `sha:null` to delete) · `createOrUpdateFileContents` (Contents API, simple single-file) · rename = create + delete in one commit · `getRef` base sha for tree · GitHub "verify commit" history as undo.

---

## 1. Purpose & scope

Give users full control of their diagram files inside the chosen repo:

- **Create** a new `.excalidraw` file (with a starter empty scene) anywhere in the tree.
- **Rename** (move) a file — one commit that creates the new path and deletes the old.
- **Delete** a file — one commit removing the tree entry.
- Basic **conflict awareness**: if the branch moved since our last known `sha`, surface "Reload needed" rather than silently clobbering.

This phase reuses the Phase 05 commit transport; it adds helpers and the sidebar/topbar affordances. GitHub remains the single source of truth; every op is a real commit.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| All writes | Go through the **Git Database API** (blob→tree→commit→ref) using `base_tree = current head` | Uniform, atomic, multi-op (rename = 2 entries), history-preserving. |
| Create | Build empty scene (`SceneFactory`) → base64 blob → tree with new path → commit | Empty `.excalidraw` is valid; Excalidraw opens it blank. |
| Delete | `createTree` entry `{ path, sha:null, mode:"100644", type:"blob" }` removes it (with `base_tree`) | GitHub deletes a blob from a tree by passing `sha:null`. |
| Rename | In one tree: add `newPath` (blob sha), delete `oldPath` (`sha:null`) | Single commit = clean history; avoids two-step race. |
| File path safety | Validate names: no `..`, no absolute, allowed chars; enforce `.excalidraw` extension on create | Prevent path traversal / accidental non-diagram files. |
| Empty repo (no head) | If `getRef` 409 (no commits), create the first commit against an empty tree (`base_tree` omitted) | New repo has no `heads/main` yet; Phase 03 noted this. |
| Conflict UX | Keep `lastKnownHeadSha` per repo; before any write, compare current `getRef` sha; if differs, warn "Remote changed" and offer Reload (re-pull tree + re-open) | MVP: no merge editor. Single-user assumption. |

---

## 3. API contract

### 3.1 `POST /api/file` — create
Body: `{ owner, repo, branch, path, scene? }` (scene optional; default empty).
Server: same Git DB flow as Phase 05 but with one new blob at `path`; commit message `create <path>`.

### 3.2 `DELETE /api/file` — delete
Query/body: `{ owner, repo, branch, path }`.
Server: `createTree({ base_tree, tree:[{ path, sha:null, mode:"100644", type:"blob" }] })` → commit `delete <path>` → `updateRef`.

### 3.3 `PATCH /api/file` — rename/move
Body: `{ owner, repo, branch, from, to }`.
Server: `createTree({ base_tree, tree:[ { path:to, mode:"100644", type:"blob", sha: blobShaOfFrom }, { path:from, sha:null, ... } ] })` → commit `rename <from> → <to>` → `updateRef`.
(Blob sha comes from reading `from` first, or reuse the cached `sha` from `TreeEntry`.)

### 3.4 `GET /api/head` (conflict check helper)
`{ owner, repo, branch }` → `{ sha }` (current head). Client compares to `lastKnownHeadSha`.

---

## 4. UX affordances

- **Sidebar**: hover row → `＋` (new file in this dir), `⋯` menu → Rename / Delete (with confirm dialog). Right-click optional.
- **TopBar / empty state**: "New diagram" button → prompts for name + folder → `POST /api/file`.
- **Confirm delete**: modal "Delete `auth.excalidraw`? This is a Git commit and can be recovered from history." (history = undo, per product decision).
- **Rename**: inline input or small modal; enforce `.excalidraw`.
- **After any op**: refresh the affected directory cache (Phase 03) and, on delete of the open file, clear `selectedPath`.

---

## 5. Edge cases & failure modes

- **Name collision (path exists):** create should refuse ("already exists") — check via tree cache or a HEAD-like check; or let GitHub accept and then warn. Prefer client pre-check from cache; fallback to commit error → toast.
- **Delete the currently-open file:** clear selection; show empty-state hint.
- **Rename the open file:** update `selectedPath` + cache key; keep the in-memory scene (it's path-agnostic) so no data loss; update dirty map key.
- **Repo has zero commits:** `getRef` 409 → create initial commit with empty tree + the new file. Handle in all three ops.
- **Remote moved (conflict):** `updateRef` 422/409 or pre-check mismatch → show "Remote changed since you loaded — Reload to continue." No force push.
- **Path traversal:** reject `../`, leading `/`, or null bytes server-side; 400.
- **Very deep paths:** GitHub supports arbitrary depth; just ensure `path` is the full repo-relative path.

---

## 6. Implementation steps

1. Extend `lib/github.ts`: `createFile`, `deleteFile`, `renameFile`, `getHead` (all via Git DB).
2. `app/api/file/route.ts`: handle `POST` (create), `DELETE` (delete), `PATCH` (rename). `app/api/head/route.ts` GET.
3. `EditorPane` / `FileTree`: wire New / Rename / Delete affordances + confirm modals.
4. After ops: invalidate dir cache for affected path's parent; refresh tree.
5. Conflict check: store `lastKnownHeadSha` per repo; pre-write compare via `GET /api/head`; on mismatch, block + offer Reload.

---

## 7. Acceptance criteria

- [ ] Creating a file adds a valid empty `.excalidraw` to GitHub and appears in the sidebar.
- [ ] Deleting a file removes it via a commit; open file clears safely.
- [ ] Renaming produces one commit that moves content and removes the old path.
- [ ] New-file name validation rejects bad chars / missing extension.
- [ ] Empty-repo first-file creation works (no 409 crash).
- [ ] Conflict (remote moved) is detected and prompts Reload instead of clobbering.
- [ ] Tree cache updates after each op (no stale entries).
- [ ] All writes are real, inspectable Git commits in the repository.

---

## 8. Dependencies & env

- Requires: `octokit`, `getGithubToken`, Git DB flow (Phase 05), tree cache (Phase 03), scene cache/store (Phase 04).
- No new packages.

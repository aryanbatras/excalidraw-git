# Phase 11 — Roadmap v2 (history UI, storage providers, collaboration)

> **Status:** Phase 11 of 11 · **Depends on:** Phases 01–10 (production MVP).
> **Research basis:** GitHub Commits API (`rest.repos.listCommits`) + Blobs for restore · provider OAuth patterns (reuse Auth.js multi-provider) · Git-like conflict merge UX · product brief's stated future providers (Google Drive, OneDrive, Telegram, Notion, Discord) · "GitHub = undo history" decision (Phase 05).

---

## 1. Purpose & scope

This phase is a **planning/roadmap document**, not a build. It captures the v2 direction so the MVP architecture (provider-agnostic storage behind route handlers) is positioned to extend without rewrites.

Themes:
1. **History & restore UI** (natural MVP follow-on — GitHub already stores every version).
2. **Conflict resolution** (real merge UX beyond the Phase 06 "reload" prompt).
3. **Additional storage providers** (Drive, OneDrive, Telegram, Notion, Discord) behind the same `/api/*` interface.
4. **Collaboration / multi-user** (optional, later).

---

## 2. Architecture principle for v2

Keep the **storage interface stable**. Today:
```
/lib/github.ts  → getRepos, getDir, getFile, commitFiles, create/delete/rename
/app/api/*      → thin HTTP over that interface
```
v2 adds sibling modules (`/lib/drive.ts`, `/lib/onedrive.ts`, …) implementing the **same interface**; route handlers gain a `?provider=` (or session-stored provider) and dispatch. The client (sidebar/editor/persistence) stays unchanged because it only speaks `/api/*`. This is why Phase 01 forbade client-side GitHub credentials.

---

## 3. v2 item: History & restore

- `GET /api/history?path=` → `octokit.rest.repos.listCommits({owner,repo,path})` → list of `{sha, message, author, date}`.
- "Restore" → fetch that commit's blob (`getBlob`) → open as current scene (or as a new `<file>-restored.excalidraw` to avoid clobbering).
- UI: a clock icon in TopBar → side panel listing versions; click to preview/restore.
- This fulfills "GitHub history = undo" with a real UI instead of raw Git.

## 4. v2 item: Conflict resolution

- On `updateRef` 422/409, instead of blocking: fetch both head and our base, show a **diff/merge panel** (Excalidraw has no native merge; offer: Keep mine / Keep theirs / Open both side-by-side). For MVP-v2, "Keep mine (force commit)" + "Keep theirs (reload)" suffices; true element-level 3-way merge is a stretch goal.

## 5. v2 item: Storage providers

| Provider | Mechanism | Notes |
|---|---|---|
| Google Drive | Auth.js Google provider + Drive REST (`files.create`/`get`/`update`) | OAuth scope `drive.file`; store `.excalidraw` as Drive files; no git history (use Drive revisions). |
| OneDrive | Auth.js Microsoft provider + Graph `/drive/root` | Similar to Drive. |
| Telegram | Bot token + `sendDocument`/`getFile` | Store files as bot-sent documents; quirky but possible; no folder tree (use filename convention). |
| Notion | Notion OAuth + `blocks.children` or file property | Diagram as a Notion file property / page attachment; limited canvas embedding. |
| Discord | Bot + channel messages (attachments) | Store as message attachments in a dedicated channel; retrieve via message id. |

All implement `getDir/getFile/commitFiles/create/delete/rename` → drop-in. Provider selection stored per "workspace" in the user's settings (localStorage or a tiny settings repo).

## 6. v2 item: Collaboration (stretch)

- Live multiplayer = Excalidraw Collaboration (WebSocket) or CRDT; out of scope for MVP. v2 could add a small signaling/server (Vercel Edge WebSocket / a tiny relay). Keep GitHub as the durable snapshot; presence as ephemeral.

## 7. Other v2 niceties

- Global search across repos/files (GitHub `rest.search.code` with `extension:excalidraw` + `repo:`).
- Multi-file tabs in the editor (reuse scene cache, Phase 04).
- Templates gallery expansion (more flows, ER diagrams, wireframes).
- Custom domains + team/orgs support (GitHub orgs in repo list).
- Per-repo settings (default branch, autosave interval, external assets toggle from Phase 07).

---

## 8. Risks & non-goals

- **Not** building a real-time database. GitHub/Drive/OneDrive are the source of truth; we remain "brutally small."
- **Not** implementing element-level merge in v2-core (only keep-mine/theirs).
- **Not** supporting every provider at once; add incrementally behind the stable interface.
- Telegram/Discord are storage hacks (no native folders/history) — acceptable as "send my diagram to X," not as primary FS.

---

## 9. Acceptance (for the roadmap doc)

- [ ] Architecture documented with a stable storage interface enabling new providers without client changes.
- [ ] History/restore, conflict merge, and provider list scoped with concrete APIs.
- [ ] Non-goals explicit so v2 scope stays bounded.

---

## 10. Dependencies & env

- Future: `next-auth` additional providers (Google/Microsoft/Notion), respective SDKs.
- Env: provider client ids/secrets per provider.
- No code in this phase.

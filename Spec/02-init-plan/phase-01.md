# Phase 01 — Create Button Loading State (Bug Fix)

## Problem
Clicking "Create" in the new-file modal fires an API call to POST /api/file (Git commit) which takes 1-3s. During this time the button is clickable — users can click multiple times, creating duplicate files and duplicate commits.

## Fix
1. In `AppShell.tsx` `createFile()`, add `creating` boolean state (`const [creating, setCreating] = useState(false)`).
2. Guard: `if (creating) return;` at the top of `createFile()`.
3. Set `setCreating(true)` before the fetch, `setCreated(false)` in finally.
4. In the modal's Create button: `disabled={creating}` and show spinner + "Creating…" text when `creating` is true.
5. Same pattern for `doRename` and `doDelete` — add `renaming`/`deleting` state to prevent double-clicks.

## Acceptance Criteria
- [ ] Clicking Create once disables the button immediately, shows spinner
- [ ] Second click does nothing (guarded)
- [ ] On error, button re-enables
- [ ] On success, modal closes normally
- [ ] Same protection on Rename and Delete modals

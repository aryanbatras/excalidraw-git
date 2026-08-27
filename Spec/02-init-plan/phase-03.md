# Phase 03 — Configurable Auto-Save + Settings Panel

## Overview
Add a settings panel (gear icon) with auto-save configuration. Auto-save interval is user-configurable (minimum 30s). The auto-save applies to the current file and continues in the background even after switching files.

## Settings Panel
- Gear icon in TopBar (right side, next to Sign out)
- Click → dropdown panel (280px wide, same style as account menu)
- Settings stored in zustand (persisted to localStorage):
  - `autoSaveEnabled: boolean` (default: true)
  - `autoSaveIntervalSeconds: number` (default: 60, min: 30, max: 300)
- Settings panel contents:
  - **Auto-save** toggle
  - **Interval** slider (30s–300s) with current value displayed
  - Separator
  - **Keyboard shortcuts** reference (Cmd+S = save, Cmd+Z = undo)

## Auto-Save Behavior (revised from plan 1)
Current behavior: EditorPane has a 15-min `setInterval` that commits the active file. This is replaced:

1. **Global auto-save interval** in AppShell (not per-EditorPane):
   - Runs a single `setInterval` at the configured interval
   - On each tick: iterate all dirty paths in `useStore.getState().dirty`
   - For each dirty path: if it's the currently open file, use `saveRef.current()`; if it's a different file (dirty from a previous session), commit directly via `POST /api/commit` using the cached scene from `sceneCache`
   - This handles the "edited file A, switched to file B, file A auto-saves in background" case

2. **EditorPane's onChange** still writes to IDB + cache (debounced 800ms) as before
3. **EditorPane's `visibilitychange`** still flushes IDB + commits on tab hide
4. Remove the per-EditorPane `setInterval` (15-min auto-save) — replaced by the global one

## Background Commit for Non-Active Files
When the global auto-save ticks and a dirty path is NOT the current file:
```ts
const state = useStore.getState();
for (const [path, isDirty] of Object.entries(state.dirty)) {
  if (!isDirty) continue;
  if (path === currentPath) {
    saveRef.current?.(); // active file — uses normal save flow
  } else {
    // background commit for non-active file
    const cached = state.sceneCache[path];
    if (cached && repo) {
      void commitFilesToGitHub(repo, path, cached.scene, cached.sha);
    }
  }
}
```

`commitFilesToGitHub` is a new helper in AppShell that wraps the `/api/commit` fetch + updates cache + clears dirty + updates headSha.

## CRITICAL — Background commit payload must match `/api/commit`
The current global auto-save (AppShell) sends:
```ts
{ path, content: btoa(JSON.stringify(cached.scene)), expectedBaseSha: cached.sha }
```
but `POST/PUT /api/commit` expects `{ files: [{ path, content }], message }`.
Result: **every background auto-save for a non-active file returns 400 "missing params"** — the feature silently never works. Fix in `commitFilesToGitHub`:

```ts
POST /api/commit?owner&repo&branch
body: {
  files: [{ path, content: sceneToBase64(cached.scene) }],
  message: `auto-save: ${path}`,
}
```

Two additional notes:
- Use `sceneToBase64()` (from `lib/excalidraw-serialize.ts`) **not** `btoa(JSON.stringify(...))`. `btoa` throws/fails on non-Latin1 characters (emoji, non-English labels); `sceneToBase64` runs a UTF-8 encode first and is already the standard used by the editor save flow.
- `expectedBaseSha` is not part of this endpoint's contract; the server does its own conflict retry inside `commitFiles`. Drop it from the body.

## CRITICAL — Interval must re-bind when settings change
The auto-save `setInterval` is created with the auto-save interval value captured at mount.
- The effect's dependency array must include `autoSaveEnabled` and `autoSaveIntervalSeconds` (and anything it closes over) so changing the slider/interval or toggling auto-save off/on clears and re-creates the timer immediately.
- Guard the tick with an `autoSaveEnabled` check; when disabled no commits happen.

## Files to Modify
- `lib/store.ts` — add `autoSaveEnabled`, `autoSaveIntervalSeconds` to persisted state
- `components/AppShell.tsx` — add global auto-save interval, remove per-EditorPane interval
- `components/editor/EditorPane.tsx` — remove 15-min setInterval
- `components/topbar/TopBar.tsx` — add gear icon + settings dropdown
- `components/settings/SettingsPanel.tsx` — new component for settings UI

## Acceptance Criteria
- [ ] Gear icon in TopBar opens settings dropdown
- [ ] Auto-save toggle and interval slider work
- [ ] Settings persist across sessions (localStorage)
- [ ] Changing interval takes effect immediately (clear old interval, set new)
- [ ] Auto-save commits ALL dirty files (not just current) on each tick via the correct `/api/commit` payload (`files[]` + `sceneToBase64`, not `btoa`)
- [ ] File A auto-saves in background after switching to file B
- [ ] Per-EditorPane 15-min interval is removed (replaced by global)
- [ ] Minimum interval is 30 seconds (enforced in UI + code)

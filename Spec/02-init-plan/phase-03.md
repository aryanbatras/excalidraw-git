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
- [ ] Auto-save commits ALL dirty files (not just current) on each tick
- [ ] File A auto-saves in background after switching to file B
- [ ] Per-EditorPane 15-min interval is removed (replaced by global)
- [ ] Minimum interval is 30 seconds (enforced in UI + code)

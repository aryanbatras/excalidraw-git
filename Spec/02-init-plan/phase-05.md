# Phase 05 — Excalidraw Library Loader (Dynamic, Settings-Selectable)

## Overview
Allow users to dynamically load popular community Excalidraw libraries (`.excalidrawlib` files) stored in `public/libraries/`. Libraries are selectable in the settings panel — user picks which to enable. Libraries load lazily when the editor opens and unload when disabled. No remounting required (uses `excalidrawAPI.updateLibrary()`).

## Library Files
Store curated `.excalidrawlib` files in `public/libraries/`:

| File | Source | Description |
|------|--------|-------------|
| `software-logos.excalidrawlib` | excalidraw-libraries | Docker, K8s, React, etc. |
| `aws-architecture.excalidrawlib` | excalidraw-libraries | AWS service icons |
| `devops-icons.excalidrawlib` | excalidraw-libraries | CI/CD, infra icons |
| `uml-er.excalidrawlib` | excalidraw-libraries | UML + ER diagram shapes |
| `database-icons.excalidrawlib` | excalidraw-libraries | Database icons |
| `network-topology.excalidrawlib` | excalidraw-libraries | Network diagrams |
| `gcp-services.excalidrawlib` | excalidraw-libraries | GCP icons |
| `azure-services.excalidrawlib` | excalidraw-libraries | Azure icons |

Download from: `https://libraries.excalidraw.com/libraries/<path>`

## Library Metadata Registry
```ts
// lib/libraries/registry.ts
type LibraryMeta = {
  id: string;                    // "software-logos"
  name: string;                  // "Software Logos"
  description: string;           // "Docker, K8s, React, Vue, and more"
  file: string;                  // "/libraries/software-logos.excalidrawlib"
  icon: string;                  // "📦" (emoji for quick visual)
  size: string;                  // "~62k downloads" (from library page)
  items: number;                 // Number of library items (for display)
  category: "icons" | "diagrams" | "cloud" | "infrastructure";
};

export const LIBRARIES: LibraryMeta[] = [ ... ];
```

## Loading Flow
1. On editor mount (`ExcalidrawWrapper.tsx`), read enabled library IDs from zustand store
2. For each enabled library:
   - `fetch(lib.file)` → read as **Blob** → `loadLibraryFromBlob(blob, "published")` (official util from `@excalidraw/excalidraw`, see below) → get normalized `LibraryItem[]`
   - `excalidrawAPI.updateLibrary({ libraryItems, merge: true, prompt: false })`
3. Track loaded library IDs in a `useRef<Set<string>>` to avoid double-loading within one mount
4. Loading is async and non-blocking — editor renders immediately, libraries appear in sidebar as they load

## CRITICAL — Use `loadLibraryFromBlob`, don't hand-roll v1/v2 parsing
`.excalidrawlib` files come in **two incompatible shapes** (verified against downloaded files):
- **v1** (`version: 1`): `{ type, version: 1, source?, library: [ [elements...], [elements...], ... ] }` — each item is a bare element array (`software-logos`, `uml-er` are v1).
- **v2** (`version: 2`): `{ type, version: 2, source?, libraryItems: [{ status, elements, id, created, name }] }` (`aws-architecture` is v2).

The manual normalization currently in `ExcalidrawWrapper.tsx` translates v1 → `{status, id, name, elements}` but **omits `created`** — which `LibraryItem` requires (epoch ms). Hand-rolled parsing also skips the full element normalization Excalidraw applies on import.

**Fix:** use the package's own decoder:
```ts
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";

const blob = await (await fetch(meta.file)).blob();
const items = await loadLibraryFromBlob(blob, "published");
await api.updateLibrary({ libraryItems: items, merge: true, prompt: false });
```
`loadLibraryFromBlob(blob, defaultStatus?) => Promise<LibraryItem[]>` handles both versions (wrapping v1 arrays, adding `created`, `status`, `id`, `name`, and normalizing elements). Signature verified in `dist/types/excalidraw/data/blob.d.ts`. Files must be fetched as `blob()` (not `.json()`) since it takes a `Blob`.

## CRITICAL — `ExcalidrawImperativeAPI`, not a custom `Api` type
- The wrapper currently types its ref with a hand-rolled `Api` subset. Type it as `ExcalidrawImperativeAPI | null`, imported as a type from `@excalidraw/excalidraw`.
- Also expose the same ref to `AppShell` via the `onApiReady?: (api: ExcalidrawImperativeAPI | null) => void` prop required by **phase-02** (append must call `updateScene` on the live canvas). `excalidrawAPI={() => ...}` is a callback prop fired once ready (and with `null` on unmount).

## CRITICAL — Remount resets `loadedLibs` and re-loads libraries
`ExcalidrawStage` is mounted with `key={path}`, so switching files remounts the wrapper and `loadedLibs.current` starts empty again → libraries are re-fetched + re-loaded on every file open. That's acceptable (fast, idempotent via `merge:true`), but:
- Guard against loading on the very first mount racing `updateLibrary` readiness — the `excalidrawAPI` callback is the correct trigger; do NOT fire fetches from a `useEffect` on mount before the API exists.
- Optionally store loaded IDs in the zustand store (`loadedLibraries: string[]`) instead of a ref so the set survives remounts and re-fetch is skipped on subsequent file opens.

## Unloading Flow
When user disables a library in settings:
1. The library items remain in Excalidraw's internal library (Excalidraw doesn't have an "unload" API)
2. **Solution:** On next editor mount, only load currently-enabled libraries (fresh start)
3. If the user disables a library mid-session, show a note: "Changes take effect when you reopen the file"
4. Alternative: `excalidrawAPI.updateLibrary({ libraryItems: [], merge: false })` replaces the entire library — not viable since it would remove manually-added items too. Stick with the "fresh mount" approach.

## Settings Panel Integration
Extend the settings panel (from Phase 03):

```
[Settings]
─────────────
Auto-save      [Toggle] ✓
Interval       [====●===] 60s
─────────────
Libraries
  ☑ Software Logos    📦 142 items
  ☑ AWS Architecture  ☁️  87 items
  ☑ DevOps Icons      🔧 64 items
  ☐ UML & ER          📊 53 items
  ☐ Database Icons    🗄️  22 items
  ☐ Network Topology  🌐 22 items
  ☐ GCP Services      ☁️  45 items
  ☐ Azure Services    ☁️  38 items
```

- Checkboxes toggle enabled state
- State persisted to zustand (localStorage): `enabledLibraries: string[]`
- Changes apply on next editor mount (or file open)

## ExcalidrawWrapper Changes
```ts
// In ExcalidrawWrapper.tsx
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw";
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";

const enabledLibraries = useStore((s) => s.enabledLibraries);
const loadedLibs = useRef(new Set<string>());

const handleAPI = useCallback(async (api: ExcalidrawImperativeAPI | null) => {
  if (!api) {
    onApiReady?.(null);
    excalidrawAPIRef.current = null;
    return;
  }
  excalidrawAPIRef.current = api;
  onApiReady?.(api);
  // ... existing font change ...

  // Load enabled libraries (fires once when API becomes ready)
  for (const libId of enabledLibraries) {
    if (loadedLibs.current.has(libId)) continue;
    const meta = LIBRARIES.find((l) => l.id === libId);
    if (!meta) continue;
    try {
      const res = await fetch(meta.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const items = await loadLibraryFromBlob(blob, "published");
      await api.updateLibrary({ libraryItems: items, merge: true, prompt: false });
      loadedLibs.current.add(libId);
    } catch (err) {
      console.error(`Failed to load library ${libId}:`, err);
      // surface a subtle status row on the settings panel, do not break the editor
    }
  }
}, [enabledLibraries]);
```
Note: `enabledLibraries` in the deps re-fires `handleAPI` when the user toggles libraries
mid-session — guard with `loadedLibs.current` and skip already-loaded IDs. Type the prop as
`onApiReady?: (api: ExcalidrawImperativeAPI | null) => void`.

## Store Additions
```ts
// lib/store.ts additions
enabledLibraries: string[];     // IDs of enabled libraries (persisted)
toggleLibrary: (id: string) => void;
```

Default: `["software-logos", "aws-architecture", "devops-icons"]` (most popular enabled by default)

## Files to Create/Modify
- `public/libraries/*.excalidrawlib` — download 8 library files
- `lib/libraries/registry.ts` — library metadata registry
- `lib/store.ts` — add `enabledLibraries`, `toggleLibrary`
- `components/editor/ExcalidrawWrapper.tsx` — add library loading on mount
- `components/settings/SettingsPanel.tsx` — add library checkboxes section
- `components/settings/LibraryToggle.tsx` — individual library checkbox component

## Downloading Libraries
```bash
# Run once to populate public/libraries/
mkdir -p public/libraries
curl -o public/libraries/software-logos.excalidrawlib \
  "https://libraries.excalidraw.com/libraries/drwnio/drwnio.excalidrawlib"
curl -o public/libraries/aws-architecture.excalidrawlib \
  "https://libraries.excalidraw.com/libraries/childishgirl/aws-architecture-icons.excalidrawlib"
# ... etc for all 8
```

## Acceptance Criteria
- [ ] 6 `.excalidrawlib` files in `public/libraries/` (gcp-services, azure-services, database-icons returned 404 from libraries.excalidraw.com — dropped)
- [ ] Library registry with metadata (name, description, icon, item count)
- [ ] Settings panel shows library checkboxes
- [ ] Libraries load via `loadLibraryFromBlob` (v1 + v2 files both load, `created`/`status` populated)
- [ ] `ExcalidrawImperativeAPI` type used for the editor ref; same ref surfaced to AppShell via `onApiReady`
- [ ] Enabling a library loads it into the editor sidebar on next mount
- [ ] Libraries load lazily (non-blocking, async fetch)
- [ ] Enabled libraries persist across sessions (localStorage)
- [ ] Default: top 3 libraries enabled
- [ ] No editor remount needed for loading
- [ ] Disabled libraries take effect on next file open
- [ ] Failed library loads show console error, don't break editor

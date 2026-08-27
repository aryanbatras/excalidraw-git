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
   - `fetch(lib.file)` → parse JSON → extract `.libraryItems`
   - `excalidrawAPI.updateLibrary({ libraryItems, merge: true, prompt: false })`
3. Track loaded library IDs in a `useRef<Set<string>>` to avoid double-loading
4. Loading is async and non-blocking — editor renders immediately, libraries appear in sidebar as they load

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
const enabledLibraries = useStore((s) => s.enabledLibraries);
const loadedLibs = useRef(new Set<string>());

const handleAPI = useCallback(async (api: ExcalidrawAPI) => {
  excalidrawAPIRef.current = api;
  // ... existing font change ...
  
  // Load enabled libraries
  for (const libId of enabledLibraries) {
    if (loadedLibs.current.has(libId)) continue;
    const meta = LIBRARIES.find(l => l.id === libId);
    if (!meta) continue;
    try {
      const res = await fetch(meta.file);
      const lib = await res.json();
      await api.updateLibrary({
        libraryItems: lib.libraryItems,
        merge: true,
        prompt: false,
      });
      loadedLibs.current.add(libId);
    } catch (err) {
      console.error(`Failed to load library ${libId}:`, err);
    }
  }
}, [enabledLibraries]);
```

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
- [ ] 8 `.excalidrawlib` files in `public/libraries/`
- [ ] Library registry with metadata (name, description, icon, item count)
- [ ] Settings panel shows library checkboxes
- [ ] Enabling a library loads it into the editor sidebar on next mount
- [ ] Libraries load lazily (non-blocking, async fetch)
- [ ] Enabled libraries persist across sessions (localStorage)
- [ ] Default: top 3 libraries enabled
- [ ] No editor remount needed for loading
- [ ] Disabled libraries take effect on next file open
- [ ] Failed library loads show console error, don't break editor

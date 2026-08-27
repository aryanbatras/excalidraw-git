# Phase 08 — Design System & UI

> **Status:** Phase 8 of 11 · **Depends on:** Phase 01 (tokens scaffold), all editor/sidebar/topbar components exist.
> **Research basis:** `web-design-guidelines` skill → **Vercel Web Interface Guidelines** (`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`) · `frontend-design` skill (distinctive, typography-forward) · `design-taste-frontend` skill (anti-slop; NOT a landing page; Phosphor over lucide; Geist; restrained accent; restrained motion; density 5–6; AA contrast).

---

## 1. Purpose & scope

Apply a **cohesive, intentional, light-locked** visual system so the product feels like a polished developer tool, not a generic AI-generated dashboard. This is a **product/editor UI**, so the brief is: calm, dense, legible, "VS Code-like," with a single warm accent that nods to Excalidraw. No gradients-for-decoration, no AI-purple, no premium-beige, no centered hero.

Deliverables:
- Final design tokens (color, radius, spacing, type scale, motion) in `app/globals.css` + Tailwind v4 `@theme`.
- Three-pane layout: **TopBar** (repo + file + status + actions), **Sidebar** (file tree), **Editor** (Excalidraw) — exact VS Code arrangement.
- Component styling for `Button`, `IconButton`, `TreeRow`, `TopBar`, `Toast`, `Modal`, `Skeleton`, dirty/ok status, empty states.
- Accessibility (AA), keyboard nav, reduced-motion, focus rings.

---

## 2. Design principles (from the three skills)

1. **This is not a landing page.** Build an interface, not a marketing page. Density and function over whitespace theater.
2. **Restrained, intentional accent.** One accent color. We use a warm coral `#E2603B` that echoes Excalidraw — deliberately *not* the generic AI purple (`#7C3AED`/`#8B5CF6`).
3. **Typography is the hero.** Geist Sans for UI; Geist Mono for paths/filenames/metadata. Tight, deliberate type scale. No Inter-by-default.
4. **One icon family, consistently.** `@phosphor-icons/react`, `strokeWidth={1.5}`, `weight="regular"` (or `duotone` for emphasis). No mixing lucide/heroicons.
5. **Restrained motion.** Short (120–180ms), ease-out, only where it aids comprehension (tree expand, toast, save pulse). Respect `prefers-reduced-motion`.
6. **Light theme locked.** Product requirement. No dark toggle for v1 (Excalidraw itself is locked light in Phase 04).
7. **Density ~5–6.** Compact rows (28–32px), comfortable but information-dense like an IDE.
8. **AA contrast.** Text on surfaces ≥ 4.5:1. Muted text still ≥ 4.5:1 (use zinc-500 `#71717a` on white = ~4.6:1, acceptable; verify).

---

## 3. Tokens (final)

Defined in `app/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-bg: #ffffff;
  --color-surface: #fafafa;      /* panels, sidebar */
  --color-surface-2: #f4f4f5;    /* hover rows */
  --color-border: #e4e4e7;       /* zinc-200 */
  --color-border-strong: #d4d4d8;
  --color-text: #18181b;         /* zinc-900 */
  --color-text-muted: #71717a;   /* zinc-500 (AA on white) */
  --color-text-faint: #a1a1aa;   /* non-essential only */
  --color-accent: #E2603B;       /* coral — selected/active/focus/dirty */
  --color-accent-weak: #FCE8E1;  /* coral tint for active bg */
  --color-status-ok: #16a34a;
  --color-status-dirty: #B45309; /* amber */
  --color-danger: #DC2626;

  --radius-control: 8px;
  --radius-panel: 12px;

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --shadow-pop: 0 4px 16px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.06);
}

/* Motion tokens */
:root { --dur: 150ms; --ease: cubic-bezier(0.2, 0, 0, 1); }
@media (prefers-reduced-motion: reduce) {
  :root { --dur: 0ms; }
  * { animation: none !important; transition: none !important; }
}
```

---

## 4. Layout (VS Code-like)

```
┌──────────────────────────────────────────────────────────┐
│ TopBar: ☰ | owner/repo @ branch   ⟶  file.excalidraw  ●  │  Save  ⌄  ⟳
├───────────────┬──────────────────────────────────────────┤
│ Sidebar (260) │  Editor (Excalidraw, fills rest)          │
│ ▸ diagrams    │                                           │
│   auth.excalidraw ●                                        │
│   flow.excalidraw                                          │
│   assets/      │                                           │
└───────────────┴──────────────────────────────────────────┘
```
- Sidebar: fixed 260px (resizable optional v2), `bg-surface`, right border. Header row: repo name + search. Tree rows 30px, hover `surface-2`, selected `accent-weak` + left accent bar.
- Editor: pure white, Excalidraw owns the canvas; we only wrap it and place a thin status strip if needed (Excalidraw has its own footer; keep ours minimal to avoid clutter).
- TopBar height 44px, `border-b`, contains: repo/branch (mono, muted), active file name (sans, medium), dirty dot (`status-dirty` when unsaved), Save button (primary when dirty, otherwise quiet), overflow menu (rename/delete/new), sign-out.

---

## 5. Component specs

- **Button (primary):** `bg-text text-white` (near-black, not coral — coral is for selection/status to avoid over-saturating). Hover translate-y-0 → slight darken; active `translate-y-px`. Radius 8.
- **Button (quiet):** transparent, `text-muted`, hover `surface-2`. Used for non-destructive actions.
- **IconButton:** 32px square, `text-muted`, hover `surface-2`, focus ring `accent`. Icons Phosphor 1.5 stroke.
- **TreeRow:** 30px, 12px left pad per depth, chevron (Phosphor `CaretRight`/`CaretDown`) rotates 90ms, file icon (`File`) or folder (`Folder`/`FolderOpen`), name in sans 13px, dirty dot at right when unsaved.
- **Status (TopBar):** "● Unsaved" amber when dirty; "✓ Saved" muted when clean; "Saving…" with tiny pulse when committing. Transitions only on state change.
- **Toast:** bottom-right, `shadow-pop`, 12px radius, 320px, slide+fade 150ms, auto-dismiss 3s. Used for save success, errors, conflicts.
- **Modal (confirm delete / new file):** centered card `bg-white border shadow-pop`, 12px radius, focus-trapped, Esc closes, backdrop `rgba(24,24,27,0.32)`.
- **Skeleton:** shimmer-free (reduced-motion-safe) soft `surface-2` blocks in editor shape.

---

## 6. Accessibility & interaction

- All interactive elements keyboard-focusable with a visible `2px accent` ring (offset 2px).
- Tree: ArrowUp/Down navigate, Right expand, Left collapse, Enter open, `/` focus search, `Cmd/Ctrl+S` save.
- `aria-current="true"` on selected tree row; `aria-label` on icon-only buttons.
- Color is never the only signal: dirty shows a dot **and** "Unsaved" text; selected shows bar **and** bg tint.
- Maintain AA: verify `text-muted` (#71717a) on white; if borderline, darken to #6b7280.

---

## 7. Pre-review checklist (run before declaring UI done)

From `web-design-guidelines` skill — fetch and follow `command.md`:
```
curl -fsSL https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```
Confirm at minimum: consistent spacing scale, no stray default browser styles, focus states present, type scale intentional, no color-only state, motion reduced-motion safe. Also self-audit against `design-taste-frontend` anti-slop list (no AI-purple, no beige, one icon family, Geist, intentional accent, density).

---

## 8. Implementation steps

1. Finalize tokens in `globals.css`; wire `GeistSans`/`GeistMono` variable classes in `layout.tsx`.
2. Build `components/ui/`: `Button`, `IconButton`, `Toast` (provider + hook), `Modal`, `Skeleton`, `Spinner` (if needed).
3. Style `TopBar`, `FileTree`/`TreeNode`, `EditorPane` wrapper per §4–5.
4. Add reduced-motion + focus-ring styles globally.
5. Verify keyboard nav and AA contrast (DevTools). Run the web-interface-guidelines checklist.

---

## 9. Acceptance criteria

- [ ] Light theme only; coral accent used solely for selection/active/focus/dirty (not as a primary button fill).
- [ ] Geist Sans + Geist Mono applied; Phosphor icons only, 1.5 stroke, single family.
- [ ] Three-pane VS Code-like layout with 260px sidebar, 44px topbar, white editor.
- [ ] Dirty/ok/saving states shown with both color **and** text/icon.
- [ ] Keyboard nav for tree + save; focus rings visible; reduced-motion disables transitions.
- [ ] Passes the fetched web-interface-guidelines checklist and design-taste anti-slop audit.
- [ ] No AI-purple, no premium-beige, no centered hero, no decorative gradients.

---

## 10. Dependencies & env

- Requires: `geist`, `@phosphor-icons/react`, Tailwind v4 (Phase 01).
- Pre-review: fetch `web-interface-guidelines` `command.md` (network).
- No new env.

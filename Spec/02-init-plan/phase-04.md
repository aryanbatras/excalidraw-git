# Phase 04 — UI Overhaul (Borderless, Excalidraw-Matching Design)

## Goal
Transform the app from "VS Code clone" to "Excalidraw's own design language" — borderless, light, airy. Remove sidebar borders, use Excalidraw's font scale and color tokens, match button/dialog styles.

## Design Tokens (from Excalidraw)
Apply to `app/globals.css` `@theme`:

```css
@theme {
  /* Excalidraw accent */
  --color-accent: #6965db;        /* Excalidraw primary indigo */
  --color-accent-soft: #ececf4;   /* lavender pill background */

  /* Surface & text */
  --color-surface: #ffffff;        /* pure white canvas */
  --color-surface-raised: #fafafa; /* slightly lifted (sidebar bg) */
  --color-ink: #1b1b1f;           /* near-black text */
  --color-ink-muted: #999999;     /* muted text */

  /* Borders — use sparingly */
  --color-hairline: #e5e5e5;      /* subtle dividers (reduced opacity) */
  --color-border-dialog: #e5e5e5; /* dialog edges */

  /* Radius */
  --radius-card: 8px;             /* dominant radius */
  --radius-button: 6px;
  --radius-pill: 9999px;

  /* Typography — Excalidraw UI font */
  --font-ui: "Assistant", system-ui, -apple-system, sans-serif;
}
```

## Font Change
Replace Geist Sans with **Assistant** for all UI text. Assistant is already in `public/fonts/` (used by Excalidraw internally). Add `@font-face` for regular (400) and semibold (600) weights.

In `app/layout.tsx`, change the Geist font to load Assistant (or use the Excalidraw-provided font faces).

## Sidebar Changes
- Remove `border-r border-[--color-hairline]` from sidebar root
- Add subtle `box-shadow: 4px 0 24px rgba(0,0,0,0.04)` (right shadow only) for depth
- Background: `bg-[--color-surface-raised]` (fafafa) instead of white
- File tree hover: no border, soft lavender background (`bg-accent-soft/50`)
- Selected file: left accent bar (3px `bg-accent`) + soft lavender bg

## TopBar Changes
- Remove bottom border entirely
- Height: 48px (from 44px)
- Background: transparent (inherits page bg)
- Items: text-sm, `font-[--font-ui]`, weight 500
- Buttons: ghost style (no bg by default), hover `bg-[--color-surface-raised]`
- Accent elements: only on dirty indicator, active states

## Editor Container
- Remove `border border-[--color-hairline]` around Excalidraw
- Excalidraw sits directly on the white page background
- Subtle inset shadow: `box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04)`

## Modals / Dialogs
- Remove hard borders
- Use `border-radius: 12px` (larger than cards)
- Background: white
- Overlay: `rgba(0,0,0,0.4)` (softer)
- Close button: ghost icon, no border
- Title: font-weight 600, 18px
- Body: font-weight 400, 14px, `text-ink-muted`

## Buttons
- **Primary (Create, Sign in):** `bg-accent text-white font-semibold` hover: `bg-accent/90`
- **Secondary (Cancel):** transparent bg, `text-ink`, hover: `bg-surface-raised`
- **Ghost (icon buttons):** transparent, `text-ink-muted`, hover: `text-ink bg-surface-raised`
- All buttons: `radius-button (6px)`, padding `10px 18px`

## Status Bar / Notifications
- Replace "Saved"/"Saving…" with minimal inline text (13px, muted)
- Dirty indicator: small coral dot (existing `#E2603B`)
- Error toast: white bg, subtle shadow, red text

## Spinner
- Replace phosphor Spinner with a simple CSS spinner (4px border, accent color)
- 16×16px, used inline in buttons and loading states

## Login Page
- Centered card (max-w 400px), no border, subtle shadow
- "Sign in with GitHub" button: GitHub black `#18181b` bg, white text, Octicon logo
- Title: "Excalidraw + Git" in Assistant semibold
- Subtitle: "Your diagrams, backed by GitHub" in muted

## Files to Modify
- `app/globals.css` — replace all design tokens with Excalidraw values
- `app/layout.tsx` — swap Geist → Assistant font
- `components/sidebar/Sidebar.tsx` — remove border, add shadow, new bg
- `components/topbar/TopBar.tsx` — remove border, adjust height/spacing
- `components/editor/EditorPane.tsx` — remove editor border, add inset shadow
- `components/ui.tsx` — restyle Button, IconButton, Modal to match
- `components/AppShell.tsx` — update status indicators
- `components/RepoPicker.tsx` — style card grid with new tokens
- `components/auth/LoginButton.tsx` — GitHub button style

## Acceptance Criteria
- [ ] No visible hard borders anywhere in the app (shadows/depth only)
- [ ] Assistant font used for all UI text
- [ ] Sidebar has subtle right shadow, no border
- [ ] TopBar is borderless, 48px height
- [ ] Editor sits on white background with inset shadow
- [ ] Modals are borderless with 12px radius
- [ ] All buttons follow primary/secondary/ghost pattern
- [ ] Login page matches Excalidraw's clean aesthetic
- [ ] No visual regressions in layout or spacing

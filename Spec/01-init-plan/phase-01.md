# Phase 01 — Foundation, Stack & Architecture

> **Status:** Phase 1 of 11 · **Build order:** do this first; every later phase assumes this scaffold exists.
> **Research basis:** Next.js 16.3 (App Router, Turbopack, React 19) · `@excalidraw/excalidraw@0.18.1` (ESM) · Auth.js v5 (`next-auth`) · Octokit `rest.git` · GitHub REST (Contents + Git Database) · Vercel serverless route handlers.

---

## 1. Purpose & scope

Stand up the project skeleton that every later phase builds on:

- A Next.js 16 (App Router) app with TypeScript, Tailwind v4, and Turbopack.
- All third-party dependencies installed and verified to exist in `package.json` (mandatory per design-taste skill §3.F).
- `next.config.ts` configured for Excalidraw.
- A clean, deliberate folder structure that separates **server-only** code (GitHub API, auth) from **client** code (editor, sidebar, persistence).
- Environment variable contract and `.env.example`.
- The single source-of-truth **architecture diagram** and the invariant that the whole product is "GitHub as the database, browser as a working copy, Vercel functions as the only backend."

This phase produces **no user-facing features** — only the machine they run on.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) | Next 16.3.3 is current LTS (Aug 2026); Turbopack stable; RSC + Route Handlers run on Vercel. |
| Language | TypeScript (strict) | Standard for production-oriented apps. |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | Design-taste skill §3.A default; v4 uses `@tailwindcss/postcss`, not the legacy `tailwindcss` PostCSS plugin. |
| Editor | `@excalidraw/excalidraw@^0.18.1` | 0.18.1 is the current stable (Apr 2026), ESM. Supports React 19. |
| Auth | `next-auth` (Auth.js v5) | Mature, handles PKCE + CSRF `state`, secure httpOnly session cookie. Hand-rolling OAuth rejected (OWASP: 22% of OAuth incidents from missing CSRF). |
| GitHub SDK | `octokit` (`@octokit/rest`) | Official, handles auth, pagination, tree truncation, rate limits. Writes via `rest.git.*`; reads via `rest.repos` + `rest.git`. |
| Client state | `zustand` | Lightweight global store for tree/selection/dirty; avoids prop-drilling; keeps Excalidraw uncontrolled. |
| Local mirror | `idb` (IndexedDB) | 5MB localStorage cap is unsafe for scenes w/ images; `getFiles()` is cleared on unmount so we must persist in `onChange` (Excalidraw issue #4961). |
| Data fetching | `swr` | Clean loading/error/cache for GETs (repos, tree, file); mutations done via route handlers. |
| Icons | `@phosphor-icons/react` | Design-taste skill §3.C priority order; **lucide discouraged**. One family, `strokeWidth={1.5}`. |
| Fonts | `geist` (Geist Sans + Geist Mono) | Design-taste skill §4.1 discourages Inter as default; Geist is the intentional dev-tool choice and self-hostable via `next/font`. |

---

## 3. Architecture (the invariant)

```
                         ┌─────────────────────────────┐
                         │   GitHub Repository          │
                         │   (source of truth)          │
                         │   diagrams/*.excalidraw      │
                         │   assets/*  (optional)       │
                         └──────────────┬──────────────┘
                                        │ REST (Contents + Git Database)
                         ┌──────────────┴──────────────┐
                         │   Vercel Route Handlers      │
                         │   /api/auth/*  (Auth.js)     │
                         │   /api/repos                 │
                         │   /api/tree                  │
                         │   /api/file                  │
                         │   /api/commit                │
                         │   → Octokit + token from     │
                         │     encrypted JWT cookie     │
                         └──────────────┬──────────────┘
                                        │ HTTPS / JSON
                         ┌──────────────┴──────────────┐
                         │   Next.js (App Router)       │
                         │   Server Components (auth,   │
                         │     layout, repo guard)      │
                         │   Client Components:         │
                         │     Sidebar (tree)           │
                         │     Editor (Excalidraw)      │
                         │     TopBar (save/status)     │
                         │   Zustand store              │
                         │   IndexedDB mirror (crash)   │
                         └─────────────────────────────┘
```

**Boundaries (hard rules):**
1. The **GitHub token never reaches client JS**. Route handlers read it from the encrypted JWT cookie via `getToken(req)`.
2. The **browser never talks to GitHub directly-exposed credentials**. All GitHub calls are server-side in route handlers.
3. Excalidraw is **uncontrolled**: `initialData` set once at mount; outward mirror via `onChange`; never feed state back in.
4. A `.excalidraw` file **is** the document. No database, no custom file format, no extra schema.

---

## 4. Project structure

```
gitexclidraw/
├─ app/
│  ├─ layout.tsx                 # root layout: fonts, providers, EXCALIDRAW_ASSET_PATH script
│  ├─ page.tsx                   # post-login home → repo guard → editor shell
│  ├─ login/page.tsx             # "Continue with GitHub"
│  ├─ api/
│  │  ├─ auth/[...nextauth]/route.ts   # Auth.js handlers (GET, POST)
│  │  ├─ repos/route.ts                 # list user repos
│  │  ├─ tree/route.ts                  # list one directory (lazy)
│  │  ├─ file/route.ts                  # GET scene by path
│  │  └─ commit/route.ts                # PUT/DELETE → Git Database commit
│  └─ globals.css                # Tailwind + design tokens
├─ components/
│  ├─ editor/
│  │  ├─ ExcalidrawWrapper.tsx   # "use client", dynamic ssr:false, holds excalidrawAPI ref
│  │  └─ EditorPane.tsx          # mounts wrapper + keyboard save + dirty wiring
│  ├─ sidebar/
│  │  ├─ FileTree.tsx            # recursive, lazy, keyboard-navigable
│  │  └─ TreeNode.tsx
│  ├─ topbar/
│  │  └─ TopBar.tsx              # repo name, file name, dirty dot, Save, autosave status, logout
│  └─ ui/                       # small primitives (Button, IconButton, Spinner, Toast)
├─ lib/
│  ├─ auth.ts                    # NextAuth config (providers, callbacks, scope)
│  ├─ auth-token.ts              # getToken(req) → access_token (server only)
│  ├─ github.ts                  # Octokit wrapper: getTree, getBlob, commitFiles, getRepos, getUser
│  ├─ excalidraw-serialize.ts    # serialize/deserialize helpers, empty-doc factory
│  ├─ idb.ts                     # IndexedDB mirror (load/save scene per path)
│  ├─ store.ts                   # Zustand store (repos, tree cache, selection, dirty map)
│  └─ types.ts                   # shared types (RepoRef, TreeEntry, Scene, etc.)
├─ styles/ (optional)            # if not using globals.css for tokens
├─ public/                       # copied Excalidraw fonts (fallback) — see Phase 04
├─ types/next-auth.d.ts          # module augmentation for session/token
├─ next.config.ts
├─ tailwind.config.ts (if needed; v4 uses CSS-first)
├─ tsconfig.json
├─ .env.example
└─ middleware.ts                 # protect app routes
```

---

## 5. Dependencies (install commands — verify each exists before importing)

```bash
# Core
npm install next@latest react@latest react-dom@latest

# Excalidraw (pin current stable)
npm install @excalidraw/excalidraw@^0.18.1

# Auth (Auth.js v5)
npm install next-auth

# GitHub SDK
npm install octokit

# Client state, local mirror, data fetching
npm install zustand idb swr

# Icons (Phosphor — not lucide)
npm install @phosphor-icons/react

# Fonts (Geist, self-hosted via next/font)
npm install geist
```

> **Mandatory (design-taste §3.F):** before any `import`, confirm the package is in `package.json`. The list above is the allow-list; do not add libraries outside it without revisiting this spec.

---

## 6. Configuration

### 6.1 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Excalidraw ships modern ESM/JSX that Next must transpile.
  transpilePackages: ["@excalidraw/excalidraw"],
  // Excalidraw pulls in a few node-ish deps; keep on Node runtime (not edge).
  // Server Actions / Route Handlers default to Node — do not force edge for /api/*.
};

export default nextConfig;
```

### 6.2 `middleware.ts` (route guard)

```ts
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

The `auth` export from `lib/auth.ts` includes an `authorized` callback that redirects unauthenticated users to `/login`. `/api/auth/*` and static assets are excluded so OAuth can complete.

### 6.3 `.env.example`

```env
# Auth.js
AUTH_SECRET=                  # openssl rand -base64 32
AUTH_GITHUB_ID=              # GitHub OAuth App client id
AUTH_GITHUB_SECRET=          # GitHub OAuth App client secret

# Public (optional, used by client only if needed; we keep token server-side)
NEXT_PUBLIC_APP_NAME="Excalidraw Git"
```

> Note: there is **no** `NEXT_PUBLIC_GITHUB_TOKEN` and never will be. The token lives only in the encrypted session cookie.

---

## 7. Design tokens (light-locked, applied globally — see Phase 08 for full rationale)

Defined in `app/globals.css` as CSS variables consumed by Tailwind v4 (`@theme`). Summary (full in Phase 08):

- `--bg`: `#ffffff` · `--surface`: `#fafafa` · `--border`: `#e4e4e7` (zinc-200)
- `--text`: `#18181b` (zinc-900) · `--text-muted`: `#71717a` (zinc-500)
- `--accent`: `#E2603B` (restrained coral — echoes Excalidraw, not AI-purple)
- `--status-dirty`: `#B45309` (amber) · `--status-ok`: `#16a34a` (emerald)
- Radii: controls `8px`, panels `12px`. One scale, locked.
- Fonts: Geist Sans (UI), Geist Mono (paths/filenames/metadata).

---

## 8. Implementation steps

1. `npx create-next-app@latest` → TypeScript, Tailwind v4, App Router, `src/`? **No** — use root `app/` (matches structure above; choose "no src dir"). Accept Turbopack.
2. Install all dependencies from §5. Verify with `npm ls @excalidraw/excalidraw next-auth octokit zustand idb swr @phosphor-icons/react geist`.
3. Add `transpilePackages` to `next.config.ts`.
4. Create `lib/types.ts` with the shared shapes (Phase 03/04 refine these):
   ```ts
   export type RepoRef = { owner: string; repo: string; branch: string };
   export type TreeEntry = {
     name: string; path: string;
     type: "file" | "dir";
     sha?: string; size?: number;
     isExcalidraw: boolean;
   };
   export type Scene = {
     type: "excalidraw"; version: number; source: string;
     elements: unknown[]; appState: Record<string, unknown>;
     files: Record<string, unknown>;
   };
   ```
5. Create `middleware.ts` and the `lib/auth.ts` stub (filled in Phase 02) so the app builds.
6. Create `app/globals.css` with Tailwind import + token block; wire `GeistSans`/`GeistMono` in `app/layout.tsx`.
7. Create placeholder `app/login/page.tsx` (real button in Phase 02) and `app/page.tsx` (repo guard in Phase 03).
8. Confirm `npm run build` succeeds with the scaffold (Excalidraw must be dynamically imported with `ssr:false` wherever used — set that up now in `ExcalidrawWrapper.tsx` even before wiring logic, to validate the build).

---

## 9. Edge cases & failure modes

- **Excalidraw build crash (`window is not defined`):** must use `dynamic(() => import(...), { ssr: false })` inside a `"use client"` wrapper. Validate in this phase.
- **Fonts 404:** if `EXCALIDRAW_ASSET_PATH` misconfigured, canvas still works but hand-drawn font falls back. Phase 04 specifies the fix (copy fonts to `public/fonts`).
- **Token in client:** guard against ever returning `access_token` from the `session` callback. Phase 02 enforces this.
- **Env missing in prod:** Vercel must have `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` or auth fails silently. Phase 10 checklist.

---

## 10. Acceptance criteria

- [ ] `npm run build` passes with Excalidraw present and no SSR `window` errors.
- [ ] All §5 dependencies installed and listed in `package.json`.
- [ ] `next.config.ts` has `transpilePackages: ["@excalidraw/excalidraw"]`.
- [ ] `middleware.ts` redirects unauthenticated users away from app routes but allows `/api/auth/*` and `/login`.
- [ ] Design tokens + Geist fonts load; a plain white page renders with the chosen neutral palette.
- [ ] Folder structure matches §4 exactly (folders can be empty stubs for now).
- [ ] `.env.example` documents the three required secrets; no token is ever marked `NEXT_PUBLIC_`.

---

## 11. Dependencies & env required before next phase

- All §5 packages installed.
- GitHub OAuth App **not yet required** (Phase 02 creates it), but `AUTH_GITHUB_*` values must exist as placeholders for the build to typecheck if referenced.
- Next 16, React 19, Tailwind v4 confirmed.

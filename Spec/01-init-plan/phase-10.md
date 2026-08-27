# Phase 10 — Deployment (Vercel + OAuth App)

> **Status:** Phase 10 of 11 · **Depends on:** Phases 01–09 complete and building.
> **Research basis:** Vercel project (Node runtime, not edge, for Octokit + Auth.js) · GitHub OAuth App callback URLs (prod) · `AUTH_SECRET`/`AUTH_GITHUB_*` as Vercel env (encrypted) · Next.js 16 build (`next build` via Turbopack) · `VERCEL_URL` for callback composition · framework preset auto-detect.

---

## 1. Purpose & scope

Ship the app to production on Vercel with a correctly configured GitHub OAuth App, so real users can sign in and read/write their repos.

Checklist-driven phase:
- Create/verify GitHub OAuth App with production callback.
- Connect repo to Vercel, set env vars.
- Confirm build + runtime (Node runtime for `/api/*`).
- Smoke-test login → repo list → open → edit → autosave → appears in GitHub.
- Document custom-domain option (optional).

---

## 2. Decisions

| Topic | Decision | Evidence |
|---|---|---|
| Host | Vercel (per product brief) | Serverless route handlers = our only backend; Vercel runs them on Node. |
| Runtime | **Node.js** for `/api/*` (default for Route Handlers) | Octokit + Auth.js need Node crypto/network; do NOT force `export const runtime = "edge"`. |
| OAuth callback | `https://<vercel-domain>/api/auth/callback/github` | Must match GitHub OAuth App exactly or login fails. |
| Env | `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` set in Vercel (encrypted, production + preview) | Auth.js requires `AUTH_SECRET`; GitHub creds needed for login. |
| Build | `next build` (Turbopack in 16) | Standard; ensure no `ssr` Excalidraw error in prod build. |
| Region | Auto (or nearest to GitHub API / user) | Latency only; no functional impact. |
| Custom domain | Optional: set in Vercel, then add callback URL to GitHub OAuth App | Keeps one canonical callback. |

---

## 3. Step-by-step

1. **GitHub OAuth App (prod):** in the existing app (Phase 02), add a second callback URL `https://<vercel-domain>/api/auth/callback/github` (and preview `https://<slug>.vercel.app/...`). Keep dev URL too.
2. **Vercel project:** import the git repo → framework Next.js (auto) → build command default → Node version latest (18+; 20 recommended).
3. **Env vars:** add `AUTH_SECRET` (generate: `openssl rand -base64 32`), `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`. Set for Production and Preview.
4. **Deploy:** trigger deploy; watch build logs for the Excalidraw `transpilePackages` / `ssr:false` success.
5. **Post-deploy verify:**
   - Visit prod URL → `/login` → "Continue with GitHub" → authorize → redirected to `/`.
   - Pick a repo → open a `.excalidraw` → draw → wait for 15-min autosave **or** press Save → check the file changed in GitHub.
   - Confirm no token in client network responses (DevTools).
6. **Optional:** custom domain + callback update.

---

## 4. Edge cases & failure modes

- **Login loops / `AUTH_SECRET` mismatch:** ensure the SAME `AUTH_SECRET` across deploys; regenerating invalidates existing sessions (users re-login). Use Vercel env, not build-time only.
- **Callback mismatch (GitHub 404/redirect_uri):** exact string match required (trailing slash, http vs https). Fix in GitHub OAuth App.
- **Build fails on Excalidraw (`window`):** means a component imported Excalidraw without `ssr:false`. Audit imports (Phase 04).
- **Octokit in edge:** if someone sets `runtime="edge"` on a route, Octokit/Auth.js may break. Keep Node (default).
- **Rate limits in prod:** shared IP on Vercel can hit GitHub 5000/hr faster with many users; our client cache (Phase 03) mitigates. Document as known scale limit (v2: per-user token already used, so it's the *user's* 5000/hr — fine).

---

## 5. Acceptance criteria

- [ ] Production URL loads; GitHub login completes and returns to app.
- [ ] OAuth App has correct prod (and preview) callback URLs.
- [ ] `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` set in Vercel (Production+Preview).
- [ ] Prod build passes with Excalidraw present.
- [ ] End-to-end: edit → save → change visible in the user's GitHub repo.
- [ ] No client-exposed GitHub token in production.
- [ ] (Optional) custom domain configured with matching callback.

---

## 6. Dependencies & env

- Requires: all prior phases; GitHub OAuth App; Vercel account.
- Env: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` (production + preview).

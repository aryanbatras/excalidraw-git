# Phase 02 — Authentication (GitHub OAuth via Auth.js v5)

> **Status:** Phase 2 of 11 · **Depends on:** Phase 01 (scaffold, `next-auth` installed, `middleware.ts` stub).
> **Research basis:** Auth.js v5 (`next-auth`) GitHub provider · `authorization.params.scope` · `jwt`/`session` callbacks · `next-auth/jwt` `getToken` · GitHub OAuth App `repo` scope · PKCE default · CSRF `state` default.

---

## 1. Purpose & scope

Implement sign-in with GitHub such that:

- The user clicks **"Continue with GitHub"** and authorizes the app.
- We obtain a GitHub **access token** with `repo` scope (read/write to public **and** private repos).
- The token is stored **only** in the encrypted session JWT cookie (httpOnly, signed with `AUTH_SECRET`). It is **never** exposed to client-side JavaScript.
- Server route handlers read the token via `getToken(req)` (from `next-auth/jwt`), never from `useSession()`.
- Authenticated users reach the app; unauthenticated users are redirected to `/login`.
- Logout clears the session cookie.

This phase delivers auth end-to-end but **no GitHub data calls yet** (those are Phase 03+). The `github.ts` SDK wrapper is created here as a stub so later phases import a stable interface.

---

## 2. Research-backed decisions

| Topic | Decision | Evidence |
|---|---|---|
| Library | Auth.js v5 (`next-auth`) | Handles PKCE (default in v5), CSRF `state` (default), secure cookie. |
| Provider scope | `read:user user:email repo` | `repo` grants full read/write to public+private repo **contents** (required for file R/W). GitHub tightened default scopes in v5 — `user:email` must be declared explicitly or `profile.email` is null. |
| Session strategy | JWT (encrypted cookie) | Default; works on Vercel Node runtime; no DB needed (keeps architecture "brutally small"). |
| Token storage | In JWT only (via `jwt` callback), **not** in session | The `session` callback's return is what reaches the browser via `useSession()`. Putting `access_token` there leaks it to client JS — forbidden by the security requirement. |
| Server token read | `getToken(req)` from `next-auth/jwt` | Decrypts the httpOnly cookie server-side and returns the JWT payload (incl. our custom `accessToken`). Available in Route Handlers and Server Actions where `req` exists. |
| Client session | Expose only `user.login`, `user.name`, `user.avatar` (non-secret) | Enough for UI; token stays server-side. |
| Middleware | `export { auth as middleware }` + `authorized` callback | Optimistic redirect when no session cookie; real check in route handlers. |
| PKCE | Use default (enabled) | v5 enables PKCE for GitHub by default; do not disable. |

---

## 3. Files to create / modify

### 3.1 `lib/auth.ts` — Auth.js config (the heart)

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

export const authConfig = {
  providers: [
    GitHub({
      // AUTH_GITHUB_ID / AUTH_GITHUB_SECRET are auto-read by Auth.js v5.
      authorization: {
        params: {
          // repo = full read/write to contents (public + private).
          // user:email needed because v5 no longer requests it by default.
          scope: "read:user user:email repo",
        },
      },
      // GitHub tokens from OAuth Apps do not expire (unless expiring-tokens beta).
      // We do not request offline/refresh; the access token is long-lived.
    }),
  ],
  // Redirect unauthenticated users to /login (optimistic; route handlers re-check).
  callbacks: {
    async jwt({ token, account, profile }) {
      // account is present only at sign-in. Stash the provider token in the JWT.
      if (account) {
        token.accessToken = account.access_token as string;
        // GitHub profile.login is the username — non-secret, useful for UI/API.
        token.login = (profile as { login?: string }).login;
      }
      return token;
    },
    async session({ session, token }) {
      // IMPORTANT: do NOT copy token.accessToken into session.
      // session travels to the browser; the token must not.
      if (session.user) {
        session.user.login = token.login as string;
        // name/avatar already populated by Auth.js from the profile.
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      if (!isLoggedIn && !isLoginPage) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
```

> **Security note:** `token.accessToken` lives only inside the encrypted JWT cookie. The browser receives `session.user.login/name/image` only. `getToken(req)` (server) can read `accessToken`; `useSession()` (client) cannot.

### 3.2 `types/next-auth.d.ts` — module augmentation

```ts
import NextAuth, { type DefaultSession } from "next-auth";
import { type JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      login: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    login?: string;
  }
}
```

### 3.3 `lib/auth-token.ts` — server-only token reader

```ts
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Reads the GitHub access token from the encrypted session cookie.
// Use ONLY inside Route Handlers / Server Actions (where `req` exists).
export async function getGithubToken(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  return (token?.accessToken as string) ?? null;
}
```

### 3.4 `app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

### 3.5 `app/login/page.tsx` (client)

```tsx
"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[--surface]">
      <div className="w-[320px] rounded-[12px] border border-[--border] bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-[--text]">Excalidraw Git</h1>
        <p className="mt-1 text-sm text-[--text-muted]">
          Your Excalidraw, backed by Git.
        </p>
        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          className="mt-6 w-full rounded-[8px] bg-[--text] px-4 py-2 text-sm font-medium text-white transition active:translate-y-px"
        >
          Continue with GitHub
        </button>
      </div>
    </main>
  );
}
```

### 3.6 `lib/github.ts` — Octokit wrapper (stub, completed in Phase 03/05/06)

```ts
import { Octokit } from "octokit";

// Creates an Octokit authenticated with the user's GitHub token.
// token comes from getGithubToken(req) — never from the client.
export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}
```

(Add `getRepos`, `getTree`, `getBlob`, `commitFiles`, `getUser` in later phases; keep the file importing `Octokit` only so it typechecks now.)

---

## 4. GitHub OAuth App setup (one-time, manual)

The app needs a GitHub OAuth App. **This is a manual step** (cannot be coded):

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**.
2. Homepage URL: `http://localhost:3000` (dev) and the Vercel URL (prod).
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github` (dev) and `https://<vercel>/api/auth/callback/github` (prod).
4. Copy **Client ID** → `AUTH_GITHUB_ID`; generate **Client Secret** → `AUTH_GITHUB_SECRET`.
5. No special "Require PKCE" toggle needed — Auth.js v5 enforces PKCE by default.

> The app does **not** need a GitHub *App* (fine-grained permissions); an OAuth App with `repo` scope is sufficient and simpler. Fine-grained PATs would complicate the flow and are not used.

---

## 5. Edge cases & failure modes

- **`profile.email` is null:** GitHub hides email by default. We do not depend on email; we use `profile.login` (username) for the committer identity fallback (`${login}@users.noreply.github.com`) in Phase 05/06.
- **Token revoked / invalid:** GitHub calls return 401 in route handlers → respond 401 with a structured error; client shows a toast "GitHub access expired — please sign in again" and offers re-login.
- **User denies scope:** GitHub redirects with `?error=access_denied`. Auth.js surfaces an error; `/login` should render a friendly message, not crash.
- **Missing `AUTH_SECRET`:** Auth.js throws at runtime. Phase 10 verifies it's set in Vercel.
- **Cookie not httpOnly / not secure in prod:** Auth.js sets these automatically for `https` origins; ensure prod uses HTTPS (Vercel does).
- **`session` accidentally leaks token:** guarded by §3.1 comment + code review. Add a lint/CI check if possible: never return `accessToken` from the `session` callback.

---

## 6. Implementation steps

1. Create `lib/auth.ts`, `types/next-auth.d.ts`, `lib/auth-token.ts`, `app/api/auth/[...nextauth]/route.ts`.
2. Build `app/login/page.tsx` with the GitHub button.
3. Stub `lib/github.ts` with `getOctokit(token)`.
4. Create the GitHub OAuth App (§4) and put credentials in `.env.local` (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`).
5. Run `npm run dev`; click login → authorize → land on `/` (which is a placeholder until Phase 03).
6. Verify in devtools that **no** `access_token` string appears in any client-side network response or `useSession()` output (search the Redux/Network tab).
7. Verify `getGithubToken(req)` returns the token inside a route handler (temporary debug log, removed after).

---

## 7. Acceptance criteria

- [ ] Clicking "Continue with GitHub" completes OAuth and returns to `/`.
- [ ] Unauthenticated visits to app routes redirect to `/login`.
- [ ] `session.user.login` is available client-side; `session.accessToken` / `user.access_token` are **absent** from the client session.
- [ ] A Route Handler using `getGithubToken(req)` successfully receives a non-null GitHub token.
- [ ] Logout clears the session and returns to `/login`.
- [ ] GitHub OAuth App created; callback URLs correct for dev + prod.
- [ ] Scope requested is exactly `read:user user:email repo` (visible in the GitHub authorize screen).
- [ ] `types/next-auth.d.ts` augments `Session.user.login` and `JWT.accessToken/login`; `tsc` passes.

---

## 8. Dependencies & env

- Requires: `next-auth` (Phase 01), GitHub OAuth App credentials.
- Env: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`.
- No new npm packages in this phase.

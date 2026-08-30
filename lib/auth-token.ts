import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Reads the GitHub access token. Priority:
// 1. GITHUB_TOKEN env var (PAT — always fresh, most reliable)
// 2. Session JWT accessToken (from OAuth flow — may be expired)
export async function getGithubToken(req: NextRequest): Promise<string | null> {
  // Always prefer the env var PAT if set
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  // Fall back to session token
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  return (token?.accessToken as string) ?? null;
}

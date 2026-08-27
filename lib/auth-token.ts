import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Reads the GitHub access token from the encrypted session JWT cookie.
// Use ONLY inside Route Handlers / Server Actions where `req` exists.
export async function getGithubToken(req: NextRequest): Promise<string | null> {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  return (token?.accessToken as string) ?? null;
}

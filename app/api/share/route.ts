import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { getRepoVisibility, getFileScene } from "@/lib/github";
import type { RepoRef } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseParams(req: NextRequest): RepoRef & { path: string; ref?: string } | null {
  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");
  const path = req.nextUrl.searchParams.get("path");
  const ref = req.nextUrl.searchParams.get("ref") ?? undefined;
  if (!owner || !repo || !branch || !path) return null;
  return { owner, repo, branch, path, ref };
}

// GET /api/share -> public, unauthenticated read of a scene for a shared link.
// Refuses private repos. Prefers the server-held GITHUB_TOKEN; falls back to the
// session token when available (no session => anonymous GitHub read).
export async function GET(req: NextRequest) {
  const params = parseParams(req);
  if (!params) return NextResponse.json({ error: "missing params" }, { status: 400 });
  const { owner, repo, branch, path, ref } = params;

  const token = await getGithubToken(req);

  try {
    // If we have a token, verify the target repo is PUBLIC (even if the link was
    // created while public, the repo may have been privatized since — refuse).
    if (token) {
      const vis = await getRepoVisibility(token, owner, repo);
      if (vis.private) {
        return NextResponse.json(
          { error: "This diagram's repository is private and cannot be shared." },
          { status: 403 },
        );
      }
    }

    // Anonymous fallback: read the scene without any token. GitHub returns 404
    // for private/absent resources to non-authenticated callers.
    const result = await getFileScene(token ?? "", { owner, repo, branch }, path, ref);
    return NextResponse.json({ scene: result.scene, sha: result.sha, size: result.size });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 403 || status === 404) {
      return NextResponse.json(
        { error: "This diagram is not publicly available." },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

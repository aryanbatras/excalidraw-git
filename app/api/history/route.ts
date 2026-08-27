import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { listCommits } from "@/lib/github";
import type { RepoRef } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRepo(req: NextRequest): RepoRef | null {
  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");
  if (!owner || !repo || !branch) return null;
  return { owner, repo, branch };
}

export async function GET(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const path = req.nextUrl.searchParams.get("path");
  if (!repo || !path) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const commits = await listCommits(token, repo, path);
    return NextResponse.json({ commits });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

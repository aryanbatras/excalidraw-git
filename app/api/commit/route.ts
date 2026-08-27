import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { commitFiles } from "@/lib/github";
import type { RepoRef } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRepo(req: NextRequest): RepoRef | null {
  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");
  if (!owner || !repo || !branch) return null;
  return { owner, repo, branch };
}

// POST /api/commit (manual) or PUT /api/commit (auto) -> same body
export async function POST(req: NextRequest) {
  return handleCommit(req);
}
export async function PUT(req: NextRequest) {
  return handleCommit(req);
}

async function handleCommit(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const body = await req.json();
  const files = body?.files;
  const message = body?.message;
  if (!repo || !Array.isArray(files) || !message) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  try {
    const { commitSha } = await commitFiles(token, repo, files, message);
    return NextResponse.json({ commitSha, paths: files.map((f: { path: string }) => f.path) });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

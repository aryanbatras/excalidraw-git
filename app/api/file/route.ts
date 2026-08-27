import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { getFileScene, commitFiles, deleteFile, renameFile } from "@/lib/github";
import type { RepoRef } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseRepo(req: NextRequest): RepoRef | null {
  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  const branch = req.nextUrl.searchParams.get("branch");
  if (!owner || !repo || !branch) return null;
  return { owner, repo, branch };
}

// GET /api/file -> read scene
export async function GET(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const path = req.nextUrl.searchParams.get("path");
  const ref = req.nextUrl.searchParams.get("ref") ?? undefined;
  if (!repo || !path) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const { scene, sha, size } = await getFileScene(token, repo, path, ref);
    return NextResponse.json({ sha, size, scene });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// POST /api/file -> create
export async function POST(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const body = await req.json();
  const path = body?.path;
  const content = body?.content; // base64 scene
  if (!repo || !path || !content) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const { commitSha } = await commitFiles(token, repo, [{ path, content }], `create ${path}`);
    return NextResponse.json({ commitSha });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// DELETE /api/file -> delete
export async function DELETE(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const path = req.nextUrl.searchParams.get("path");
  if (!repo || !path) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const { commitSha } = await deleteFile(token, repo, path, `delete ${path}`);
    return NextResponse.json({ commitSha });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// PATCH /api/file -> rename/move
export async function PATCH(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = parseRepo(req);
  const body = await req.json();
  const from = body?.from;
  const to = body?.to;
  const oldBlobSha = body?.oldBlobSha;
  if (!repo || !from || !to || !oldBlobSha) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const { commitSha } = await renameFile(token, repo, from, to, oldBlobSha, `rename ${from} → ${to}`);
    return NextResponse.json({ commitSha });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

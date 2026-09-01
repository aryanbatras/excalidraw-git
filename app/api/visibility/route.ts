import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { getRepoVisibility } from "@/lib/github";

export const dynamic = "force-dynamic";

// GET /api/visibility?owner=&repo= -> { private, visibility }
// Used by the share flow to refuse sharing private repositories.
export async function GET(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const owner = req.nextUrl.searchParams.get("owner");
  const repo = req.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "missing params" }, { status: 400 });
  try {
    const vis = await getRepoVisibility(token, owner, repo);
    return NextResponse.json(vis);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

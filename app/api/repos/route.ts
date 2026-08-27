import { NextRequest, NextResponse } from "next/server";
import { getGithubToken } from "@/lib/auth-token";
import { getRepos, createRepo } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  try {
    const repos = await getRepos(token, search);
    return NextResponse.json({ repos });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

// POST /api/repos -> create a new repository
export async function POST(req: NextRequest) {
  const token = await getGithubToken(req);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = (body?.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  try {
    const repo = await createRepo(token, {
      name,
      private: body?.private === true,
      description: body?.description,
    });
    return NextResponse.json({ repo });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status ?? 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

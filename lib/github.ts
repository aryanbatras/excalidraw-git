import { Octokit } from "octokit";
import type { RepoRef, RepoSummary, TreeEntry, Scene } from "./types";

export function getOctokit(token: string) {
  return new Octokit({ auth: token });
}

const EXCALIDRAW_EXT = ".excalidraw";

function isExcalidraw(name: string) {
  return name.endsWith(EXCALIDRAW_EXT);
}

// ---- Repos ----------------------------------------------------------------

export async function getRepos(token: string, search?: string): Promise<RepoSummary[]> {
  const octokit = getOctokit(token);
  const repos: RepoSummary[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: perPage,
      page,
      sort: "pushed",
    });
    if (data.length === 0) break;
    for (const r of data) {
      repos.push({
        owner: r.owner.login,
        name: r.name,
        defaultBranch: r.default_branch,
        private: r.private,
      });
    }
    if (data.length < perPage) break;
    page++;
  }
  const filtered = search
    ? repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(search.toLowerCase()))
    : repos;
  return filtered;
}

export async function getDefaultBranch(token: string, owner: string, repo: string) {
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return data.default_branch;
}

// Create a brand-new repository for the authenticated user.
export async function createRepo(
  token: string,
  opts: { name: string; private?: boolean; description?: string },
): Promise<RepoSummary> {
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name: opts.name,
    private: opts.private ?? false,
    description: opts.description,
    auto_init: true, // gives the default branch an initial commit immediately
  });
  return {
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
    private: data.private,
  };
}

// ---- Tree (lazy per directory) -------------------------------------------

export async function getDir(
  token: string,
  repo: RepoRef,
  path: string,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const octokit = getOctokit(token);
  let data: Awaited<ReturnType<typeof octokit.rest.repos.getContent>>["data"];
  try {
    const res = await octokit.rest.repos.getContent({
      owner: repo.owner,
      repo: repo.repo,
      ref: repo.branch,
      path,
    });
    data = res.data;
  } catch (e) {
    // 404 (or no commits yet) → the directory/repo is simply empty.
    if ((e as { status?: number })?.status === 404) {
      return { entries: [], truncated: false };
    }
    throw e;
  }
  if (!Array.isArray(data)) {
    return { entries: [], truncated: false };
  }
  const entries: TreeEntry[] = data.map((item) => {
    const type = item.type === "dir" ? "dir" : "file";
    return {
      name: item.name,
      path: item.path,
      type,
      sha: item.sha,
      size: "size" in item ? item.size : undefined,
      isExcalidraw: type === "file" && isExcalidraw(item.name),
    };
  });
  // directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { entries, truncated: data.length >= 1000 };
}

// ---- File read ------------------------------------------------------------

export async function getFileScene(
  token: string,
  repo: RepoRef,
  path: string,
  ref?: string,
): Promise<{
  scene: Scene;
  sha: string;
  size: number;
}> {
  const octokit = getOctokit(token);
  const meta = await octokit.rest.repos.getContent({
    owner: repo.owner,
    repo: repo.repo,
    ref: ref ?? repo.branch,
    path,
  });
  if (Array.isArray(meta.data) || meta.data.type !== "file") {
    throw new Error("Not a file");
  }
  const fileSha = meta.data.sha;
  const size = "size" in meta.data ? meta.data.size : 0;
  const blob = await octokit.rest.git.getBlob({
    owner: repo.owner,
    repo: repo.repo,
    file_sha: fileSha,
  });
  const json = Buffer.from(blob.data.content, "base64").toString("utf8");
  return { scene: JSON.parse(json) as Scene, sha: fileSha, size };
}

// Raw file bytes (any file type). Uses the Git Blob API so large/binary files
// are fully delivered regardless of the 1MB getContent limit.
export async function getFileContent(
  token: string,
  repo: RepoRef,
  path: string,
  ref?: string,
): Promise<{
  content: Buffer;
  sha: string;
  size: number;
}> {
  const octokit = getOctokit(token);
  const meta = await octokit.rest.repos.getContent({
    owner: repo.owner,
    repo: repo.repo,
    ref: ref ?? repo.branch,
    path,
  });
  if (Array.isArray(meta.data) || meta.data.type !== "file") {
    throw new Error("Not a file");
  }
  const fileSha = meta.data.sha;
  const size = "size" in meta.data ? meta.data.size : 0;
  const blob = await octokit.rest.git.getBlob({
    owner: repo.owner,
    repo: repo.repo,
    file_sha: fileSha,
  });
  return { content: Buffer.from(blob.data.content, "base64"), sha: fileSha, size };
}

// ---- Head (conflict check) ------------------------------------------------

export async function getHead(token: string, repo: RepoRef): Promise<string> {
  const octokit = getOctokit(token);
  const ref = `heads/${repo.branch}`;
  try {
    const { data } = await octokit.rest.git.getRef({
      owner: repo.owner,
      repo: repo.repo,
      ref,
    });
    return data.object.sha;
  } catch {
    return "";
  }
}

export type CommitInfo = {
  sha: string;
  message: string;
  date: string;
  author: string;
};

// List commits that touched a given file path (history/restore).
export async function listCommits(
  token: string,
  repo: RepoRef,
  path: string,
): Promise<CommitInfo[]> {
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.repos.listCommits({
    owner: repo.owner,
    repo: repo.repo,
    path,
    per_page: 30,
  });
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    date: c.commit.author?.date ?? "",
    author: c.commit.author?.name ?? c.author?.login ?? "unknown",
  }));
}

// ---- Write core (Git Database API) ----------------------------------------

type TreeOp =
  | { path: string; mode: "100644"; type: "blob"; sha: string }
  | { path: string; mode: "100644"; type: "blob"; sha: null };

export type CommitFile = { path: string; content: string }; // content = base64 JSON

async function getBaseSha(
  octokit: ReturnType<typeof getOctokit>,
  repo: RepoRef,
): Promise<string | null> {
  try {
    const ref = await octokit.rest.git.getRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `heads/${repo.branch}`,
    });
    return ref.data.object.sha;
  } catch {
    return null; // empty repo
  }
}

export async function commitFiles(
  token: string,
  repo: RepoRef,
  files: CommitFile[],
  message: string,
): Promise<{ commitSha: string }> {
  const octokit = getOctokit(token);

  // Upload blobs once (content-addressed, immutable — reusable on retry).
  const blobs = await Promise.all(
    files.map((f) =>
      octokit.rest.git.createBlob({
        owner: repo.owner,
        repo: repo.repo,
        content: f.content,
        encoding: "base64",
      }),
    ),
  );
  const tree: TreeOp[] = files.map((f, i) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    sha: blobs[i].data.sha,
  }));

  async function attempt(baseSha: string | null): Promise<string> {
    const createdTree = await octokit.rest.git.createTree({
      owner: repo.owner,
      repo: repo.repo,
      ...(baseSha ? { base_tree: baseSha } : {}),
      tree,
    });
    const commit = await octokit.rest.git.createCommit({
      owner: repo.owner,
      repo: repo.repo,
      message,
      tree: createdTree.data.sha,
      parents: baseSha ? [baseSha] : [],
    });
    if (baseSha) {
      await octokit.rest.git.updateRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: `heads/${repo.branch}`,
        sha: commit.data.sha,
      });
    } else {
      await octokit.rest.git.createRef({
        owner: repo.owner,
        repo: repo.repo,
        ref: `refs/heads/${repo.branch}`,
        sha: commit.data.sha,
      });
    }
    return commit.data.sha;
  }

  // Retry once on a stale base (someone pushed concurrently).
  let baseSha = await getBaseSha(octokit, repo);
  try {
    return { commitSha: await attempt(baseSha) };
  } catch {
    baseSha = await getBaseSha(octokit, repo);
    return { commitSha: await attempt(baseSha) };
  }
}

// delete (one file)
export async function deleteFile(
  token: string,
  repo: RepoRef,
  path: string,
  message: string,
): Promise<{ commitSha: string }> {
  const octokit = getOctokit(token);

  const ref = await octokit.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
  });
  const baseSha = ref.data.object.sha;

  const tree: TreeOp[] = [{ path, mode: "100644", type: "blob", sha: null }];
  const createdTree = await octokit.rest.git.createTree({
    owner: repo.owner,
    repo: repo.repo,
    base_tree: baseSha,
    tree,
  });
  const commit = await octokit.rest.git.createCommit({
    owner: repo.owner,
    repo: repo.repo,
    message,
    tree: createdTree.data.sha,
    parents: [baseSha],
  });
  await octokit.rest.git.updateRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
    sha: commit.data.sha,
  });
  return { commitSha: commit.data.sha };
}

// rename / move (create new blob reference + delete old)
export async function renameFile(
  token: string,
  repo: RepoRef,
  from: string,
  to: string,
  oldBlobSha: string,
  message: string,
): Promise<{ commitSha: string }> {
  const octokit = getOctokit(token);

  const ref = await octokit.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
  });
  const baseSha = ref.data.object.sha;

  const tree: TreeOp[] = [
    { path: to, mode: "100644", type: "blob", sha: oldBlobSha },
    { path: from, mode: "100644", type: "blob", sha: null },
  ];
  const createdTree = await octokit.rest.git.createTree({
    owner: repo.owner,
    repo: repo.repo,
    base_tree: baseSha,
    tree,
  });
  const commit = await octokit.rest.git.createCommit({
    owner: repo.owner,
    repo: repo.repo,
    message,
    tree: createdTree.data.sha,
    parents: [baseSha],
  });
  await octokit.rest.git.updateRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
    sha: commit.data.sha,
  });
  return { commitSha: commit.data.sha };
}

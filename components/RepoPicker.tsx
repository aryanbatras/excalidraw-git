"use client";

import { useEffect, useState } from "react";
import { GithubLogo, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { RepoRef, RepoSummary } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui";

export function RepoPicker() {
  const setRepo = useStore((s) => s.setRepo);
  const login = useStore((s) => s.login);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrivate, setNewPrivate] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const qs = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`/api/repos${qs}`);
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(d.error || `Failed (${res.status})`);
        }
        const data = (await res.json()) as { repos: RepoSummary[] };
        if (alive) setRepos(data.repos);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  function select(r: RepoSummary) {
    const ref: RepoRef = { owner: r.owner, repo: r.name, branch: r.defaultBranch };
    setRepo(ref);
  }

  async function doCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreateBusy(true);
    setCreateErr(null);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, private: newPrivate }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as { repo: RepoSummary };
      setRepo({ owner: login ?? data.repo.owner, repo: data.repo.name, branch: data.repo.defaultBranch });
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-white px-4">
      <div className="w-[460px] max-w-full rounded-2xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
        <div className="mb-1 flex items-center gap-2.5">
          <GithubLogo size={22} weight="fill" className="text-text" />
          <h1 className="text-[17px] font-bold text-text">Choose a repository</h1>
        </div>
        <p className="mb-4 text-[13px] text-text-muted">
          Your diagrams are stored as <span className="font-mono">.excalidraw</span> files in a GitHub repo.
        </p>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
          <MagnifyingGlass size={15} className="text-text-faint" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories…"
            className="flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
          />
        </div>

        <button
          onClick={() => {
            setCreateErr(null);
            setCreating((v) => !v);
          }}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-2.5 text-[13px] font-medium text-text transition hover:border-accent hover:text-accent"
        >
          <Plus size={15} /> New repository
        </button>

        {creating && (
          <div className="mb-3 rounded-xl bg-surface px-4 py-3">
            <label className="mb-1 block text-[12px] text-text-muted">Repository name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-diagrams"
              className="mb-2 w-full rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] outline-none focus:border-accent"
            />
            <label className="mb-3 flex items-center gap-2 text-[12px] text-text-muted">
              <input
                type="checkbox"
                checked={newPrivate}
                onChange={(e) => setNewPrivate(e.target.checked)}
                className="accent-accent"
              />
              Private repository
            </label>
            {createErr && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{createErr}</div>}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)}>Cancel</Button>
              <Button variant="primary" loading={createBusy} loadingText="Creating…" onClick={() => void doCreate()} disabled={!newName.trim()}>
                Create
              </Button>
            </div>
          </div>
        )}

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</div>}

        <div className="scroll-thin max-h-[50vh] space-y-1 overflow-y-auto">
          {loading && <div className="py-3 text-center text-[12px] text-text-faint">Loading…</div>}
          {!loading && repos.length === 0 && (
            <div className="py-3 text-center text-[12px] text-text-faint">No repositories found.</div>
          )}
          {repos.map((r) => (
            <button
              key={`${r.owner}/${r.name}`}
              onClick={() => select(r)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2"
            >
              <span className="font-mono text-[13px] text-text">
                {r.owner}/<span className="font-medium">{r.name}</span>
              </span>
              <span className="text-[11px] text-text-faint">{r.private ? "private" : "public"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

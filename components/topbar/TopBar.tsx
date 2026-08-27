"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  FloppyDisk,
  Plus,
  CaretDown,
  ArrowLeft,
  Power,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import type { RepoRef } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button, IconButton } from "@/components/ui";
import type { TemplateId } from "@/lib/templates";

type CommitRow = { sha: string; message: string; date: string; author: string };

function timeAgo(date: string): string {
  if (!date) return "";
  const d = new Date(date).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "flowchart", label: "Flowchart" },
  { id: "timeline", label: "Timeline" },
  { id: "gantt", label: "Gantt" },
];

export function TopBar({
  repo,
  selectedPath,
  onSave,
  onNew,
  onChangeRepo,
  onRestore,
}: {
  repo: RepoRef;
  selectedPath: string | null;
  onSave: () => void;
  onNew: (id: TemplateId) => void;
  onChangeRepo: () => void;
  onRestore: (sha: string) => void;
}) {
  const status = useStore((s) => s.status);
  const statusMsg = useStore((s) => s.statusMsg);
  const dirty = useStore((s) => s.dirty);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isDirty = selectedPath ? !!dirty[selectedPath] : false;
  const fileName = selectedPath ? selectedPath.split("/").pop() : null;

  return (
    <header className="flex h-11 items-center gap-2 border-b border-border bg-surface px-3">
      <button
        onClick={onChangeRepo}
        title="Change repository"
        className="flex items-center gap-1.5 rounded-[8px] px-2 py-1 font-mono text-[12px] text-text-muted hover:bg-surface-2 hover:text-text"
      >
        <ArrowLeft size={14} />
        {repo.owner}/{repo.repo}
        <span className="text-text-faint">@{repo.branch}</span>
      </button>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5 text-[13px]">
        {fileName ? (
          <>
            <span className="font-medium text-text">{fileName}</span>
            {isDirty && status !== "saving" && (
              <span className="h-1.5 w-1.5 rounded-full bg-status-dirty" title="Unsaved changes" />
            )}
          </>
        ) : (
          <span className="text-text-faint">No file open</span>
        )}
      </div>

      <div className="flex-1" />

      {/* status */}
      <span className="text-[12px] text-text-muted">
        {status === "saving" ? "Saving…" : status === "error" ? `Error: ${statusMsg}` : isDirty ? "Unsaved" : statusMsg ?? ""}
      </span>

      {/* New diagram */}
      <div className="relative">
        <Button variant="quiet" onClick={() => setNewOpen((v) => !v)}>
          <Plus size={15} /> New
          <CaretDown size={12} />
        </Button>
        {newOpen && (
          <div
            className="absolute right-0 z-40 mt-1 w-44 rounded-[10px] border border-border bg-white py-1 shadow-[0_4px_16px_rgba(24,24,27,0.12)]"
            onMouseLeave={() => setNewOpen(false)}
          >
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setNewOpen(false);
                  onNew(t.id);
                }}
                className="block w-full px-3 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* History / restore */}
      <div className="relative">
        <IconButton
          title="History"
          onClick={async () => {
            if (historyOpen) {
              setHistoryOpen(false);
              return;
            }
            if (!selectedPath) return;
            setHistoryOpen(true);
            setLoadingHistory(true);
            try {
              const qs = `owner=${repo.owner}&repo=${repo.repo}&branch=${repo.branch}&path=${encodeURIComponent(selectedPath)}`;
              const res = await fetch(`/api/history?${qs}`);
              if (res.ok) {
                const data = (await res.json()) as { commits: CommitRow[] };
                setCommits(data.commits);
              }
            } finally {
              setLoadingHistory(false);
            }
          }}
        >
          <ClockCounterClockwise size={16} />
        </IconButton>
        {historyOpen && (
          <div
            className="absolute right-0 z-40 mt-1 w-72 rounded-[10px] border border-border bg-white py-1 shadow-[0_4px_16px_rgba(24,24,27,0.12)]"
            onMouseLeave={() => setHistoryOpen(false)}
          >
            <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
              History
            </div>
            {loadingHistory && (
              <div className="px-3 py-3 text-[12px] text-text-faint">Loading…</div>
            )}
            {!loadingHistory && commits.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-text-faint">No history yet.</div>
            )}
            <div className="scroll-thin max-h-[50vh] overflow-y-auto">
              {commits.map((c) => (
                <div
                  key={c.sha}
                  className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-text">{c.message}</div>
                    <div className="text-[11px] text-text-faint">
                      {c.author} · {timeAgo(c.date)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setHistoryOpen(false);
                      onRestore(c.sha);
                    }}
                    className="shrink-0 rounded-[6px] border border-border px-2 py-1 text-[12px] text-text-muted hover:bg-white hover:text-text"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button variant="primary" onClick={onSave} disabled={!selectedPath}>
        <FloppyDisk size={15} /> Save
      </Button>

      {/* account / sign out */}
      <div className="relative">
        <IconButton title="Account" onClick={() => setMenuOpen((v) => !v)}>
          <Power size={16} />
        </IconButton>
        {menuOpen && (
          <div
            className="absolute right-0 z-40 mt-1 w-40 rounded-[10px] border border-border bg-white py-1 shadow-[0_4px_16px_rgba(24,24,27,0.12)]"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="block w-full px-3 py-1.5 text-left text-[13px] text-text hover:bg-surface-2"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

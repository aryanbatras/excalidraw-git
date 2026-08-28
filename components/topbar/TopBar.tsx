"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  FloppyDisk,
  Plus,
  CaretDown,
  CaretUp,
  ArrowLeft,
  Power,
  ClockCounterClockwise,
  Gear,
  Keyboard,
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
  switchingTo,
  onSave,
  onNew,
  onTemplates,
  onSettings,
  onChangeRepo,
  onRestore,
}: {
  repo: RepoRef;
  selectedPath: string | null;
  switchingTo?: string | null;
  onSave: () => void;
  onNew: (id: TemplateId) => void;
  onTemplates: () => void;
  onSettings: () => void;
  onChangeRepo: () => void;
  onRestore: (sha: string) => void;
}) {
  const status = useStore((s) => s.status);
  const statusMsg = useStore((s) => s.statusMsg);
  const dirty = useStore((s) => s.dirty);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const isDirty = selectedPath ? !!dirty[selectedPath] : false;
  // Section 3: Show switchingTo file name immediately, otherwise show selectedPath
  const displayPath = switchingTo || selectedPath;
  const fileName = displayPath ? displayPath.split("/").pop() : null;

  // Close drawer on Esc and outside click
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        // Don't close if clicking the toggle button
        const target = e.target as HTMLElement;
        if (!target.closest("[data-drawer-toggle]")) {
          setDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [drawerOpen]);

  return (
    <>
      <header className="flex h-16 items-center gap-2 bg-white px-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        {/* Repo identity */}
        <button
          onClick={onChangeRepo}
          title="Change repository"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[12px] text-text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <ArrowLeft size={14} />
          <span className="font-medium">{repo.owner}/{repo.repo}</span>
          <span className="text-text-faint">@{repo.branch}</span>
        </button>

        <div className="h-5 w-px bg-border" />

        {/* File name — prominent */}
        <div className="flex items-center gap-2 text-[14px]">
          {fileName ? (
            <>
              <span className="font-semibold text-text">{fileName}</span>
              {isDirty && status !== "saving" && (
                <span className="h-2 w-2 rounded-full bg-status-dirty" title="Unsaved changes" />
              )}
              {switchingTo && (
                <span className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-border border-t-accent" />
              )}
            </>
          ) : (
            <span className="text-text-faint">No file open</span>
          )}
        </div>

        <div className="flex-1" />

        {/* Status */}
        <span className="text-[12px] text-text-muted">
          {status === "saving" ? "Saving..." : status === "error" ? `Error: ${statusMsg}` : isDirty ? "Unsaved" : statusMsg ?? ""}
        </span>

        {/* New diagram */}
        <div className="relative">
          <Button variant="quiet" onClick={() => setNewOpen((v) => !v)}>
            <Plus size={15} /> New
            <CaretDown size={12} />
          </Button>
          {newOpen && (
            <div
              className="absolute right-0 z-40 mt-1 w-44 rounded-xl bg-white py-1 shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
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

        {/* Templates gallery */}
        <Button variant="quiet" onClick={onTemplates}>
          Templates
        </Button>

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
              className="absolute right-0 z-40 mt-1 w-72 rounded-xl bg-white py-1 shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
              onMouseLeave={() => setHistoryOpen(false)}
            >
              <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
                History
              </div>
              {loadingHistory && (
                <div className="px-3 py-3 text-[12px] text-text-faint">Loading...</div>
              )}
              {!loadingHistory && commits.length === 0 && (
                <div className="px-3 py-3 text-[12px] text-text-faint">No history yet.</div>
              )}
              <div className="scroll-thin max-h-[50vh] overflow-y-auto">
                {commits.map((c, i) => (
                  <div
                    key={c.sha}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-text-faint">
                          #{i + 1}
                        </span>
                        <span className="truncate text-[13px] text-text">{c.message}</span>
                      </div>
                      <div className="text-[11px] text-text-faint">
                        {c.author} &middot; {timeAgo(c.date)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setHistoryOpen(false);
                        onRestore(c.sha);
                      }}
                      className="shrink-0 rounded-[6px] px-2 py-1 text-[12px] text-text-muted hover:bg-surface-2 hover:text-text"
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

        <IconButton title="Settings" onClick={onSettings}>
          <Gear size={16} />
        </IconButton>

        {/* account / sign out */}
        <div className="relative">
          <IconButton title="Account" onClick={() => setMenuOpen((v) => !v)}>
            <Power size={16} />
          </IconButton>
          {menuOpen && (
            <div
              className="absolute right-0 z-40 mt-1 w-40 rounded-xl bg-white py-1 shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
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

      {/* Section 7: Overlay title-menu toggle — ChevronDown at top-right */}
      <button
        data-drawer-toggle
        onClick={() => setDrawerOpen((v) => !v)}
        className="fixed right-4 top-4 z-[60] grid h-9 w-9 place-items-center rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.16)]"
        title={drawerOpen ? "Close menu" : "Open menu"}
      >
        {drawerOpen ? (
          <CaretUp size={16} className="text-text" />
        ) : (
          <CaretDown size={16} className="text-text" />
        )}
      </button>

      {/* Section 7: Drawer panel — slides down under the header */}
      {drawerOpen && (
        <div
          ref={drawerRef}
          className="fixed right-4 top-16 z-[55] w-[360px] rounded-2xl bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
        >
          {/* Repo card */}
          <div className="mb-4 rounded-xl bg-surface p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text">
                {repo.owner}/{repo.repo}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-text-muted">
              Branch: {repo.branch}
            </div>
          </div>

          {/* Status */}
          <div className="mb-4 flex items-center gap-2 text-[12px] text-text-muted">
            <span className={`h-2 w-2 rounded-full ${isDirty ? "bg-status-dirty" : "bg-status-ok"}`} />
            {status === "saving" ? "Saving..." : isDirty ? "Unsaved changes" : statusMsg ?? "All saved"}
          </div>

          <div className="mb-4 h-px bg-border" />

          {/* Quick actions */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-faint">
              Quick Actions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[12px]">
                <span className="text-text">Save</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  Cmd+S
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[12px]">
                <span className="text-text">Undo</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  Cmd+Z
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[12px]">
                <span className="text-text">New</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  Cmd+N
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-[12px]">
                <span className="text-text">Templates</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  Cmd+T
                </kbd>
              </div>
            </div>
          </div>

          <div className="mb-4 h-px bg-border" />

          {/* Keyboard hints */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-faint">
              <Keyboard size={12} />
              Keyboard Shortcuts
            </div>
            <div className="space-y-1 text-[12px] text-text-muted">
              <div className="flex justify-between">
                <span>Save file</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono">Cmd+S</kbd>
              </div>
              <div className="flex justify-between">
                <span>Undo</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono">Cmd+Z</kbd>
              </div>
              <div className="flex justify-between">
                <span>Redo</span>
                <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono">Cmd+Shift+Z</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

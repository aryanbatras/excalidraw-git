"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  List,
  FloppyDisk,
  Plus,
  ClockCounterClockwise,
  Sparkle,
  Gear,
  Power,
} from "@phosphor-icons/react";
import type { RepoRef } from "@/lib/types";
import type { TemplateId } from "@/lib/templates";
import { useStore } from "@/lib/store";

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

interface Props {
  repo: RepoRef;
  selectedPath: string | null;
  switchingTo?: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSave: () => void;
  onNew: (id: TemplateId) => void;
  onTemplates: () => void;
  onSettings: () => void;
  onChangeRepo: () => void;
  onRestore: (sha: string) => void;
  onAi: () => void;
}

export function FloatingToolbar({
  repo,
  selectedPath,
  switchingTo,
  sidebarOpen,
  onToggleSidebar,
  onSave,
  onNew,
  onTemplates,
  onSettings,
  onChangeRepo,
  onRestore,
  onAi,
}: Props) {
  const status = useStore((s) => s.status);
  const statusMsg = useStore((s) => s.statusMsg);
  const dirty = useStore((s) => s.dirty);
  const [newOpen, setNewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [commits, setCommits] = useState<CommitRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const isDirty = selectedPath ? !!dirty[selectedPath] : false;
  const displayPath = switchingTo || selectedPath;
  const rawName = displayPath ? displayPath.split("/").pop() : null;
  const fileName = rawName ? rawName.replace(/\.excalidraw$/i, "") : null;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (newRef.current && !newRef.current.contains(t)) setNewOpen(false);
      if (historyRef.current && !historyRef.current.contains(t)) setHistoryOpen(false);
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNewOpen(false);
        setHistoryOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!selectedPath) return;
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
  }, [repo, selectedPath]);

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      {/* Status pill */}
      {(status === "saving" || status === "error" || (isDirty && status !== "saved")) && (
        <div className="mb-2.5 flex justify-center">
          <div className="rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] text-[#868686] shadow-sm backdrop-blur-sm">
            {status === "saving" ? "Saving..." : status === "error" ? statusMsg ?? "Error" : "Unsaved"}
          </div>
        </div>
      )}

      {/* Dock — White Island style */}
      <div className="flex items-center gap-1 rounded-2xl border border-black/[0.06] bg-white px-3 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]">
        {/* File toggle */}
        <DockBtn
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Close files" : "Open files"}
          active={sidebarOpen}
        >
          <List size={18} weight={sidebarOpen ? "fill" : "regular"} />
        </DockBtn>

        <DockSep />

        {/* File name */}
        <div className="flex items-center gap-2 px-2.5">
          {fileName ? (
            <>
              <span className="max-w-[160px] truncate text-[13px] font-medium text-[#1b1b1f]">
                {fileName}
              </span>
              {isDirty && status !== "saving" && (
                <span className="h-2 w-2 rounded-full bg-amber-400" />
              )}
              {switchingTo && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#6965db]" />
              )}
            </>
          ) : (
            <span className="text-[13px] text-[#868686]">No file</span>
          )}
        </div>

        <DockSep />

        {/* New */}
        <div className="relative" ref={newRef}>
          <DockBtn
            onClick={() => { setNewOpen(!newOpen); setHistoryOpen(false); setAccountOpen(false); }}
            title="New diagram"
          >
            <Plus size={18} />
          </DockBtn>
          {newOpen && (
            <div className="absolute left-1/2 bottom-full z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-black/[0.06] bg-white py-1.5 shadow-[0_4px_32px_rgba(0,0,0,0.12)]">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setNewOpen(false); onNew(t.id); }}
                  className="block w-full px-4 py-2 text-left text-[13px] text-[#1b1b1f] transition hover:bg-black/[0.04]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Templates */}
        <DockBtn onClick={onTemplates} title="Template gallery">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </DockBtn>

        {/* History */}
        <div className="relative" ref={historyRef}>
          <DockBtn
            onClick={async () => {
              if (historyOpen) { setHistoryOpen(false); return; }
              setHistoryOpen(true); setNewOpen(false); setAccountOpen(false);
              await fetchHistory();
            }}
            title="History"
          >
            <ClockCounterClockwise size={18} />
          </DockBtn>
          {historyOpen && (
            <div className="absolute left-1/2 bottom-full z-50 mb-2 w-72 -translate-x-1/2 rounded-xl border border-black/[0.06] bg-white py-1.5 shadow-[0_4px_32px_rgba(0,0,0,0.12)]">
              <div className="border-b border-black/[0.06] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#868686]">
                History
              </div>
              {loadingHistory && (
                <div className="px-4 py-3 text-center text-[13px] text-[#868686]">Loading...</div>
              )}
              {!loadingHistory && commits.length === 0 && (
                <div className="px-4 py-3 text-center text-[13px] text-[#868686]">No history yet.</div>
              )}
              <div className="scroll-thin max-h-[40vh] overflow-y-auto">
                {commits.map((c, i) => (
                  <div
                    key={c.sha}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-black/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[#868686]">#{i + 1}</span>
                        <span className="truncate text-[13px] text-[#1b1b1f]">{c.message}</span>
                      </div>
                      <div className="text-[12px] text-[#868686]">
                        {c.author} &middot; {timeAgo(c.date)}
                      </div>
                    </div>
                    <button
                      onClick={() => { setHistoryOpen(false); onRestore(c.sha); }}
                      className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] text-[#868686] transition hover:bg-black/[0.04] hover:text-[#1b1b1f]"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DockSep />

        {/* AI */}
        <DockBtn onClick={onAi} title="AI diagram generator" accent>
          <Sparkle size={18} weight="fill" />
        </DockBtn>

        {/* Save */}
        <DockBtn
          onClick={onSave}
          disabled={!selectedPath}
          title="Save (Cmd+S)"
          active={isDirty}
        >
          <FloppyDisk size={18} />
        </DockBtn>

        <DockSep />

        {/* Settings */}
        <DockBtn onClick={onSettings} title="Settings">
          <Gear size={18} />
        </DockBtn>

        {/* Account */}
        <div className="relative" ref={accountRef}>
          <DockBtn
            onClick={() => { setAccountOpen(!accountOpen); setNewOpen(false); setHistoryOpen(false); }}
            title="Account"
          >
            <Power size={18} />
          </DockBtn>
          {accountOpen && (
            <div className="absolute right-0 bottom-full z-50 mb-2 w-48 rounded-xl border border-black/[0.06] bg-white py-1.5 shadow-[0_4px_32px_rgba(0,0,0,0.12)]">
              <button
                onClick={() => { setAccountOpen(false); onChangeRepo(); }}
                className="block w-full px-4 py-2 text-left text-[13px] text-[#1b1b1f] transition hover:bg-black/[0.04]"
              >
                Change repo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DockBtn({
  onClick,
  title,
  children,
  active,
  accent,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`grid h-9 w-9 place-items-center rounded-xl transition-all ${
        active
          ? "bg-[#6965db]/10 text-[#6965db]"
          : accent
            ? "text-[#868686] hover:bg-[#6965db]/10 hover:text-[#6965db]"
            : "text-[#868686] hover:bg-black/[0.04] hover:text-[#1b1b1f]"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function DockSep() {
  return <div className="mx-1 h-5 w-px bg-black/[0.08]" />;
}

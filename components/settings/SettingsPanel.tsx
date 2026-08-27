"use client";

import { useStore } from "@/lib/store";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const autoSaveEnabled = useStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useStore((s) => s.autoSaveIntervalSeconds);
  const setAutoSave = useStore((s) => s.setAutoSave);
  const setAutoSaveInterval = useStore((s) => s.setAutoSaveInterval);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[340px] rounded-2xl border border-border bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold text-text">Settings</h2>

        {/* Auto-save */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-text">Auto-save</label>
            <button
              onClick={() => setAutoSave(!autoSaveEnabled)}
              className={`relative h-5 w-9 rounded-full transition ${
                autoSaveEnabled ? "bg-accent" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  autoSaveEnabled ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {autoSaveEnabled && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] text-text-muted">
                <span>Interval</span>
                <span className="font-mono text-text">{autoSaveInterval}s</span>
              </div>
              <input
                type="range"
                min={30}
                max={300}
                step={10}
                value={autoSaveInterval}
                onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                className="mt-1.5 w-full accent-accent"
              />
              <div className="flex justify-between text-[10px] text-text-faint">
                <span>30s</span>
                <span>5min</span>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-[12px] font-medium text-text-muted">Keyboard shortcuts</h3>
          <div className="space-y-1.5 text-[12px]">
            <Row keys="⌘ / Ctrl + S" action="Save" />
            <Row keys="⌘ / Ctrl + Z" action="Undo" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-border py-2 text-[13px] font-medium text-text transition hover:bg-surface-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Row({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{action}</span>
      <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
        {keys}
      </kbd>
    </div>
  );
}

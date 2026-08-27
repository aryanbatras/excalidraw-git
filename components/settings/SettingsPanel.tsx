"use client";

import { useStore } from "@/lib/store";
import { LIBRARIES } from "@/lib/libraries/registry";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const autoSaveEnabled = useStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useStore((s) => s.autoSaveIntervalSeconds);
  const setAutoSave = useStore((s) => s.setAutoSave);
  const setAutoSaveInterval = useStore((s) => s.setAutoSaveInterval);
  const enabledLibraries = useStore((s) => s.enabledLibraries);
  const toggleLibrary = useStore((s) => s.toggleLibrary);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[380px] max-h-[80vh] overflow-y-auto rounded-xl bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
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

        {/* Libraries */}
        <div className="mt-5 border-t border-border/50 pt-4">
          <h3 className="mb-1 text-[12px] font-medium text-text-muted">Libraries</h3>
          <p className="mb-3 text-[11px] text-text-faint">
            Load community icon sets into the Excalidraw sidebar. Changes apply on next file open.
          </p>
          <div className="space-y-1">
            {LIBRARIES.map((lib) => (
              <button
                key={lib.id}
                onClick={() => toggleLibrary(lib.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-surface-2"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
                    enabledLibraries.includes(lib.id)
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-white text-transparent"
                  }`}
                >
                  {enabledLibraries.includes(lib.id) && "✓"}
                </span>
                <span className="text-lg leading-none">{lib.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-text">{lib.name}</div>
                  <div className="truncate text-[10px] text-text-faint">{lib.items} items · {lib.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="mt-5 border-t border-border/50 pt-4">
          <h3 className="mb-2 text-[12px] font-medium text-text-muted">Keyboard shortcuts</h3>
          <div className="space-y-1.5 text-[12px]">
            <Row keys="⌘ / Ctrl + S" action="Save" />
            <Row keys="⌘ / Ctrl + Z" action="Undo" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-surface py-2.5 text-[13px] font-medium text-text transition hover:bg-surface-2"
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

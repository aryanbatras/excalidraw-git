"use client";

import { useStore } from "@/lib/store";
import { LIBRARIES } from "@/lib/libraries/registry";
import { X } from "@phosphor-icons/react";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const autoSaveEnabled = useStore((s) => s.autoSaveEnabled);
  const autoSaveInterval = useStore((s) => s.autoSaveIntervalSeconds);
  const setAutoSave = useStore((s) => s.setAutoSave);
  const setAutoSaveInterval = useStore((s) => s.setAutoSaveInterval);
  const enabledLibraries = useStore((s) => s.enabledLibraries);
  const toggleLibrary = useStore((s) => s.toggleLibrary);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/40 bg-white/90 shadow-[0_16px_64px_rgba(0,0,0,0.12)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#1b1b1f]">Settings</h2>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-[#868686] transition hover:bg-black/5 hover:text-[#1b1b1f]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Auto-save */}
          <Section title="Auto-save">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[13px] font-medium text-[#1b1b1f]">Enable auto-save</label>
                <p className="mt-0.5 text-[11px] text-[#868686]">
                  Automatically commit changes to GitHub
                </p>
              </div>
              <button
                onClick={() => setAutoSave(!autoSaveEnabled)}
                className={`relative h-[22px] w-[38px] rounded-full transition-colors ${
                  autoSaveEnabled ? "bg-[#6965db]" : "bg-[#d1d1d6]"
                }`}
              >
                <span
                  className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${
                    autoSaveEnabled ? "translate-x-[18px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            </div>
            {autoSaveEnabled && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[12px] text-[#868686]">
                  <span>Interval</span>
                  <span className="font-mono text-[#1b1b1f]">{autoSaveInterval}s</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={10}
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#6965db]"
                />
                <div className="flex justify-between text-[10px] text-[#868686]">
                  <span>30s</span>
                  <span>5min</span>
                </div>
              </div>
            )}
          </Section>

          {/* Libraries */}
          <Section title="Libraries" className="mt-4">
            <p className="mb-3 text-[11px] text-[#868686]">
              Community icon sets for the Excalidraw sidebar
            </p>
            <div className="space-y-1">
              {LIBRARIES.map((lib) => (
                <button
                  key={lib.id}
                  onClick={() => toggleLibrary(lib.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-black/5"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold ${
                      enabledLibraries.includes(lib.id)
                        ? "border-[#6965db] bg-[#6965db] text-white"
                        : "border-[#e5e5e5] bg-white text-transparent"
                    }`}
                  >
                    {enabledLibraries.includes(lib.id) && "\u2713"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#1b1b1f]">{lib.name}</div>
                    <div className="truncate text-[11px] text-[#868686]">{lib.items} items</div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Keyboard shortcuts */}
          <Section title="Keyboard shortcuts" className="mt-4">
            <div className="space-y-2 text-[13px]">
              <ShortcutRow keys="Cmd / Ctrl + S" action="Save" />
              <ShortcutRow keys="Cmd / Ctrl + Z" action="Undo" />
            </div>
          </Section>

          {/* Done button */}
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-[#1b1b1f] py-2.5 text-[13px] font-medium text-white transition hover:bg-[#1b1b1f]/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#868686]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#868686]">{action}</span>
      <kbd className="rounded-md bg-[#f5f5f5] px-2 py-0.5 font-mono text-[11px] text-[#1b1b1f]">
        {keys}
      </kbd>
    </div>
  );
}

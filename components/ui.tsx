"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "quiet" | "danger";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-text text-white hover:bg-zinc-700",
  quiet: "text-text-muted hover:bg-surface-2 hover:text-text",
  danger: "bg-danger text-white hover:bg-red-700",
};

export function Button({
  variant = "quiet",
  className = "",
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; loadingText?: string }) {
  const isDisabled = disabled || loading;
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={isDisabled} {...props}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />}
      {loading ? (loadingText ?? "Loading…") : children}
    </button>
  );
}

export function IconButton({
  title,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      className={`grid h-8 w-8 place-items-center rounded-[8px] text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-[360px] rounded-[12px] border border-border bg-white p-4 shadow-[0_4px_16px_rgba(24,24,27,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-text">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />;
}

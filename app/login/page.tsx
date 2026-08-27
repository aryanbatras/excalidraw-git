"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { GithubLogo } from "@phosphor-icons/react";

const ERROR_TEXT: Record<string, string> = {
  access_denied: "Authorization was cancelled. Try again to continue.",
  configuration: "GitHub app is misconfigured. Check the OAuth client id/secret.",
  default: "Sign in failed. Please try again.",
};

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(ERROR_TEXT[e] ?? ERROR_TEXT.default);
  }, []);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-surface">
      <div className="w-[340px] max-w-full rounded-[12px] border border-border bg-white p-8 text-center shadow-[0_4px_16px_rgba(24,24,27,0.06)]">
        <h1 className="text-[17px] font-semibold text-text">Excalidraw Git</h1>
        <p className="mt-1.5 text-[13px] text-text-muted">
          Your Excalidraw, backed by Git. Sign in with GitHub to read and write your diagrams.
        </p>

        {error && (
          <div className="mb-4 mt-4 rounded-[8px] bg-accent-weak px-3 py-2 text-[12px] text-accent">
            GitHub: {error}
          </div>
        )}

        <button
          onClick={() => void signIn("github", { callbackUrl: "/" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-[8px] bg-text px-4 py-2 text-[13px] font-medium text-white transition hover:bg-zinc-700 active:translate-y-px"
        >
          <GithubLogo size={16} weight="fill" />
          Continue with GitHub
        </button>
      </div>
    </main>
  );
}

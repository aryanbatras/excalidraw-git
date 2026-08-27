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
    <main className="grid min-h-[100dvh] place-items-center bg-white">
      <div className="w-[380px] max-w-full rounded-2xl p-8 text-center shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
        <h1 className="text-[20px] font-bold text-text">Excalidraw + Git</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-text-muted">
          Your diagrams, backed by GitHub.
        </p>

        {error && (
          <div className="mb-4 mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        )}

        <button
          onClick={() => void signIn("github", { callbackUrl: "/" })}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#18181b] px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-zinc-800 active:translate-y-px"
        >
          <GithubLogo size={18} weight="fill" />
          Sign in with GitHub
        </button>
      </div>
    </main>
  );
}

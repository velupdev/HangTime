import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authEnabled, signIn } from "@/lib/auth/client";

const LOGIN_PROVIDERS = [{ providerId: "google", label: "Google" }] as const;

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onProvider(providerId: string, label: string) {
    setError(null);
    setBusy(label);
    try {
      await signIn(providerId, { callbackURL: "/plus", errorCallbackURL: "/login" });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          HangTime Plus
        </p>
        <h1 className="font-display mt-1 text-4xl font-extrabold tracking-wide">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted">
          Sign in to unlock HangTime Plus. First 100 get $10 lifetime to track
          jumps over time — one athlete or a whole roster.
        </p>
      </div>
      {authEnabled ? (
        <div className="flex flex-col gap-2">
          {LOGIN_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              disabled={busy !== null}
              onClick={() => void onProvider(p.providerId, p.label)}
              className="h-12 min-h-12 w-full touch-manipulation rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90 disabled:opacity-60"
            >
              {busy === p.label ? `Opening ${p.label}…` : `Continue with ${p.label}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
      {error ? (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-fg shadow-[var(--shadow-border)]">
          {error}
        </p>
      ) : null}
      <p className="rounded-md bg-surface px-4 py-3 text-xs text-muted shadow-[var(--shadow-border)]">
        Skip Private / Incognito for this step. Sign-in often works there, but
        HangTime Plus may not stay unlocked after you close the tab. A regular
        Safari or Chrome window keeps you signed in.
      </p>
      <Link to="/" className="text-sm text-muted underline-offset-4 hover:underline">
        Back to HangTime
      </Link>
      <p className="flex flex-wrap gap-x-4 text-xs text-muted">
        <Link to="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Link to="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </p>
    </main>
  );
}
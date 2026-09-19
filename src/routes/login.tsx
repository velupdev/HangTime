import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";

const LOGIN_PROVIDERS = [{ providerId: "google", label: "Google" }] as const;

function nextPath() {
  if (typeof window === "undefined") return "/plus";
  const raw = new URLSearchParams(window.location.search).get("callbackURL") ?? "/plus";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/plus";
  return raw;
}

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function onProvider(providerId: string, label: string) {
    setError(null);
    setBusy(label);
    try {
      await signIn(providerId, { callbackURL: nextPath(), errorCallbackURL: "/login" });
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError("Enter email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password needs at least 8 characters.");
      return;
    }
    setBusy("email");
    try {
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email({
          email: trimmed,
          password,
          name: name.trim() || trimmed.split("@")[0] || "Athlete",
          callbackURL: nextPath(),
        });
        if (signUpError) throw new Error(signUpError.message ?? "Could not create account.");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: trimmed,
          password,
          callbackURL: nextPath(),
        });
        if (signInError) throw new Error(signInError.message ?? "Could not sign in.");
      }
      window.location.assign(nextPath());
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  const inputClass =
    "h-12 min-h-12 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary/70";

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

      <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted uppercase">
        or email
      </p>

      <form className="flex flex-col gap-2" onSubmit={(e) => void onEmail(e)}>
        {mode === "up" ? (
          <input
            className={inputClass}
            name="name"
            autoComplete="name"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : null}
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          placeholder={mode === "up" ? "Password (8+ characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={busy !== null}
          className="h-12 min-h-12 w-full touch-manipulation rounded-md bg-fg px-4 text-sm font-semibold text-bg hover:bg-fg/90 disabled:opacity-60"
        >
          {busy === "email"
            ? mode === "up"
              ? "Creating account…"
              : "Signing in…"
            : mode === "up"
              ? "Create account"
              : "Sign in with email"}
        </button>
        <button
          type="button"
          className="text-sm text-muted hover:text-fg"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setError(null);
          }}
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>

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

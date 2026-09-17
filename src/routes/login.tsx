import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
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
          jumps over time — one athlete or a whole roster. After that, $10/year.
        </p>
      </div>
      {authEnabled ? (
        <div className="flex flex-col gap-2">
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/plus" })}
              className="h-11 min-h-11 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90"
            >
              Continue with {p.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Sign-in is disabled.</p>
      )}
      <Link to="/" className="text-sm text-muted underline-offset-4 hover:underline">
        Back to HangTime
      </Link>
    </main>
  );
}

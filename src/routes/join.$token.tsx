import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { acceptCoachInvite } from "@/lib/plus/server";

export const Route = createFileRoute("/join/$token")({ component: JoinPage });

function JoinPage() {
  const { token } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (isPending || !user || started.current) return;
    started.current = true;
    void acceptCoachInvite({ data: token })
      .then(() => navigate({ to: "/plus" }))
      .catch((err: unknown) => {
        started.current = false;
        setError(err instanceof Error ? err.message : "Could not join roster.");
      });
  }, [isPending, user, token, navigate]);

  const loginHref = `/login?callbackURL=${encodeURIComponent(`/join/${token}`)}`;

  if (isPending) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="h-11 w-48 animate-pulse rounded-md bg-surface" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        HangTime Plus
      </p>
      <h1 className="font-display text-4xl font-extrabold tracking-wide">
        Join a roster
      </h1>
      <p className="text-sm text-muted">
        You're invited to coach on a shared HangTime roster — same players,
        same jumps. This does not use a founding lifetime spot.
      </p>
      {error ? (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-fg shadow-[var(--shadow-border)]">
          {error}
        </p>
      ) : null}
      <SignInGate
        fallback={
          <a
            href={loginHref}
            className="inline-flex h-12 min-h-12 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg"
          >
            Sign in to join
          </a>
        }
      >
        <p className="text-sm text-muted">
          {error ? "Try the invite again." : "Adding you to the roster…"}
        </p>
      </SignInGate>
      <Link to="/" className="text-sm text-muted underline-offset-4 hover:underline">
        Back to HangTime
      </Link>
    </main>
  );
}

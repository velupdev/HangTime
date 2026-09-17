import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CoachPortal } from "@/components/plus/coach-portal";
import { PlusPaywall } from "@/components/plus/paywall";
import { RedirectToSignIn, SignInGate, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getPlusStatus } from "@/lib/plus/server";

export const Route = createFileRoute("/plus")({ component: PlusPage });

function PlusPage() {
  const { user, isPending } = useCurrentUserState();
  const [plus, setPlus] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState(false);
  const refresh = useCallback(() => {
    void getPlusStatus().then((s) => { setPlus(s.plus); setAdmin(s.admin); }).catch(() => setPlus(false));
  }, []);
  useEffect(() => {
    if (isPending) return;
    if (!user) { setPlus(false); return; }
    refresh();
  }, [isPending, user, refresh]);
  if (isPending) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-11 w-48 animate-pulse rounded-md bg-surface" /></div>;
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Track over time</p>
          <h1 className="font-display text-4xl font-extrabold tracking-wide sm:text-5xl">HangTime Plus</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg">Measure a jump</Link>
          {admin ? <Link to="/admin" className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg">Users</Link> : null}
          {user ? <UserButton /> : null}
        </div>
      </header>
      <SignInGate fallback={<RedirectToSignIn />}>
        {plus === null ? <div className="h-40 animate-pulse rounded-lg bg-surface" /> : plus ? <CoachPortal /> : <PlusPaywall onUnlocked={() => setPlus(true)} />}
      </SignInGate>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAdminSnapshot, type AdminSnapshot } from "@/lib/admin/server";
import { RedirectToSignIn, SignInGate, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    void getAdminSnapshot()
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load admin.");
      });
  }, [isPending, user]);

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-11 w-48 animate-pulse rounded-md bg-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Owner</p>
          <h1 className="font-display text-4xl font-extrabold tracking-wide sm:text-5xl">Users</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg">Measure</Link>
          <Link to="/plus" className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg">Plus</Link>
          {user ? <UserButton /> : null}
        </div>
      </header>
      <SignInGate fallback={<RedirectToSignIn />}>
        {error ? (
          <p className="rounded-lg bg-surface px-5 py-8 text-sm text-fg shadow-[var(--shadow-border)]">{error} This page is only for HangTime owners.</p>
        ) : data === null ? (
          <div className="h-40 animate-pulse rounded-lg bg-surface" />
        ) : (
          <AdminBody data={data} />
        )}
      </SignInGate>
    </div>
  );
}

function AdminBody({ data }: { data: AdminSnapshot }) {
  const { totals, users } = data;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Signed in" value={totals.signedIn} />
        <Stat label="Plus" value={totals.plus} />
        <Stat label="Lifetime left" value={totals.lifetimeLeft} />
        <Stat label="Players" value={totals.players} />
        <Stat label="Jumps logged" value={totals.jumps} />
      </dl>
      <section className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        {users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No signed-in users yet.</p>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs tracking-[0.12em] text-muted uppercase">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Players</th>
                <th className="px-4 py-3 font-semibold">Jumps</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-fg">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">{u.plus ? <span className="font-semibold text-primary">Plus</span> : <span className="text-muted">Signed in</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{u.playerCount}</td>
                  <td className="px-4 py-3 tabular-nums">{u.jumpCount}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{u.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
      <dt className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className="font-display mt-1 text-3xl font-extrabold tabular-nums text-primary">{value}</dd>
    </div>
  );
}

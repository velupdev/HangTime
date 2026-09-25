import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAdminSnapshot,
  grantCompPlus,
  revokeCompPlus,
  revokePendingGrant,
  type AdminSnapshot,
} from "@/lib/admin/server";
import { RedirectToSignIn, SignInGate, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    return getAdminSnapshot()
      .then(setData)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load admin.");
      });
  }

  useEffect(() => {
    if (isPending || !user) return;
    void refresh();
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
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Owner
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-wide sm:text-5xl">
            Users
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg"
          >
            Measure
          </Link>
          <Link
            to="/plus"
            className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg"
          >
            Plus
          </Link>
          {user ? <UserButton /> : null}
        </div>
      </header>

      <SignInGate fallback={<RedirectToSignIn />}>
        {error ? (
          <p className="rounded-lg bg-surface px-5 py-8 text-sm text-fg shadow-[var(--shadow-border)]">
            {error} This page is only for HangTime owners.
          </p>
        ) : data === null ? (
          <div className="h-40 animate-pulse rounded-lg bg-surface" />
        ) : (
          <AdminBody data={data} onChanged={() => void refresh()} />
        )}
      </SignInGate>
    </div>
  );
}

function AdminBody({
  data,
  onChanged,
}: {
  data: AdminSnapshot;
  onChanged: () => void;
}) {
  const { totals, users, pending } = data;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onGrant(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const result = await grantCompPlus({ data: email });
      setEmail("");
      setNote(
        result.status === "active"
          ? `${result.email} now has free HangTime Plus.`
          : `${result.email} will get free Plus the first time they sign in.`,
      );
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not grant Plus.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevokePending(address: string) {
    if (!window.confirm(`Remove the free Plus invite for ${address}?`)) return;
    setBusy(true);
    setNote(null);
    try {
      await revokePendingGrant({ data: address });
      setNote(`${address} will not get free Plus.`);
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not remove that invite.");
    } finally {
      setBusy(false);
    }
  }

  async function onRevokeComp(userId: string, address: string) {
    if (!window.confirm(`Remove free Plus for ${address}? Their jumps stay saved.`)) return;
    setBusy(true);
    setNote(null);
    try {
      await revokeCompPlus({ data: userId });
      setNote(`${address} is back to the free measure page.`);
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not remove Plus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Signed in" value={totals.signedIn} />
        <Stat label="Plus" value={totals.plus} />
        <Stat label="Lifetime left" value={totals.lifetimeLeft} />
        <Stat label="Players" value={totals.players} />
        <Stat label="Jumps" value={totals.jumps} />
      </dl>

      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-extrabold tracking-wide">
          Give Plus for free
        </h2>
        <p className="mt-1 text-sm text-muted">
          Comp a person their own roster. Does not use a founding $10 spot. They
          sign in with this email (Google or password) and ads stay off.
        </p>
        <form
          onSubmit={(e) => void onGrant(e)}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="coach@example.com"
            className="h-11 min-h-11 flex-1 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          />
          <Button type="submit" variant="primary" disabled={busy || !email.trim()}>
            Grant Plus
          </Button>
        </form>
        {note ? <p className="mt-2 text-sm text-fg">{note}</p> : null}
        {pending.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {pending.map((address) => (
              <li key={address} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted">
                  Waiting to sign in: {address}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onRevokePending(address)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-fg">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.plus ? (
                      <span className="font-semibold text-primary">
                        {u.plusSource === "comp" ? "Plus (free)" : "Plus"}
                      </span>
                    ) : (
                      <span className="text-muted">Signed in</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.playerCount}</td>
                  <td className="px-4 py-3 tabular-nums">{u.jumpCount}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {u.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.plus && u.plusSource === "comp" ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onRevokeComp(u.id, u.email)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-muted">
        Only joe@ace805.com and joey@velup.dev can open this page. People who
        only measure a jump without signing in do not appear here.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
      <dt className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        {label}
      </dt>
      <dd className="font-display mt-1 text-3xl font-extrabold tabular-nums text-primary">
        {value}
      </dd>
    </div>
  );
}

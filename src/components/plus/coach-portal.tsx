import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { JumpChart } from "@/components/plus/jump-chart";
import { formatHeight } from "@/lib/jump-math";
import {
  addPlayer,
  createCoachInvite,
  deleteJump,
  deletePlayer,
  listJumps,
  listPlayers,
  listTeamProgress,
  listTeams,
  type JumpRow,
  type PlayerRow,
  type TeamRow,
} from "@/lib/plus/server";

type ProgressMap = Map<number, { heightIn: number; at: string }[]>;

export function CoachPortal() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [jumps, setJumps] = useState<JumpRow[]>([]);
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const chartPoints = useMemo(
    () =>
      [...jumps]
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((j) => ({ heightIn: j.height_in, at: j.created_at })),
    [jumps],
  );

  async function refreshTeams() {
    const rows = await listTeams();
    setTeams(rows);
    setTeamId((id) => id ?? rows[0]?.id ?? null);
    return rows;
  }

  async function refreshPlayers(id: number | null) {
    const rows = await listPlayers({ data: id });
    setPlayers(rows);
    setSelected((cur) => {
      if (cur && rows.some((p) => p.id === cur)) return cur;
      return rows[0]?.id ?? null;
    });
  }

  async function refreshProgress(id: number | null) {
    const rows = await listTeamProgress({ data: id });
    setProgress(new Map(rows.map((r) => [r.playerId, r.points])));
  }

  useEffect(() => {
    void refreshTeams().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load roster.");
    });
  }, []);

  useEffect(() => {
    void refreshPlayers(teamId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load players.");
    });
    void refreshProgress(teamId).catch(() => setProgress(new Map()));
    setInviteUrl(null);
  }, [teamId]);

  useEffect(() => {
    if (selected === null) {
      setJumps([]);
      return;
    }
    void listJumps({ data: selected })
      .then(setJumps)
      .catch(() => setJumps([]));
  }, [selected]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const row = await addPlayer({ data: { name, teamId } });
      setName("");
      if (row) {
        setPlayers((prev) => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
        setSelected(row.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add player.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemovePlayer(id: number) {
    setBusy(true);
    try {
      await deletePlayer({ data: id });
      const next = players.filter((p) => p.id !== id);
      setPlayers(next);
      setSelected(next[0]?.id ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveJump(id: number) {
    setBusy(true);
    try {
      await deleteJump({ data: id });
      setJumps((prev) => prev.filter((j) => j.id !== id));
      void refreshProgress(teamId);
    } finally {
      setBusy(false);
    }
  }

  async function onInvite() {
    if (teamId === null) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const created = await createCoachInvite({ data: teamId });
      const url = `${window.location.origin}${created.path}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        /* clipboard may be blocked */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-extrabold tracking-wide">Players</h2>
        <p className="mt-1 text-sm text-muted">
          Add yourself, or every athlete you coach. Invite another coach to this
          same roster — it does not use a founding spot.
        </p>
        {teams.length > 1 ? (
          <label className="mt-3 block text-sm text-muted">
            Roster
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(Number(e.target.value))}
              className="mt-1 h-11 min-h-11 w-full rounded-md bg-bg px-3 text-fg shadow-[var(--shadow-border)]"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.owner ? " (yours)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <form onSubmit={(e) => void onAdd(e)} className="mt-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            className="h-11 min-h-11 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          />
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            Add player
          </Button>
        </form>
        <Button
          type="button"
          className="mt-2 w-full"
          disabled={busy || teamId === null}
          onClick={() => void onInvite()}
        >
          Invite a coach
        </Button>
        {inviteUrl ? (
          <p className="mt-2 break-all text-xs text-muted">
            {copied ? "Copied. " : "Send this link: "}
            {inviteUrl}
          </p>
        ) : null}
        <ul className="mt-4 space-y-1">
          {players.length === 0 ? (
            <li className="text-sm text-muted">No players yet.</li>
          ) : (
            players.map((p) => {
              const spark = progress.get(p.id) ?? [];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                      selected === p.id ? "bg-primary/15 text-primary" : "text-fg hover:bg-fg/8"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {spark.length > 0 ? <JumpChart points={spark} compact /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {error ? <p className="mt-3 text-sm text-fg">{error}</p> : null}
      </section>

      <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        {selected === null ? (
          <p className="text-sm text-muted">Add a player to start a jump log.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
                  Jump log
                </p>
                <h2 className="font-display text-2xl font-extrabold tracking-wide">
                  {players.find((p) => p.id === selected)?.name ?? "Player"}
                </h2>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onRemovePlayer(selected)}
              >
                Remove player
              </Button>
            </div>
            {jumps.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No jumps yet. Measure on the home page, then save to this player.
              </p>
            ) : (
              <>
                <JumpChart points={chartPoints} />
                <ul className="mt-4 divide-y divide-border">
                  {jumps.map((j) => (
                    <li
                      key={j.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-2xl font-extrabold tabular-nums text-primary">
                          {formatHeight(j.height_in / 39.3700787, "in")}
                        </p>
                        <p className="text-sm text-muted">
                          {j.flight_s.toFixed(3)} s · {j.fps} fps
                          {j.notes ? ` · ${j.notes}` : ""}
                          {" · "}
                          {jumpDay(j.created_at)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onRemoveJump(j.id)}
                      >
                        Remove jump
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function jumpDay(value: string | Date | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return "";
}

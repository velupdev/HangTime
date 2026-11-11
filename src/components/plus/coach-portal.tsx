import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { JumpChart } from "@/components/plus/jump-chart";
import { exportFilename, jumpsToCsv, rosterToXlsx } from "@/lib/plus/export-file";
import { formatHeight } from "@/lib/jump-math";
import type { RosterExport } from "@/lib/plus/roster-export";
import {
  addPlayer,
  createCoachInvite,
  deleteJump,
  deletePlayer,
  exportRoster,
  listJumps,
  listPlayers,
  listTeamProgress,
  listTeams,
  updatePlayer,
  type JumpRow,
  type PlayerRow,
  type TeamRow,
} from "@/lib/plus/server";

type ProgressMap = Map<number, { heightIn: number; at: string }[]>;

type ReadyFile = { url: string; filename: string; format: "csv" | "xlsx" };

export function CoachPortal() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [jumps, setJumps] = useState<JumpRow[]>([]);
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [readyFile, setReadyFile] = useState<ReadyFile | null>(null);
  const [revision, setRevision] = useState(0);
  const exportCache = useRef<{ key: string; data: RosterExport } | null>(null);
  const readyRef = useRef<ReadyFile | null>(null);

  const chartPoints = useMemo(
    () =>
      [...jumps]
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((j) => ({ heightIn: j.height_in, at: j.created_at })),
    [jumps],
  );

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const player of players) {
      if (player.group_name) names.add(player.group_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const visiblePlayers = players.filter(
    (player) => groupFilter === "all" || player.group_name === groupFilter,
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

  useEffect(() => {
    setReadyFile(null);
    return () => {
      if (readyRef.current) URL.revokeObjectURL(readyRef.current.url);
      readyRef.current = null;
    };
  }, [teamId, groupFilter, revision]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const row = await addPlayer({ data: { name, teamId, groupName: group } });
      setName("");
      if (row) {
        setPlayers((prev) =>
          [...prev, row].sort(
            (a, b) =>
              (a.group_name ?? "￿").localeCompare(b.group_name ?? "￿") ||
              a.name.localeCompare(b.name),
          ),
        );
        setSelected(row.id);
        setRevision((n) => n + 1);
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
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveJump(id: number) {
    setBusy(true);
    try {
      await deleteJump({ data: id });
      setJumps((prev) => prev.filter((j) => j.id !== id));
      setRevision((n) => n + 1);
      void refreshProgress(teamId);
    } finally {
      setBusy(false);
    }
  }

  async function onSavePlayer(e: FormEvent) {
    e.preventDefault();
    if (selected === null) return;
    setBusy(true);
    setError(null);
    try {
      const row = await updatePlayer({
        data: { id: selected, name: editName, groupName: editGroup },
      });
      setPlayers((prev) =>
        prev
          .map((player) => (player.id === row.id ? row : player))
          .sort(
            (a, b) =>
              (a.group_name ?? "￿").localeCompare(b.group_name ?? "￿") ||
              a.name.localeCompare(b.name),
          ),
      );
      setEditing(false);
      setRevision((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that player.");
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

  function rememberFile(next: ReadyFile | null) {
    if (readyRef.current && readyRef.current.url !== next?.url) {
      URL.revokeObjectURL(readyRef.current.url);
    }
    readyRef.current = next;
    setReadyFile(next);
  }

  async function loadExport() {
    const key = `${teamId ?? "all"}|${groupFilter}|${revision}`;
    const cached = exportCache.current;
    if (cached?.key === key) return cached.data;
    const data = await exportRoster({
      data: {
        teamId,
        groupName: groupFilter === "all" ? "" : groupFilter,
      },
    });
    exportCache.current = { key, data };
    return data;
  }

  async function onExport(format: "csv" | "xlsx") {
    if (exporting) return;
    setExporting(format);
    setError(null);
    try {
      const data = await loadExport();
      if (data.players.length === 0) {
        rememberFile(null);
        setError("Nothing to export.");
        return;
      }
      const group = groupFilter === "all" ? null : groupFilter;
      const filename = exportFilename(data.roster, group, format);
      const blob =
        format === "csv"
          ? new Blob([jumpsToCsv(data)], { type: "text/csv;charset=utf-8" })
          : xlsxBlob(rosterToXlsx(data));
      const url = URL.createObjectURL(blob);
      const next = { url, filename, format };
      rememberFile(next);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setExporting(null);
    }
  }

  const exportScope = groupFilter === "all" ? "All players on this roster" : `Only ${groupFilter}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-start">
      <section className="flex max-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] lg:sticky lg:top-4">
        <h2 className="shrink-0 font-display text-xl font-extrabold tracking-wide">Players</h2>
        <p className="mt-1 shrink-0 text-sm text-muted">
          Add yourself, or every athlete you coach. Invite another coach to this same roster.
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
        <form onSubmit={(e) => void onAdd(e)} className="mt-3 flex shrink-0 flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            className="h-11 min-h-11 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          />
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Group, optional — 1st hour, basketball"
            className="h-11 min-h-11 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
          />
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            Add player
          </Button>
        </form>
        <Button
          type="button"
          className="mt-2 w-full shrink-0"
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
        {groups.length > 0 ? (
          <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setGroupFilter("all")}
              className={`h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${
                groupFilter === "all" ? "bg-primary text-primary-fg" : "bg-bg text-muted"
              }`}
            >
              All
            </button>
            {groups.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setGroupFilter(label);
                  setGroup(label);
                }}
                className={`h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${
                  groupFilter === label ? "bg-primary text-primary-fg" : "bg-bg text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-muted uppercase">Export</p>
            <p className="min-w-0 truncate text-xs text-muted">
              {groupFilter === "all" ? "All players" : groupFilter}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              type="button"
              data-testid="export-csv"
              disabled={busy || exporting !== null || visiblePlayers.length === 0}
              onClick={() => void onExport("csv")}
              aria-label={`Download CSV for ${exportScope}`}
            >
              {exporting === "csv" ? "Preparing…" : "CSV"}
            </Button>
            <Button
              type="button"
              data-testid="export-xlsx"
              disabled={busy || exporting !== null || visiblePlayers.length === 0}
              onClick={() => void onExport("xlsx")}
              aria-label={`Download Excel for ${exportScope}`}
            >
              {exporting === "xlsx" ? "Preparing…" : "Excel"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {exportScope}. CSV lists every jump. Excel adds a summary sheet.
          </p>
          {readyFile ? (
            <a
              href={readyFile.url}
              download={readyFile.filename}
              data-testid="export-save"
              className="mt-2 flex h-11 min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg"
            >
              Save {readyFile.format === "csv" ? "CSV" : "Excel"}
            </a>
          ) : null}
        </div>
        <ul className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {visiblePlayers.length === 0 ? (
            <li className="text-sm text-muted">
              {players.length === 0 ? "No players yet." : "No players in this group."}
            </li>
          ) : (
            visiblePlayers.map((p) => {
              const spark = progress.get(p.id) ?? [];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p.id);
                      setEditing(false);
                    }}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm ${
                      selected === p.id ? "bg-primary/15 text-primary" : "text-fg hover:bg-fg/8"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      {p.group_name ? (
                        <span className="ml-2 text-xs font-normal text-muted">{p.group_name}</span>
                      ) : null}
                    </span>
                    {spark.length > 0 ? <JumpChart points={spark} compact /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {error ? <p className="mt-3 shrink-0 text-sm text-fg">{error}</p> : null}
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
                <p className="text-sm text-muted">
                  {players.find((p) => p.id === selected)?.group_name || "No group"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const current = players.find((p) => p.id === selected);
                    setEditName(current?.name ?? "");
                    setEditGroup(current?.group_name ?? "");
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
                <Button type="button" disabled={busy} onClick={() => void onRemovePlayer(selected)}>
                  Remove player
                </Button>
              </div>
            </div>
            {editing ? (
              <form onSubmit={(e) => void onSavePlayer(e)} className="mt-3 flex flex-col gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Player name"
                  className="h-11 min-h-11 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                />
                <input
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  placeholder="Group — leave blank for none"
                  className="h-11 min-h-11 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={busy || !editName.trim()}>
                    Save
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
            {jumps.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No jumps yet. Measure on the home page, then save to this player.
              </p>
            ) : (
              <>
                <JumpChart points={chartPoints} />
                <ul className="mt-4 divide-y divide-border">
                  {jumps.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-3 py-3">
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

function xlsxBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function jumpDay(value: string | Date | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  return "";
}

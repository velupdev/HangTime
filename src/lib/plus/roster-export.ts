import type { Sql } from "@/lib/db";

/** One measured jump inside an export. Heights are inches, the unit the portal shows. */
export type ExportJump = {
  heightIn: number | null;
  flightS: number | null;
  fps: number | null;
  notes: string | null;
  at: string;
};

/** An athlete on a roster the caller is allowed to see, with every saved jump. */
export type ExportPlayer = {
  name: string;
  group: string | null;
  roster: string;
  jumps: ExportJump[];
};

/**
 * Authorized snapshot for one download.
 * `roster` is the file label (one team name, or "Rosters" when several are included).
 */
export type RosterExport = {
  roster: string;
  players: ExportPlayer[];
};

export type RosterExportRequest = {
  teamId: number | null;
  groupName: string;
};

type PlayerQuery = {
  id: number | string;
  name: string;
  group_name: string | null;
  team_name: string | null;
};

type JumpQuery = {
  player_id: number | string;
  height_in: number | string | null;
  flight_s: number | string | null;
  fps: number | string | null;
  notes: string | null;
  created_at: unknown;
};

const PLAYER_SELECT = `
  select p.id, p.name, p.group_name,
         coalesce(nullif(btrim(t.name), ''), 'Roster') as team_name
  from players p
  left join teams t on t.id = p.team_id
`;

/**
 * Athletes a coach may export.
 *
 * A caller only receives players on a roster they belong to, or — when they
 * belong to none — players they created. That matches the portal list.
 * Passing another coach's team id throws. A group name is an exact label
 * match applied after the authorization query, so an empty group never
 * falls through to someone else's athletes.
 */
export async function loadRosterExport(
  sql: Sql,
  userId: string,
  request: RosterExportRequest,
): Promise<RosterExport> {
  const groupName = request.groupName.trim().slice(0, 40);
  const teamId = request.teamId;

  if (teamId !== null && !(await isMember(sql, userId, teamId))) {
    throw new Error("You are not on that roster.");
  }

  const population = await loadVisiblePlayers(sql, userId, teamId);
  const filtered = groupName
    ? population.filter((player) => (player.group_name ?? "").trim() === groupName)
    : population;

  const ids = filtered.map((player) => asId(player.id)).filter((id): id is number => id !== null);
  const jumps = await loadJumps(sql, userId, ids);
  const jumpsByPlayer = new Map<number, ExportJump[]>();
  for (const row of jumps) {
    const playerId = asId(row.player_id);
    if (playerId === null) continue;
    const list = jumpsByPlayer.get(playerId) ?? [];
    list.push({
      heightIn: asNumber(row.height_in),
      flightS: asNumber(row.flight_s),
      fps: asNumber(row.fps),
      notes: row.notes?.trim() ? row.notes : null,
      at: asIso(row.created_at),
    });
    jumpsByPlayer.set(playerId, list);
  }

  const players: ExportPlayer[] = [];
  for (const row of filtered) {
    const id = asId(row.id);
    if (id === null) continue;
    const group = row.group_name?.trim() ?? "";
    players.push({
      name: row.name,
      group: group || null,
      roster: row.team_name?.trim() || "Roster",
      jumps: jumpsByPlayer.get(id) ?? [],
    });
  }

  return {
    roster: await rosterLabel(sql, teamId, players),
    players,
  };
}

async function isMember(sql: Sql, userId: string, teamId: number): Promise<boolean> {
  const rows = await sql.query<{ user_id: string }>(
    `select user_id from team_members where team_id = $1 and user_id = $2 limit 1`,
    [teamId, userId],
  );
  return rows.length > 0;
}

async function loadVisiblePlayers(
  sql: Sql,
  userId: string,
  teamId: number | null,
): Promise<PlayerQuery[]> {
  if (teamId !== null) {
    return sql.query<PlayerQuery>(
      `${PLAYER_SELECT}
       where p.team_id = $2
         and exists (
           select 1 from team_members m
           where m.team_id = p.team_id and m.user_id = $1
         )
       order by p.group_name nulls last, p.name, p.id`,
      [userId, teamId],
    );
  }

  const onTeams = await sql.query<PlayerQuery>(
    `${PLAYER_SELECT}
     where exists (
       select 1 from team_members m
       where m.team_id = p.team_id and m.user_id = $1
     )
     order by p.group_name nulls last, p.name, p.id`,
    [userId],
  );
  if (onTeams.length > 0) return onTeams;

  return sql.query<PlayerQuery>(
    `${PLAYER_SELECT}
     where p.user_id = $1
     order by p.group_name nulls last, p.name, p.id`,
    [userId],
  );
}

async function loadJumps(sql: Sql, userId: string, playerIds: number[]): Promise<JumpQuery[]> {
  if (playerIds.length === 0) return [];
  const placeholders = playerIds.map((_, index) => `$${index + 2}`).join(", ");
  return sql.query<JumpQuery>(
    `select j.player_id, j.height_in, j.flight_s, j.fps, j.notes, j.created_at
     from jumps j
     join players p on p.id = j.player_id
     where (
       exists (
         select 1 from team_members m
         where m.team_id = p.team_id and m.user_id = $1
       )
       or p.user_id = $1
     )
       and j.player_id in (${placeholders})
     order by j.created_at asc, j.id asc`,
    [userId, ...playerIds],
  );
}

async function rosterLabel(
  sql: Sql,
  teamId: number | null,
  players: ExportPlayer[],
): Promise<string> {
  if (teamId !== null) {
    const rows = await sql.query<{ name: string }>(`select name from teams where id = $1`, [
      teamId,
    ]);
    return rows[0]?.name?.trim() || "Roster";
  }
  const names = [...new Set(players.map((player) => player.roster))];
  if (names.length === 1) return names[0];
  if (names.length === 0) return "Roster";
  return "Rosters";
}

function asId(value: number | string): number | null {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function asNumber(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return "";
}

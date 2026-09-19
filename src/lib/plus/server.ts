import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { isAdminEmail } from "@/lib/admin/emails";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

export type PlayerRow = {
  id: number;
  name: string;
  created_at: string;
};

export type JumpRow = {
  id: number;
  player_id: number;
  height_in: number;
  flight_s: number;
  fps: number;
  notes: string | null;
  created_at: string;
};

export type TeamRow = {
  id: number;
  name: string;
  role: string;
  owner: boolean;
};

export const LIFETIME_CAP = 100;

export type PlusOffer = {
  sold: number;
  cap: number;
  remaining: number;
  lifetimeOpen: boolean;
};

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapPlayer(row: PlayerRow): PlayerRow {
  return { ...row, created_at: asIso(row.created_at) };
}

function mapJump(row: JumpRow): JumpRow {
  return { ...row, created_at: asIso(row.created_at) };
}

function coalescePaid(source: string | null | undefined): boolean {
  return (source ?? "paid") === "paid";
}

async function readOffer(): Promise<PlusOffer> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*) as n from plus_members
    where coalesce(source, 'paid') = 'paid'
  `;
  const sold = Number(rows[0]?.n ?? 0);
  const remaining = Math.max(0, LIFETIME_CAP - sold);
  return {
    sold,
    cap: LIFETIME_CAP,
    remaining,
    lifetimeOpen: sold < LIFETIME_CAP,
  };
}

async function ensureOwnedTeam(sql: Sql, userId: string): Promise<number> {
  const existing = await sql<{ id: number }>`
    select id from teams where owner_user_id = ${userId} limit 1
  `;
  if (existing[0]) {
    const id = existing[0].id;
    await sql`
      insert into team_members (team_id, user_id, role)
      values (${id}, ${userId}, 'owner')
      on conflict do nothing
    `;
    await sql`
      update players set team_id = ${id}
      where user_id = ${userId} and team_id is null
    `;
    return id;
  }
  const created = await sql<{ id: number }>`
    insert into teams (owner_user_id, name)
    values (${userId}, 'Roster')
    returning id
  `;
  const id = created[0].id;
  await sql`
    insert into team_members (team_id, user_id, role)
    values (${id}, ${userId}, 'owner')
    on conflict do nothing
  `;
  await sql`
    update players set team_id = ${id}
    where user_id = ${userId} and team_id is null
  `;
  return id;
}

async function teamsFor(sql: Sql, userId: string): Promise<TeamRow[]> {
  const rows = await sql<{
    id: number;
    name: string;
    role: string;
    owner_user_id: string;
  }>`
    select t.id, t.name, m.role, t.owner_user_id
    from team_members m
    join teams t on t.id = m.team_id
    where m.user_id = ${userId}
    order by case when t.owner_user_id = ${userId} then 0 else 1 end, t.id
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    owner: r.owner_user_id === userId,
  }));
}

async function memberOf(
  sql: Sql,
  userId: string,
  teamId: number,
): Promise<boolean> {
  const rows = await sql<{ user_id: string }>`
    select user_id from team_members
    where team_id = ${teamId} and user_id = ${userId}
    limit 1
  `;
  return rows.length > 0;
}

export const getPlusOffer = createServerFn({ method: "GET" }).handler(
  async () => readOffer(),
);

export const getPlusStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string; source: string | null }>`
      select user_id, source from plus_members where user_id = ${context.userId} limit 1
    `;
    const me = await sql<{ email: string | null }>`
      select email from "user" where id = ${context.userId} limit 1
    `;
    const offer = await readOffer();
    if (rows.length > 0 && coalescePaid(rows[0].source)) {
      await ensureOwnedTeam(sql, context.userId).catch(() => null);
    }
    return {
      plus: rows.length > 0,
      offer,
      admin: isAdminEmail(me[0]?.email),
    };
  });

export const unlockPlus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`
      insert into plus_members (user_id, source)
      values (${context.userId}, 'paid')
      on conflict (user_id) do update
        set source = 'paid'
    `;
    await ensureOwnedTeam(sql, context.userId);
    return { plus: true };
  });

export const listTeams = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const plus = await sql<{ user_id: string; source: string | null }>`
      select user_id, source from plus_members where user_id = ${context.userId} limit 1
    `;
    if (plus.length && coalescePaid(plus[0].source)) {
      await ensureOwnedTeam(sql, context.userId);
    }
    return teamsFor(sql, context.userId);
  });

export const createCoachInvite = createServerFn({ method: "POST" })
  .validator((teamId: number) => teamId)
  .middleware([authMiddleware])
  .handler(async ({ context, data: teamId }) => {
    const sql = await getSql();
    const plus = await sql<{ user_id: string }>`
      select user_id from plus_members where user_id = ${context.userId} limit 1
    `;
    if (!plus.length) throw new Error("HangTime Plus only.");
    let id = teamId;
    if (!id) {
      const mine = await teamsFor(sql, context.userId);
      id = mine.find((t) => t.owner)?.id ?? mine[0]?.id ?? 0;
      if (!id) id = await ensureOwnedTeam(sql, context.userId);
    }
    if (!(await memberOf(sql, context.userId, id))) {
      throw new Error("You are not on that roster.");
    }
    const token = randomBytes(16).toString("hex");
    await sql`
      insert into team_invites (token, team_id, created_by)
      values (${token}, ${id}, ${context.userId})
    `;
    return { token, path: `/join/${token}` };
  });

export const acceptCoachInvite = createServerFn({ method: "POST" })
  .validator((token: string) => token.trim())
  .middleware([authMiddleware])
  .handler(async ({ context, data: token }) => {
    if (!token) throw new Error("Missing invite.");
    const sql = await getSql();
    const invite = await sql<{ team_id: number }>`
      select team_id from team_invites where token = ${token} limit 1
    `;
    if (!invite[0]) throw new Error("Invite is invalid or expired.");
    const teamId = invite[0].team_id;
    await sql`
      insert into team_members (team_id, user_id, role)
      values (${teamId}, ${context.userId}, 'coach')
      on conflict do nothing
    `;
    await sql`
      insert into plus_members (user_id, source)
      values (${context.userId}, 'comp')
      on conflict (user_id) do nothing
    `;
    return { plus: true, teamId };
  });

export const listPlayers = createServerFn({ method: "POST" })
  .validator((teamId: number | null) => teamId)
  .middleware([authMiddleware])
  .handler(async ({ context, data: teamId }) => {
    const sql = await getSql();
    const plus = await sql<{ user_id: string; source: string | null }>`
      select user_id, source from plus_members where user_id = ${context.userId} limit 1
    `;
    if (plus.length && coalescePaid(plus[0].source)) {
      await ensureOwnedTeam(sql, context.userId);
    }
    if (teamId && !(await memberOf(sql, context.userId, teamId))) return [];
    const rows = teamId
      ? await sql<PlayerRow>`
          select id, name, created_at from players
          where team_id = ${teamId}
          order by name
        `
      : await sql<PlayerRow>`
          select p.id, p.name, p.created_at
          from players p
          join team_members m on m.team_id = p.team_id
          where m.user_id = ${context.userId}
          order by p.name
        `;
    if (rows.length) return rows.map(mapPlayer);
    const legacy = await sql<PlayerRow>`
      select id, name, created_at from players
      where user_id = ${context.userId}
      order by name
    `;
    return legacy.map(mapPlayer);
  });

export const addPlayer = createServerFn({ method: "POST" })
  .validator((input: { name: string; teamId: number | null }) => ({
    name: input.name.trim().slice(0, 80),
    teamId: input.teamId,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.name) return null;
    const sql = await getSql();
    let teamId = data.teamId;
    if (teamId && !(await memberOf(sql, context.userId, teamId))) {
      throw new Error("You are not on that roster.");
    }
    if (!teamId) {
      const plus = await sql<{ user_id: string; source: string | null }>`
        select user_id, source from plus_members where user_id = ${context.userId} limit 1
      `;
      if (plus.length && coalescePaid(plus[0].source)) {
        teamId = await ensureOwnedTeam(sql, context.userId);
      } else {
        const teams = await teamsFor(sql, context.userId);
        teamId = teams[0]?.id ?? null;
      }
    }
    if (!teamId) throw new Error("No roster to add to.");
    const rows = await sql<PlayerRow>`
      insert into players (user_id, team_id, name)
      values (${context.userId}, ${teamId}, ${data.name})
      returning id, name, created_at
    `;
    return rows[0] ? mapPlayer(rows[0]) : null;
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .validator((id: number) => id)
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    await sql`
      delete from players p
      using team_members m
      where p.id = ${id}
        and p.team_id = m.team_id
        and m.user_id = ${context.userId}
    `;
    await sql`
      delete from players
      where id = ${id} and user_id = ${context.userId} and team_id is null
    `;
    return { ok: true };
  });

export const listJumps = createServerFn({ method: "POST" })
  .validator((playerId: number) => playerId)
  .middleware([authMiddleware])
  .handler(async ({ context, data: playerId }) => {
    const sql = await getSql();
    const rows = await sql<JumpRow>`
      select j.id, j.player_id, j.height_in, j.flight_s, j.fps, j.notes, j.created_at
      from jumps j
      join players p on p.id = j.player_id
      where j.player_id = ${playerId}
        and (
          exists (
            select 1 from team_members m
            where m.team_id = p.team_id and m.user_id = ${context.userId}
          )
          or p.user_id = ${context.userId}
        )
      order by j.created_at desc
    `;
    return rows.map(mapJump);
  });

export const addJump = createServerFn({ method: "POST" })
  .validator((input: {
    playerId: number;
    heightIn: number;
    flightS: number;
    fps: number;
    notes?: string;
  }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql<{ id: number }>`
      select p.id from players p
      where p.id = ${data.playerId}
        and (
          exists (
            select 1 from team_members m
            where m.team_id = p.team_id and m.user_id = ${context.userId}
          )
          or p.user_id = ${context.userId}
        )
      limit 1
    `;
    if (!owned.length) return null;
    const notes = data.notes?.trim().slice(0, 200) || null;
    const rows = await sql<JumpRow>`
      insert into jumps (user_id, player_id, height_in, flight_s, fps, notes)
      values (
        ${context.userId},
        ${data.playerId},
        ${data.heightIn},
        ${data.flightS},
        ${data.fps},
        ${notes}
      )
      returning id, player_id, height_in, flight_s, fps, notes, created_at
    `;
    return rows[0] ? mapJump(rows[0]) : null;
  });

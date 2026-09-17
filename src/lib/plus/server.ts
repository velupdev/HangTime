import { createServerFn } from "@tanstack/react-start";
import { isAdminEmail } from "@/lib/admin/emails";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

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

async function readOffer(): Promise<PlusOffer> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*) as n from plus_members
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

export const getPlusOffer = createServerFn({ method: "GET" }).handler(
  async () => readOffer(),
);

export const getPlusStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from plus_members where user_id = ${context.userId} limit 1
    `;
    const me = await sql<{ email: string | null }>`
      select email from "user" where id = ${context.userId} limit 1
    `;
    const offer = await readOffer();
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
    const existing = await sql<{ user_id: string }>`
      select user_id from plus_members where user_id = ${context.userId} limit 1
    `;
    if (existing.length > 0) return { plus: true };
    await sql`
      insert into plus_members (user_id)
      values (${context.userId})
      on conflict (user_id) do nothing
    `;
    return { plus: true };
  });

export const listPlayers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<PlayerRow>`
      select id, name, created_at
      from players
      where user_id = ${context.userId}
      order by name
    `;
    return rows.map(mapPlayer);
  });

export const addPlayer = createServerFn({ method: "POST" })
  .validator((name: string) => name.trim().slice(0, 80))
  .middleware([authMiddleware])
  .handler(async ({ context, data: name }) => {
    if (!name) return null;
    const sql = await getSql();
    const rows = await sql<PlayerRow>`
      insert into players (user_id, name)
      values (${context.userId}, ${name})
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
      delete from players where id = ${id} and user_id = ${context.userId}
    `;
    return { ok: true };
  });

export const listJumps = createServerFn({ method: "POST" })
  .validator((playerId: number) => playerId)
  .middleware([authMiddleware])
  .handler(async ({ context, data: playerId }) => {
    const sql = await getSql();
    const rows = await sql<JumpRow>`
      select id, player_id, height_in, flight_s, fps, notes, created_at
      from jumps
      where user_id = ${context.userId} and player_id = ${playerId}
      order by created_at desc
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
      select id from players
      where id = ${data.playerId} and user_id = ${context.userId}
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

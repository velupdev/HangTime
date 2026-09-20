import { createServerFn } from "@tanstack/react-start";
import { isAdminEmail } from "@/lib/admin/emails";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { LIFETIME_CAP } from "@/lib/plus/server";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plus: boolean;
  plusSource: string | null;
  playerCount: number;
  jumpCount: number;
  createdAt: string;
};

export type AdminSnapshot = {
  users: AdminUserRow[];
  pending: string[];
  totals: {
    signedIn: number;
    plus: number;
    players: number;
    jumps: number;
    lifetimeLeft: number;
  };
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
  return "";
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

async function requireAdmin(userId: string) {
  const sql = await getSql();
  const me = await sql<{ email: string }>`
    select email from "user" where id = ${userId} limit 1
  `;
  if (!isAdminEmail(me[0]?.email)) {
    throw new Error("Admin only.");
  }
}

export const getAdminSnapshot = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminSnapshot> => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      plus: boolean | string | number;
      plus_source: string | null;
      player_count: number | string;
      jump_count: number | string;
      created_at: unknown;
    }>`
      select
        u.id,
        u.name,
        u.email,
        exists(select 1 from plus_members p where p.user_id = u.id) as plus,
        (select p.source from plus_members p where p.user_id = u.id limit 1) as plus_source,
        (select count(*) from players pl where pl.user_id = u.id) as player_count,
        (select count(*) from jumps j where j.user_id = u.id) as jump_count,
        u."createdAt" as created_at
      from "user" u
      order by u."createdAt" desc
    `;
    const users: AdminUserRow[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      plus: row.plus === true || row.plus === "t" || row.plus === 1,
      plusSource: row.plus_source,
      playerCount: Number(row.player_count) || 0,
      jumpCount: Number(row.jump_count) || 0,
      createdAt: asIso(row.created_at),
    }));
    const pendingRows = await sql<{ email: string }>`
      select email from plus_grants order by created_at desc
    `;
    const plus = users.filter((u) => u.plus).length;
    const paidRows = await sql<{ n: number }>`
      select count(*) as n from plus_members
      where coalesce(source, 'paid') = 'paid'
    `;
    const paid = Number(paidRows[0]?.n ?? plus);
    return {
      users,
      pending: pendingRows.map((r) => r.email),
      totals: {
        signedIn: users.length,
        plus,
        players: users.reduce((n, u) => n + u.playerCount, 0),
        jumps: users.reduce((n, u) => n + u.jumpCount, 0),
        lifetimeLeft: Math.max(0, LIFETIME_CAP - paid),
      },
    };
  });

export const grantCompPlus = createServerFn({ method: "POST" })
  .validator((email: string) => normalizeEmail(email))
  .middleware([authMiddleware])
  .handler(async ({ context, data: email }) => {
    await requireAdmin(context.userId);
    if (!email.includes("@") || email.length > 120) {
      throw new Error("Enter a valid email.");
    }
    const sql = await getSql();
    const existing = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email} limit 1
    `;
    if (existing[0]) {
      const member = await sql<{ user_id: string }>`
        select user_id from plus_members where user_id = ${existing[0].id} limit 1
      `;
      if (!member.length) {
        await sql`
          insert into plus_members (user_id, source)
          values (${existing[0].id}, 'comp')
          on conflict (user_id) do nothing
        `;
      }
      await sql`delete from plus_grants where email = ${email}`;
      return { status: "active" as const, email };
    }
    await sql`
      insert into plus_grants (email)
      values (${email})
      on conflict (email) do nothing
    `;
    return { status: "pending" as const, email };
  });

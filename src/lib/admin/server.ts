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
  playerCount: number;
  jumpCount: number;
  createdAt: string;
};

export type AdminSnapshot = {
  users: AdminUserRow[];
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
      player_count: number | string;
      jump_count: number | string;
      created_at: unknown;
    }>`
      select
        u.id,
        u.name,
        u.email,
        exists(select 1 from plus_members p where p.user_id = u.id) as plus,
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
      playerCount: Number(row.player_count) || 0,
      jumpCount: Number(row.jump_count) || 0,
      createdAt: asIso(row.created_at),
    }));
    const plus = users.filter((u) => u.plus).length;
    return {
      users,
      totals: {
        signedIn: users.length,
        plus,
        players: users.reduce((n, u) => n + u.playerCount, 0),
        jumps: users.reduce((n, u) => n + u.jumpCount, 0),
        lifetimeLeft: Math.max(0, LIFETIME_CAP - plus),
      },
    };
  });

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { jumpsToCsv } from "./export-file.ts";
import { loadRosterExport, type RosterExport } from "./roster-export.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("loadRosterExport", { timeout: 60_000 }, () => {
  let sql: Sql;
  let varsity = 0;
  let hoops = 0;

  before(async () => {
    const pg = new PGlite();
    await pg.waitReady;
    const files = readdirSync(join(root, "migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of files) {
      await pg.exec(readFileSync(join(root, "migrations", name), "utf8"));
    }
    sql = asSql(pg);

    varsity = await team(sql, "coach-a", "Varsity");
    hoops = await team(sql, "coach-b", "Hoops");
    await member(sql, varsity, "coach-a", "owner");
    await member(sql, hoops, "coach-b", "owner");
    await member(sql, varsity, "coach-c", "coach");

    const alex = await player(sql, "coach-a", varsity, "Alex", "1st hour");
    await player(sql, "coach-a", varsity, "Blake", "basketball");
    const casey = await player(sql, "coach-a", varsity, "Casey", "1st hour");
    await player(sql, "coach-c", varsity, "Invitee", "basketball");
    const secret = await player(sql, "coach-b", hoops, "Secret", "1st hour");
    await player(sql, "coach-a", null, "Legacy", null);
    const solo = await player(sql, "coach-d", null, "Solo", null);
    await player(sql, "coach-a", varsity, "Pat", "100%");
    await player(sql, "coach-a", varsity, "Pat X", "100X");

    await jump(sql, "coach-a", alex, 20.04, "2026-03-01T15:00:00.000Z", "gym, main");
    await jump(sql, "coach-a", alex, 30, "2026-03-08T18:30:00.000Z", null);
    await jump(sql, "coach-a", casey, 22.5, "2026-01-02T00:00:00.000Z", null);
    await jump(sql, "coach-b", secret, 99, "2026-01-01T00:00:00.000Z", "private");
    await jump(sql, "coach-d", solo, 15, "2026-02-02T00:00:00.000Z", "=1+1");
  });

  it("exports only the selected roster the coach belongs to", async () => {
    const data = await loadRosterExport(sql, "coach-a", { teamId: varsity, groupName: "" });
    assert.equal(data.roster, "Varsity");
    assert.deepEqual(names(data).sort(), ["Alex", "Blake", "Casey", "Invitee", "Pat", "Pat X"]);
    assert.equal(data.players.find((player) => player.name === "Alex")?.jumps.length, 2);
    assert.equal(data.players.find((player) => player.name === "Blake")?.jumps.length, 0);
    assertNoLeak(data);
  });

  it("keeps an invited coach on the shared roster and off every other one", async () => {
    const data = await loadRosterExport(sql, "coach-c", { teamId: varsity, groupName: "" });
    assert.deepEqual(names(data).sort(), ["Alex", "Blake", "Casey", "Invitee", "Pat", "Pat X"]);
    await assert.rejects(
      () => loadRosterExport(sql, "coach-c", { teamId: hoops, groupName: "" }),
      /not on that roster/,
    );
    await assert.rejects(
      () => loadRosterExport(sql, "coach-a", { teamId: hoops, groupName: "" }),
      /not on that roster/,
    );
  });

  it("lets the other coach export their own roster only", async () => {
    const data = await loadRosterExport(sql, "coach-b", { teamId: hoops, groupName: "" });
    assert.equal(data.roster, "Hoops");
    assert.deepEqual(names(data), ["Secret"]);
    assert.equal(data.players[0]?.jumps[0]?.heightIn, 99);
  });

  it("applies the group filter after authorization, with exact labels", async () => {
    const hour = await loadRosterExport(sql, "coach-a", {
      teamId: varsity,
      groupName: "1st hour",
    });
    assert.deepEqual(names(hour).sort(), ["Alex", "Casey"]);
    const alex = hour.players.find((player) => player.name === "Alex");
    assert.equal(alex?.jumps[0]?.notes, "gym, main");
    assert.equal(alex?.jumps[1]?.heightIn, 30);

    const percent = await loadRosterExport(sql, "coach-a", {
      teamId: varsity,
      groupName: "100%",
    });
    assert.deepEqual(names(percent), ["Pat"]);

    const none = await loadRosterExport(sql, "coach-a", {
      teamId: varsity,
      groupName: "1st hour",
    });
    const csv = jumpsToCsv(none);
    assert.match(csv, /Alex/);
    assert.doesNotMatch(csv, /Secret/);
    assert.doesNotMatch(csv, /99\.0/);
    assert.doesNotMatch(csv, /Blake/);
  });

  it("does not add hidden legacy players when the coach already has a roster", async () => {
    const data = await loadRosterExport(sql, "coach-a", { teamId: null, groupName: "" });
    assert.equal(data.roster, "Varsity");
    assert.equal(names(data).includes("Legacy"), false);
    assert.equal(names(data).includes("Secret"), false);
  });

  it("exports a coach who only has unassigned players they created", async () => {
    const data = await loadRosterExport(sql, "coach-d", { teamId: null, groupName: "" });
    assert.deepEqual(names(data), ["Solo"]);
    assert.equal(data.players[0]?.jumps[0]?.notes, "=1+1");
    await assert.rejects(
      () => loadRosterExport(sql, "coach-d", { teamId: varsity, groupName: "" }),
      /not on that roster/,
    );
  });
});

function names(data: RosterExport): string[] {
  return data.players.map((player) => player.name);
}

function assertNoLeak(data: RosterExport) {
  const blob = JSON.stringify(data);
  assert.equal(blob.includes("Secret"), false);
  assert.equal(blob.includes("private"), false);
  assert.equal(blob.includes("Solo"), false);
}

function asSql(pg: PGlite): Sql {
  const query = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  };
  const sql = (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    return query<T>(text, values);
  }) as Sql;
  sql.query = query;
  return sql;
}

async function team(sql: Sql, owner: string, name: string): Promise<number> {
  const rows = await sql.query<{ id: number }>(
    `insert into teams (owner_user_id, name) values ($1, $2) returning id`,
    [owner, name],
  );
  return Number(rows[0]?.id);
}

async function member(sql: Sql, teamId: number, userId: string, role: string) {
  await sql.query(`insert into team_members (team_id, user_id, role) values ($1, $2, $3)`, [
    teamId,
    userId,
    role,
  ]);
}

async function player(
  sql: Sql,
  userId: string,
  teamId: number | null,
  name: string,
  groupName: string | null,
): Promise<number> {
  const rows = await sql.query<{ id: number }>(
    `insert into players (user_id, team_id, name, group_name) values ($1, $2, $3, $4) returning id`,
    [userId, teamId, name, groupName],
  );
  return Number(rows[0]?.id);
}

async function jump(
  sql: Sql,
  userId: string,
  playerId: number,
  height: number,
  at: string,
  notes: string | null,
) {
  await sql.query(
    `insert into jumps (user_id, player_id, height_in, flight_s, fps, notes, created_at)
     values ($1, $2, $3, 0.5, 240, $4, $5)`,
    [userId, playerId, height, notes, at],
  );
}

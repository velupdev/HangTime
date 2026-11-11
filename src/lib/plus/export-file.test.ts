import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JUMP_COLUMNS,
  SUMMARY_COLUMNS,
  crc32,
  exportFilename,
  jumpsToCsv,
  parseExportScope,
  rosterToXlsx,
  scopeForView,
  scopeKey,
} from "./export-file.ts";
import type { RosterExport } from "./roster-export.ts";

const roster: RosterExport = {
  roster: "Varsity",
  players: [
    {
      name: `José "Ace", Kim`,
      group: "1st hour",
      roster: "Varsity",
      jumps: [
        {
          heightIn: 20.04,
          flightS: 0.4,
          fps: 240,
          notes: 'said "nice"\nnext',
          at: "2026-03-01T15:04:05.000Z",
        },
        {
          heightIn: 30,
          flightS: 0.5,
          fps: 120,
          notes: "=1+1",
          at: "2026-03-08T18:30:00.000Z",
        },
      ],
    },
    {
      name: "Blake",
      group: null,
      roster: "Varsity",
      jumps: [],
    },
  ],
};

describe("jumpsToCsv", () => {
  it("writes a UTF-8 BOM, CRLF rows, and Excel-safe quoting", () => {
    const csv = jumpsToCsv(roster);
    const bytes = new TextEncoder().encode(csv);
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(csv.includes("\n") && !csv.includes("\r\n") ? "lf-only" : "crlf", "crlf");
    assert.ok(csv.startsWith(`\uFEFF${JUMP_COLUMNS.join(",")}\r\n`));

    const rows = parseCsv(csv.slice(1));
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0], [...JUMP_COLUMNS]);

    const first = row(rows[1]);
    assert.equal(first.Athlete, `José "Ace", Kim`);
    assert.equal(first.Group, "1st hour");
    assert.equal(first.Roster, "Varsity");
    assert.equal(first.Date, "2026-03-01");
    assert.equal(first["Time (UTC)"], "15:04:05");
    assert.equal(first["Vertical (in)"], "20.0");
    assert.equal(first["Flight (s)"], "0.400");
    assert.equal(first.FPS, "240");
    assert.equal(first.Notes, 'said "nice"\nnext');
    assert.equal(first.Jumps, "2");
    assert.equal(first["Best (in)"], "30.0");
    assert.equal(first["Average (in)"], "25.0");

    const second = row(rows[2]);
    assert.equal(second.Date, "2026-03-08");
    assert.equal(second.Notes, "'=1+1");
    assert.equal(second["Vertical (in)"], "30.0");

    const empty = row(rows[3]);
    assert.equal(empty.Athlete, "Blake");
    assert.equal(empty.Group, "");
    assert.equal(empty["Vertical (in)"], "");
    assert.equal(empty.Jumps, "0");
    assert.equal(empty["Best (in)"], "");
    assert.equal(empty["Average (in)"], "");
  });
});

describe("rosterToXlsx", () => {
  it("stores a summary sheet and a jump sheet Excel can unzip", () => {
    const files = unzipStore(rosterToXlsx(roster));
    const summary = text(files, "xl/worksheets/sheet1.xml");
    const jumps = text(files, "xl/worksheets/sheet2.xml");
    const workbook = text(files, "xl/workbook.xml");

    assert.match(workbook, /name="Summary"/);
    assert.match(workbook, /name="Jumps"/);
    assert.match(summary, /Blake/);
    assert.match(summary, /<v>30\.0<\/v>/);
    assert.match(summary, /<v>25\.0<\/v>/);
    assert.match(summary, /2026-03-01/);
    assert.match(summary, /2026-03-08/);
    assert.match(jumps, /José &quot;Ace&quot;, Kim/);
    assert.match(jumps, /'=1\+1/);
    assert.doesNotMatch(jumps, /Secret/);
    for (const header of SUMMARY_COLUMNS) assert.match(summary, new RegExp(escapeRegExp(header)));
    for (const header of JUMP_COLUMNS) assert.match(jumps, new RegExp(escapeRegExp(header)));
  });
});

const history: RosterExport = {
  roster: "Varsity",
  players: [
    {
      name: "Alex",
      group: "1st hour",
      roster: "Varsity",
      jumps: [
        {
          heightIn: 18,
          flightS: 0.4,
          fps: 240,
          notes: "warmup",
          at: "2026-01-15T10:00:00.000Z",
        },
        {
          heightIn: 30,
          flightS: 0.5,
          fps: 240,
          notes: null,
          at: "2026-03-08T18:30:00.000Z",
        },
        {
          heightIn: 24,
          flightS: 0.45,
          fps: 240,
          notes: "latest",
          at: "2026-04-01T12:00:00.000Z",
        },
      ],
    },
  ],
};

describe("full jump history", () => {
  it("keeps every jump in the CSV and on the Excel Jumps sheet", () => {
    const rows = parseCsv(jumpsToCsv(history).slice(1));
    assert.deepEqual(
      rows.slice(1).map((cells) => row(cells).Date),
      ["2026-01-15", "2026-03-08", "2026-04-01"],
    );
    assert.equal(row(rows[1])["Vertical (in)"], "18.0");
    assert.equal(row(rows[2])["Vertical (in)"], "30.0");
    assert.equal(row(rows[3])["Vertical (in)"], "24.0");
    assert.equal(row(rows[3])["Best (in)"], "30.0");
    assert.equal(row(rows[3]).Jumps, "3");

    const files = unzipStore(rosterToXlsx(history));
    const jumps = text(files, "xl/worksheets/sheet2.xml");
    const summary = text(files, "xl/worksheets/sheet1.xml");
    assert.equal(jumps.match(/<row /g)?.length, 4);
    assert.match(jumps, /2026-01-15/);
    assert.match(jumps, /2026-03-08/);
    assert.match(jumps, /2026-04-01/);
    assert.match(jumps, /<v>18\.0<\/v>/);
    assert.match(jumps, /<v>24\.0<\/v>/);
    assert.equal(summary.match(/<row /g)?.length, 2);
    assert.match(summary, /<v>3<\/v>/);
    assert.match(summary, /<v>30\.0<\/v>/);
  });
});

describe("export scope", () => {
  it("follows the open athlete, then a group filter, and round-trips the select value", () => {
    assert.deepEqual(scopeForView("all", null), { kind: "all" });
    assert.deepEqual(scopeForView("all", 4), { kind: "player", playerId: 4 });
    assert.deepEqual(scopeForView("1st hour", 4), { kind: "group", group: "1st hour" });
    const key = scopeKey({ kind: "group", group: "100%" });
    assert.deepEqual(parseExportScope(key), { kind: "group", group: "100%" });
    assert.deepEqual(parseExportScope("player:12"), { kind: "player", playerId: 12 });
    assert.deepEqual(parseExportScope("nope"), { kind: "all" });
  });
});

describe("exportFilename", () => {
  it("slugs roster and group into an ascii download name", () => {
    const day = new Date("2026-11-11T12:00:00.000Z");
    assert.equal(
      exportFilename("Varsity", "1st hour", "csv", day),
      "hangtime-varsity-1st-hour-2026-11-11.csv",
    );
    assert.equal(
      exportFilename("José's Roster", null, "xlsx", day),
      "hangtime-jose-s-roster-2026-11-11.xlsx",
    );
  });
});

describe("crc32", () => {
  it("matches the ISO HDLC check value", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });
});

function row(cells: string[]): Record<string, string> {
  return Object.fromEntries(JUMP_COLUMNS.map((column, index) => [column, cells[index] ?? ""]));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let rowCells: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      rowCells.push(cell);
      cell = "";
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      rowCells.push(cell);
      rows.push(rowCells);
      rowCells = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  return rows;
}

function unzipStore(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const data = bytes.subarray(dataStart, dataStart + size);
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLen));
    assert.equal(method, 0, name);
    assert.equal(crc32(data), crc, name);
    files.set(name, data);
    offset = dataStart + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  return files;
}

function text(files: Map<string, Uint8Array>, name: string): string {
  const data = files.get(name);
  assert.ok(data, name);
  return new TextDecoder().decode(data);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

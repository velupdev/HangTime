import type { ExportJump, ExportPlayer, RosterExport } from "./roster-export";

/** What the coach chose to download. The file still contains every jump in that set. */
export type ExportScope =
  { kind: "all" } | { kind: "group"; group: string } | { kind: "player"; playerId: number };

/**
 * The scope that matches the portal. A group chip wins. With every group
 * showing, the open athlete is the default. Otherwise the whole roster.
 */
export function scopeForView(groupFilter: string, selectedPlayerId: number | null): ExportScope {
  if (groupFilter !== "all") return { kind: "group", group: groupFilter };
  if (selectedPlayerId !== null) return { kind: "player", playerId: selectedPlayerId };
  return { kind: "all" };
}

export function scopeKey(scope: ExportScope): string {
  if (scope.kind === "all") return "all";
  if (scope.kind === "group") return `group:${encodeURIComponent(scope.group)}`;
  return `player:${scope.playerId}`;
}

export function parseExportScope(value: string): ExportScope {
  if (value.startsWith("group:")) {
    try {
      const group = decodeURIComponent(value.slice("group:".length));
      if (group) return { kind: "group", group };
    } catch {
      return { kind: "all" };
    }
  }
  if (value.startsWith("player:")) {
    const playerId = Number(value.slice("player:".length));
    if (Number.isInteger(playerId) && playerId > 0) return { kind: "player", playerId };
  }
  return { kind: "all" };
}

/** Jump-log columns. Numbers stay unquoted in CSV so Excel sums them. */
export const JUMP_COLUMNS = [
  "Athlete",
  "Group",
  "Roster",
  "Date",
  "Time (UTC)",
  "Vertical (in)",
  "Flight (s)",
  "FPS",
  "Notes",
  "Jumps",
  "Best (in)",
  "Average (in)",
] as const;

/** Decimal places for numeric jump-log columns. `0` is an integer. */
const JUMP_DECIMALS: Record<number, number> = {
  5: 1,
  6: 3,
  7: 0,
  9: 0,
  10: 1,
  11: 1,
};

export const SUMMARY_COLUMNS = [
  "Athlete",
  "Group",
  "Roster",
  "Jumps",
  "Best (in)",
  "Average (in)",
  "Latest (in)",
  "Latest date",
  "First date",
] as const;

const SUMMARY_DECIMALS: Record<number, number> = {
  3: 0,
  4: 1,
  5: 1,
  6: 1,
};

export type SheetCell = string | number | null;

type AthleteStats = {
  count: number;
  best: number | null;
  average: number | null;
  latest: number | null;
  latestDate: string;
  firstDate: string;
};

/** UTF-8 CSV with a BOM and CRLF rows, so Excel opens names and notes correctly. */
export function jumpsToCsv(data: RosterExport): string {
  const lines = [JUMP_COLUMNS.map(csvCell).join(",")];
  for (const row of jumpRows(data)) {
    lines.push(row.map((cell, index) => csvCell(formatCell(cell, JUMP_DECIMALS[index]))).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Workbook with a per-athlete summary and the same jump log as the CSV. */
export function rosterToXlsx(data: RosterExport): Uint8Array {
  const jumps = jumpRows(data);
  const summary = summaryRows(data);
  return buildXlsx([
    sheetXml("Summary", SUMMARY_COLUMNS, summary, SUMMARY_DECIMALS),
    sheetXml("Jumps", JUMP_COLUMNS, jumps, JUMP_DECIMALS),
  ]);
}

export function exportFilename(
  roster: string,
  group: string | null,
  ext: "csv" | "xlsx",
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10);
  const parts = ["hangtime", slug(roster) || "roster"];
  const groupSlug = group ? slug(group) : "";
  if (groupSlug) parts.push(groupSlug);
  parts.push(day);
  return `${parts.join("-")}.${ext}`;
}

function jumpRows(data: RosterExport): SheetCell[][] {
  const rows: SheetCell[][] = [];
  for (const player of data.players) {
    const stats = athleteStats(player.jumps);
    if (player.jumps.length === 0) {
      rows.push(jumpRow(player, null, stats));
      continue;
    }
    for (const jump of player.jumps) rows.push(jumpRow(player, jump, stats));
  }
  return rows;
}

function jumpRow(player: ExportPlayer, jump: ExportJump | null, stats: AthleteStats): SheetCell[] {
  const stamp = jump ? splitStamp(jump.at) : { date: "", timeUtc: "" };
  return [
    player.name,
    player.group ?? "",
    player.roster,
    stamp.date,
    stamp.timeUtc,
    jump ? roundTo(jump.heightIn, 1) : null,
    jump ? roundTo(jump.flightS, 3) : null,
    jump ? roundTo(jump.fps, 0) : null,
    jump?.notes ?? "",
    stats.count,
    stats.best,
    stats.average,
  ];
}

function summaryRows(data: RosterExport): SheetCell[][] {
  return data.players.map((player) => {
    const stats = athleteStats(player.jumps);
    return [
      player.name,
      player.group ?? "",
      player.roster,
      stats.count,
      stats.best,
      stats.average,
      stats.latest,
      stats.latestDate,
      stats.firstDate,
    ];
  });
}

function athleteStats(jumps: ExportJump[]): AthleteStats {
  const heights = jumps
    .map((jump) => jump.heightIn)
    .filter((height): height is number => height !== null && Number.isFinite(height));
  const dated = jumps.map((jump) => splitStamp(jump.at).date).filter((date) => date.length > 0);
  if (heights.length === 0) {
    return {
      count: jumps.length,
      best: null,
      average: null,
      latest: null,
      latestDate: dated.at(-1) ?? "",
      firstDate: dated[0] ?? "",
    };
  }
  const sum = heights.reduce((total, height) => total + height, 0);
  const latestHeight =
    [...jumps].reverse().find((jump) => jump.heightIn !== null)?.heightIn ?? null;
  return {
    count: jumps.length,
    best: roundTo(Math.max(...heights), 1),
    average: roundTo(sum / heights.length, 1),
    latest: roundTo(latestHeight, 1),
    latestDate: dated.at(-1) ?? "",
    firstDate: dated[0] ?? "",
  };
}

function roundTo(value: number | null, places: number): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(places));
}

function formatCell(cell: SheetCell, places: number | undefined): SheetCell {
  if (typeof cell !== "number" || places === undefined) return cell;
  return places === 0 ? Math.trunc(cell) : cell.toFixed(places);
}

function splitStamp(iso: string): { date: string; timeUtc: string } {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(iso);
  if (!match) return { date: "", timeUtc: "" };
  return { date: match[1], timeUtc: match[2] };
}

/**
 * RFC 4180 field. Text that Excel would treat as a formula is prefixed so a
 * note or name cannot run a command when the file is opened.
 */
function csvCell(value: SheetCell): string {
  if (value === null || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = guardFormula(stripControls(value));
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function stripControls(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) continue;
    out += char;
  }
  return out;
}

function guardFormula(text: string): string {
  if (!text || /^-?\d+(\.\d+)?$/.test(text)) return text;
  const code = text.charCodeAt(0);
  if (code === 9 || code === 13 || "=+-@".includes(text[0])) return `'${text}`;
  return text;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function sheetXml(
  name: string,
  headers: readonly string[],
  rows: SheetCell[][],
  decimals: Record<number, number>,
): { name: string; xml: string } {
  const width = headers.length;
  const all: SheetCell[][] = [headers.map((header) => header), ...rows];
  const body = all
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, column) =>
          xmlCell(column, rowIndex + 1, cell, rowIndex === 0 ? undefined : decimals[column]),
        )
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const last = columnName(width - 1);
  const cols = headers
    .map((_, index) => `<col min="${index + 1}" max="${index + 1}" width="16" customWidth="1"/>`)
    .join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${last}${all.length}"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${body}</sheetData>` +
    `</worksheet>`;
  return { name, xml };
}

function xmlCell(column: number, row: number, cell: SheetCell, places: number | undefined): string {
  if (cell === null || cell === "") return "";
  const ref = `${columnName(column)}${row}`;
  if (typeof cell === "number" && Number.isFinite(cell) && places !== undefined) {
    const text = places === 0 ? String(Math.trunc(cell)) : cell.toFixed(places);
    return `<c r="${ref}"><v>${text}</v></c>`;
  }
  const text = xmlText(typeof cell === "number" ? String(cell) : cell);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function xmlText(value: string): string {
  const text = guardFormula(stripControls(value));
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal .xlsx (Office Open XML) using uncompressed ZIP entries.
 * No dependency: a roster file is small, and Excel opens stored entries.
 */
function buildXlsx(sheets: { name: string; xml: string }[]): Uint8Array {
  const files: { name: string; data: Uint8Array }[] = [
    { name: "[Content_Types].xml", data: encode(contentTypes(sheets.length)) },
    { name: "_rels/.rels", data: encode(rootRels()) },
    { name: "xl/workbook.xml", data: encode(workbookXml(sheets.map((sheet) => sheet.name))) },
    { name: "xl/_rels/workbook.xml.rels", data: encode(workbookRels(sheets.length)) },
    { name: "xl/styles.xml", data: encode(stylesXml()) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encode(sheet.xml),
    })),
  ];
  return zipStore(files);
}

function contentTypes(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => {
    const part = `/xl/worksheets/sheet${index + 1}.xml`;
    return `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets +
    `</Types>`
  );
}

function rootRels(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`
  );
}

function workbookXml(names: string[]): string {
  const sheets = names
    .map((name, index) => {
      const safe = xmlText(name).slice(0, 31) || `Sheet${index + 1}`;
      return `<sheet name="${safe}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheets}</sheets>` +
    `</workbook>`
  );
}

function workbookRels(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => {
    return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`;
  }).join("");
  const stylesId = sheetCount + 1;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets +
    `<Relationship Id="rId${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`
  );
}

function stylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`
  );
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const { date, time } = dosStamp(new Date(Date.UTC(2026, 0, 1)));
  for (const file of files) {
    const name = encode(file.name);
    const crc = crc32(file.data);
    const localHeader = new Uint8Array(30 + name.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(name, 30);
    local.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    central.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }
  const centralStart = offset;
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  return concat([...local, ...central, end]);
}

function dosStamp(value: Date): { date: number; time: number } {
  const year = Math.max(1980, value.getUTCFullYear());
  return {
    date: ((year - 1980) << 9) | ((value.getUTCMonth() + 1) << 5) | value.getUTCDate(),
    time:
      (value.getUTCHours() << 11) |
      (value.getUTCMinutes() << 5) |
      Math.floor(value.getUTCSeconds() / 2),
  };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

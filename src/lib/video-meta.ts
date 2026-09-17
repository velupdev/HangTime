/** Common camera rates we snap detected fps onto. */
export const STANDARD_FPS = [24, 25, 30, 48, 50, 60, 120, 240, 480, 960] as const;

export type VideoMeta = {
  fileFps: number;
  captureFps: number;
  playbackFps: number;
  bakedSloMo: boolean;
  duration: number;
  frameCount: number;
  quality: "best" | "good" | "ok";
  note: string;
  source: "container" | "fallback";
};

const textDecoder = new TextDecoder("latin1");

function typeAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

type Box = { type: string; header: number; start: number; end: number };

function readBox(view: DataView, offset: number, limit: number): Box | null {
  if (offset + 8 > limit) return null;
  let size = view.getUint32(offset);
  const type = typeAt(view, offset + 4);
  let header = 8;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    const hi = view.getUint32(offset + 8);
    const lo = view.getUint32(offset + 12);
    size = hi * 2 ** 32 + lo;
    header = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (size < header) return null;
  const end = Math.min(offset + size, limit);
  return { type, header, start: offset, end };
}

function walk(
  view: DataView,
  start: number,
  end: number,
  visit: (box: Box) => void,
) {
  let offset = start;
  while (offset + 8 <= end) {
    const box = readBox(view, offset, end);
    if (!box) break;
    visit(box);
    if (box.end <= offset) break;
    offset = box.end;
  }
}

function parseMdhd(
  view: DataView,
  start: number,
): { timescale: number; duration: number } | null {
  if (start + 8 > view.byteLength) return null;
  const version = view.getUint8(start);
  try {
    if (version === 1) {
      const timescale = view.getUint32(start + 20);
      const durHi = view.getUint32(start + 24);
      const durLo = view.getUint32(start + 28);
      return { timescale, duration: durHi * 2 ** 32 + durLo };
    }
    const timescale = view.getUint32(start + 12);
    const duration = view.getUint32(start + 16);
    return { timescale, duration };
  } catch {
    return null;
  }
}

function parseStts(
  view: DataView,
  start: number,
): { samples: number; delta: number } | null {
  if (start + 8 > view.byteLength) return null;
  const entryCount = view.getUint32(start + 4);
  if (entryCount < 1 || start + 8 + entryCount * 8 > view.byteLength) {
    if (entryCount < 1) return null;
    // truncated: read what we can
  }
  let samples = 0;
  let firstDelta = 0;
  const max = Math.min(entryCount, Math.floor((view.byteLength - start - 8) / 8));
  for (let i = 0; i < max; i++) {
    const count = view.getUint32(start + 8 + i * 8);
    const delta = view.getUint32(start + 12 + i * 8);
    samples += count;
    if (i === 0) firstDelta = delta;
  }
  if (samples <= 0 || firstDelta <= 0) return null;
  return { samples, delta: firstDelta };
}

type TrackProbe = {
  handler: string;
  timescale: number;
  duration: number;
  samples: number;
};

function collectTracks(buffer: ArrayBuffer): TrackProbe[] {
  const view = new DataView(buffer);
  const tracks: TrackProbe[] = [];

  function scanMoov(moov: Box) {
    walk(view, moov.start + moov.header, moov.end, (trak) => {
      if (trak.type !== "trak") return;
      const found: {
        handler: string;
        mdhd: { timescale: number; duration: number } | null;
        samples: number;
      } = { handler: "", mdhd: null, samples: 0 };
      const visitNested = (b: Box) => {
        const payload = b.start + b.header;
        if (b.type === "hdlr" && payload + 12 <= view.byteLength) {
          const subtype = typeAt(view, payload + 8);
          if (subtype === "vide" || subtype === "soun" || subtype === "meta") {
            found.handler = subtype;
          }
        }
        if (b.type === "mdhd") found.mdhd = parseMdhd(view, payload);
        if (b.type === "stts") {
          const parsed = parseStts(view, payload);
          if (parsed) found.samples = parsed.samples;
        }
        if (
          b.type === "mdia" ||
          b.type === "minf" ||
          b.type === "stbl" ||
          b.type === "trak"
        ) {
          walk(view, payload, b.end, visitNested);
        }
      };
      walk(view, trak.start + trak.header, trak.end, visitNested);
      if (found.mdhd && found.mdhd.timescale > 0 && found.samples > 0) {
        tracks.push({
          handler: found.handler,
          timescale: found.mdhd.timescale,
          duration: found.mdhd.duration,
          samples: found.samples,
        });
      }
    });
  }

  walk(view, 0, view.byteLength, (box) => {
    if (box.type === "moov") scanMoov(box);
  });
  return tracks;
}

export function snapFps(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  let best: number = STANDARD_FPS[0];
  let bestDist = Math.abs(raw - best);
  for (const n of STANDARD_FPS) {
    const d = Math.abs(raw - n);
    if (d < bestDist) {
      best = n;
      bestDist = d;
    }
  }
  // NTSC 29.97 / 59.94 / 23.976 sit next to 30 / 60 / 24
  if (raw > 23.5 && raw < 24.5) return 24;
  if (raw > 29.5 && raw < 30.5) return 30;
  if (raw > 59.5 && raw < 60.5) return 60;
  if (raw > 119 && raw < 121) return 120;
  if (raw > 238 && raw < 242) return 240;
  if (raw > 470 && raw < 490) return 480;
  if (raw > 900 && raw < 1020) return 960;
  return best;
}

export function interpretTrack(fileFps: number, duration: number, _appleHint: boolean): VideoMeta {
  const snapped = snapFps(fileFps);
  const looksSlowedShare = snapped <= 30 && duration > 6;
  const captureFps = snapped;
  const playbackFps = snapped;
  const quality: VideoMeta["quality"] =
    snapped >= 240 ? "best" : snapped >= 120 ? "good" : "ok";

  let note: string;
  if (looksSlowedShare) {
    note =
      "File is ~30 fps and fairly long — regular video (leave 30) or a gallery slo-mo share that was already slowed. If the jump looks slow-motion, set capture to 120 or 240.";
  } else if (snapped >= 480) {
    note = `Detected ${snapped} fps super slo-mo — extremely precise.`;
  } else if (snapped >= 240) {
    note = "Detected 240 fps slo-mo — best accuracy for a vertical.";
  } else if (snapped >= 120) {
    note = "Detected 120 fps. Plenty for a vertical; 240 fps is only a bit tighter.";
  } else if (snapped >= 60) {
    note = "Detected 60 fps. Usable. Slo-mo at 120 or 240 fps marks takeoff more clearly.";
  } else {
    note =
      "Detected regular video (~" +
      snapped +
      " fps). Still works — mark the exact takeoff and landing frames. 120 or 240 fps slo-mo is more precise.";
  }

  return {
    fileFps,
    captureFps,
    playbackFps,
    bakedSloMo: looksSlowedShare,
    duration,
    frameCount: Math.max(0, Math.round(duration * fileFps)),
    quality,
    note,
    source: "container",
  };
}

function looksApple(bytes: Uint8Array): boolean {
  const head = textDecoder.decode(bytes.subarray(0, Math.min(bytes.byteLength, 64)));
  if (head.includes("qt  ")) return true;
  const sample = textDecoder.decode(bytes.subarray(0, Math.min(bytes.byteLength, 512_000)));
  return (
    sample.includes("Apple") ||
    sample.includes("iPhone") ||
    sample.includes("com.apple.quicktime")
  );
}

export function metaFromBuffer(buffer: ArrayBuffer): VideoMeta | null {
  const tracks = collectTracks(buffer);
  const video = tracks.find((t) => t.handler === "vide") ?? tracks[0];
  if (!video || video.samples < 2 || video.timescale <= 0 || video.duration <= 0) {
    return null;
  }
  const duration = video.duration / video.timescale;
  const fileFps = video.samples / duration;
  const apple = looksApple(new Uint8Array(buffer));
  const meta = interpretTrack(fileFps, duration, apple);
  meta.frameCount = video.samples;
  return meta;
}

export async function probeFileMeta(file: Blob): Promise<VideoMeta | null> {
  const headBytes = Math.min(file.size, 3_000_000);
  const head = await file.slice(0, headBytes).arrayBuffer();
  let meta = metaFromBuffer(head);
  if (meta) return meta;
  if (file.size > headBytes) {
    const tailSize = Math.min(file.size, 2_000_000);
    const tail = await file.slice(file.size - tailSize).arrayBuffer();
    meta = metaFromBuffer(tail);
    if (meta) return meta;
  }
  return null;
}

export async function probeUrlMeta(url: string): Promise<VideoMeta | null> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-2097151" } });
    if (!res.ok) {
      const full = await fetch(url);
      if (!full.ok) return null;
      return metaFromBuffer(await full.arrayBuffer());
    }
    return metaFromBuffer(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export function fallbackMeta(duration: number, assumedFps = 30): VideoMeta {
  const snapped = snapFps(assumedFps);
  return interpretTrack(snapped, duration, false);
}

export function qualityLabel(meta: VideoMeta): string {
  if (meta.bakedSloMo) return `Slowed export · assuming ${meta.captureFps} fps capture`;
  return `Detected ${meta.captureFps} fps`;
}

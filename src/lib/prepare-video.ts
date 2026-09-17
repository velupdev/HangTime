import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { probeFileMeta, type VideoMeta } from "@/lib/video-meta";

export type PrepareProgress = (ratio: number, message: string) => void;

export type PreparedVideo = {
  url: string;
  meta: VideoMeta | null;
};

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

function canPlayHevc(): boolean {
  const v = document.createElement("video");
  return (
    v.canPlayType('video/mp4; codecs="hvc1"') !== "" ||
    v.canPlayType('video/mp4; codecs="hev1"') !== ""
  );
}

function isQuickTime(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "video/quicktime" ||
    name.endsWith(".mov") ||
    name.endsWith(".qt")
  );
}

/** Phones and Safari play HEVC/MOV. ffmpeg.wasm usually OOMs there. */
function useNativeFile(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
  return safari;
}

function testPlayable(url: string, timeoutMs = 4500): Promise<boolean> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      v.removeAttribute("src");
      v.load();
      resolve(ok);
    };
    v.addEventListener("loadeddata", () => done(v.videoWidth > 0));
    v.addEventListener("error", () => done(false));
    window.setTimeout(() => done(v.readyState >= 2 && v.videoWidth > 0), timeoutMs);
    v.src = url;
  });
}

async function getFfmpeg(onProgress: PrepareProgress): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;
  if (ffmpegLoading) return ffmpegLoading;
  ffmpegLoading = (async () => {
    onProgress(0.02, "Loading video engine…");
    const instance = new FFmpeg();
    instance.on("progress", ({ progress }) => {
      onProgress(Math.min(0.95, 0.15 + progress * 0.8), "Converting iPhone clip…");
    });
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
    await instance.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpeg = instance;
    return instance;
  })();
  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

async function runToBlob(ff: FFmpeg, args: string[]): Promise<string> {
  await ff.exec(args);
  const data = await ff.readFile("out.mp4");
  const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  try {
    await ff.deleteFile("out.mp4");
  } catch {
    /* ignore */
  }
  const blob = new Blob([copy.buffer], { type: "video/mp4" });
  return URL.createObjectURL(blob);
}

async function transcode(file: File, onProgress: PrepareProgress): Promise<string> {
  const ff = await getFfmpeg(onProgress);
  onProgress(0.12, "Reading iPhone video…");
  await ff.writeFile("input", await fetchFile(file));

  onProgress(0.16, "Trying a fast remux for PC playback…");
  try {
    const remuxed = await runToBlob(ff, [
      "-i", "input", "-an", "-c", "copy", "-movflags", "+faststart", "out.mp4",
    ]);
    if (await testPlayable(remuxed, 5000)) {
      try { await ff.deleteFile("input"); } catch { /* ignore */ }
      return remuxed;
    }
    URL.revokeObjectURL(remuxed);
  } catch {
    /* HEVC / odd MOV — fall through to a real convert */
  }

  onProgress(0.22, "Converting so Chrome/Edge on a PC can play it…");
  try {
    const converted = await runToBlob(ff, [
      "-i", "input", "-an", "-vf", "scale='min(960,iw)':-2", "-c:v", "libx264",
      "-preset", "ultrafast", "-crf", "28", "-pix_fmt", "yuv420p", "-g", "8",
      "-movflags", "+faststart", "out.mp4",
    ]);
    try { await ff.deleteFile("input"); } catch { /* ignore */ }
    return converted;
  } catch {
    try { await ff.deleteFile("input"); } catch { /* ignore */ }
    throw new Error("convert-failed");
  }
}

export async function prepareVideoFile(
  file: File,
  onProgress: PrepareProgress,
): Promise<PreparedVideo> {
  onProgress(0.04, "Reading frame rate…");
  const meta = await probeFileMeta(file);
  const original = URL.createObjectURL(file);

  if (useNativeFile()) {
    onProgress(1, "Ready");
    return { url: original, meta };
  }

  const nativeOk = await testPlayable(original);
  const hevcOk = canPlayHevc();
  const mov = isQuickTime(file);

  if (nativeOk && (!mov || hevcOk)) {
    onProgress(1, "Ready");
    return { url: original, meta };
  }

  try {
    const converted = await transcode(file, onProgress);
    URL.revokeObjectURL(original);
    const convertedOk = await testPlayable(converted, 8000);
    if (!convertedOk) {
      URL.revokeObjectURL(converted);
      throw new Error("converted-unplayable");
    }
    onProgress(1, "Ready");
    return { url: converted, meta };
  } catch {
    onProgress(1, "Ready");
    return { url: original, meta };
  }
}

export const SAMPLE_VIDEO = "/demo-jump.mp4";
export const SAMPLE_FPS = 240;
export const SAMPLE_TAKEOFF = 96;
export const SAMPLE_LANDING = 216;

export const USER_JUMP_VIDEO = "/user-jump.mp4";
export const USER_JUMP_PLAYBACK_FPS = 30;
export const USER_JUMP_CAPTURE_FPS = 120;

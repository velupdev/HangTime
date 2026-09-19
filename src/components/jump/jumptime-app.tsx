import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AdSlot } from "@/components/ads/ad-slot";
import { Button } from "@/components/ui/button";
import { computeJump, formatHeight } from "@/lib/jump-math";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { prepareVideoFile } from "@/lib/prepare-video";
import { addJump, getPlusOffer, getPlusStatus, listPlayers, type PlayerRow } from "@/lib/plus/server";
import { type VideoMeta } from "@/lib/video-meta";
import { cn } from "@/lib/utils";

type Units = "in" | "cm";

const FILE_ACCEPT = "video/*,.mov,.mp4,.m4v,.webm,.mkv,.3gp";

export function HangTimeApp() {
  const [hydrated, setHydrated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [ownsUrl, setOwnsUrl] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [captureFps, setCaptureFps] = useState(120);
  const [fileFps, setFileFps] = useState(120);
  const [units, setUnits] = useState<Units>("in");
  const [frame, setFrame] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [takeoff, setTakeoff] = useState<number | null>(null);
  const [landing, setLanding] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const { user, isPending: authPending } = useCurrentUserState();
  const [isPlus, setIsPlus] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spotsLeft, setSpotsLeft] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [savePlayerId, setSavePlayerId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const playbackFps = fileFps;
  const maxFrame = Math.max(0, Math.round(duration * playbackFps) - 1);
  const result =
    takeoff !== null && landing !== null
      ? computeJump(takeoff, landing, captureFps)
      : null;
  const implausible =
    result !== null && (result.seconds > 0.85 || result.meters * 39.3700787 > 36);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    void getPlusOffer()
      .then((o) => setSpotsLeft(o.remaining))
      .catch(() => setSpotsLeft(null));
  }, []);

  useEffect(() => {
    if (authPending || !user) {
      setIsPlus(false);
      setIsAdmin(false);
      setPlayers([]);
      return;
    }
    void getPlusStatus()
      .then((s) => {
        setIsPlus(s.plus);
        setIsAdmin(s.admin);
        if (s.plus) {
          return listPlayers({ data: null }).then((rows) => {
            setPlayers(rows);
            setSavePlayerId((id) => id ?? rows[0]?.id ?? null);
          });
        }
      })
      .catch(() => {
        setIsPlus(false);
        setIsAdmin(false);
      });
  }, [authPending, user]);

  const seekFrame = useCallback(
    (next: number) => {
      const video = videoRef.current;
      if (!video) return;
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
      if (!dur) return;
      const last = Math.max(0, Math.round(dur * playbackFps) - 1);
      const clamped = Math.max(0, Math.min(next, last));
      video.pause();
      setPlaying(false);
      video.currentTime = Math.min(dur - 0.0001, (clamped + 0.05) / playbackFps);
      setFrame(clamped);
    },
    [duration, playbackFps],
  );

  const applyMeta = useCallback((meta: VideoMeta) => {
    const fps = Math.max(meta.playbackFps, meta.captureFps);
    setFileFps(meta.playbackFps);
    setCaptureFps(fps);
  }, []);

  const loadUrl = useCallback((url: string, name: string, revokeable: boolean) => {
    setVideoUrl((prev) => {
      if (prev && ownsUrl) URL.revokeObjectURL(prev);
      return url;
    });
    setOwnsUrl(revokeable);
    setFileName(name);
    setTakeoff(null);
    setLanding(null);
    setFrame(0);
    setPlaying(false);
    setError(null);
    setSaved(false);
  }, [ownsUrl]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy("Opening video…");
    setProgress(0.05);
    setError(null);
    try {
      const prepared = await prepareVideoFile(file, (ratio, message) => {
        setProgress(ratio);
        setBusy(message);
      });
      loadUrl(prepared.url, file.name, true);
      if (prepared.meta) applyMeta(prepared.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that video.");
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  function resetMarks() {
    setTakeoff(null);
    setLanding(null);
    seekFrame(0);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    const onMeta = () => {
      setDuration(video.duration || 0);
      seekFrame(0);
    };
    const onTime = () => {
      setFrame(Math.round(video.currentTime * playbackFps));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.load();
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoUrl, playbackFps, seekFrame]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!videoUrl) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekFrame(frame - (e.shiftKey ? 10 : 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekFrame(frame + (e.shiftKey ? 10 : 1));
      } else if (e.key === " ") {
        e.preventDefault();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) void video.play();
        else video.pause();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoUrl, frame, seekFrame]);

  const unitsSelect = (
    <label className="flex items-center gap-2 text-sm text-muted">
      Units
      <select
        value={units}
        onChange={(e) => setUnits(e.target.value as Units)}
        className="h-11 min-h-11 rounded-md bg-surface px-3 text-fg shadow-[var(--shadow-border)]"
      >
        <option value="in">inches</option>
        <option value="cm">centimeters</option>
      </select>
    </label>
  );

  if (!hydrated) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Get up
          </p>
          <h1 className="font-display text-5xl font-extrabold tracking-wide text-fg sm:text-6xl">
            HangTime
          </h1>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Get up
          </p>
          <h1 className="font-display text-5xl font-extrabold tracking-wide text-fg sm:text-6xl">
            HangTime
          </h1>
        </div>
        {unitsSelect}
        <nav className="flex flex-wrap items-center gap-2">
          {authPending ? (
            <div className="h-11 w-28 animate-pulse rounded-md bg-surface" />
          ) : (
            <>
              <Link
                to="/plus"
                className="inline-flex h-11 min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg"
              >
                {isPlus ? "Coach portal" : "HangTime Plus"}
              </Link>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg"
                >
                  Users
                </Link>
              ) : null}
              {user ? (
                <UserButton />
              ) : (
                <Link
                  to="/login"
                  className="inline-flex h-11 min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:text-fg"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </nav>
      </header>

      <ol className="grid gap-2 sm:grid-cols-3">
        <Step n="1" title="Film on any phone">
          <p>
            Use the highest slo-mo your Camera app offers. 240 fps is best, 120
            is great. Regular 1080p 30 or 60 fps still works. Prop the phone
            and frame the feet. Bright light helps at 240+.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 pr-3 font-medium">Phone</th>
                  <th className="py-1 pr-3 font-medium">Best</th>
                  <th className="py-1 font-medium">Still fine</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3">iPhone 8 / SE 2+</td>
                  <td className="py-2 pr-3">Slo-mo 1080p 240 or 120</td>
                  <td className="py-2">Video 1080p 60 or 30</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3">Galaxy S10+</td>
                  <td className="py-2 pr-3">Slow motion 240; Super slow-mo 960 if the burst covers the jump</td>
                  <td className="py-2">Video 1080p 60 or 30</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3">Pixel 4+</td>
                  <td className="py-2 pr-3">Slow motion 120 or 240</td>
                  <td className="py-2">Video 1080p 60 or 30</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3">Most other phones</td>
                  <td className="py-2 pr-3">Camera → More → Slow motion</td>
                  <td className="py-2">Any 1080p 30 fps clip</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3">
            Keep the original file (USB, AirDrop, Files, Google Photos). Chat
            apps often stretch slo-mo to 30 fps. If Gallery already plays it
            slow, export at 1x / original speed.
          </p>
        </Step>
        <Step n="2" title="Drop it here">
          <p>
            Drop the clip on this page or tap the player to choose a file. mp4
            and mov from any recent phone work. If the browser needs a moment,
            we are converting it.
          </p>
        </Step>
        <Step n="3" title="Map your jump">
          <p>
            Scrub to the last frame a toe still touches the floor — that is
            takeoff. Scrub to the first frame a foot touches again — that is
            landing. HangTime does the rest.
          </p>
        </Step>
      </ol>

      <div
        className={cn(
          "flex flex-col gap-6",
          !isPlus ? "lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-4" : "",
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
      <section
        className={cn(
          "overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-border)]",
          dragging ? "ring-2 ring-primary" : "",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void onFile(file);
        }}
      >
        <div className="relative min-h-56 bg-bg">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              muted
              className="mx-auto max-h-80 w-full bg-bg object-contain sm:max-h-96"
            />
          ) : (
            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <span className="flex items-center gap-2 text-primary">
                <Smartphone className="size-7" />
                <Upload className="size-7" />
              </span>
              <span className="font-display text-2xl tracking-wide">
                Drop a phone clip here
              </span>
              <span className="max-w-sm text-sm text-muted">
                Any recent phone. We read the fps from the file.
              </span>
              <input
                type="file"
                accept={FILE_ACCEPT}
                className="sr-only"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </label>
          )}
          {busy ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/80 px-6 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{busy}</p>
              <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-fg/10">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="truncate text-muted">
              {fileName ?? "No video yet"}
              {videoUrl ? ` · ${fileFps} fps` : ""}
            </p>
            <p className="font-mono text-xs tabular-nums text-fg">
              Frame {Number.isFinite(frame) ? frame : 0}
              {duration ? ` / ${maxFrame}` : ""}
            </p>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(1, maxFrame)}
            value={Math.min(frame, maxFrame)}
            disabled={!videoUrl}
            onChange={(e) => seekFrame(Number(e.target.value))}
            className="w-full accent-primary"
          />

          <div className="grid grid-cols-5 gap-2">
            <Button
              type="button"
              size="icon"
              disabled={!videoUrl}
              onClick={() => seekFrame(frame - 10)}
              aria-label="Back 10 frames"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              disabled={!videoUrl}
              onClick={() => seekFrame(frame - 1)}
              aria-label="Back 1 frame"
            >
              <span className="text-xs font-bold">−1</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="primary"
              disabled={!videoUrl}
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (video.paused) void video.play();
                else video.pause();
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause className="size-5" />
              ) : (
                <Play className="size-5 ml-0.5" />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              disabled={!videoUrl}
              onClick={() => seekFrame(frame + 1)}
              aria-label="Forward 1 frame"
            >
              <span className="text-xs font-bold">+1</span>
            </Button>
            <Button
              type="button"
              size="icon"
              disabled={!videoUrl}
              onClick={() => seekFrame(frame + 10)}
              aria-label="Forward 10 frames"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="mark"
              disabled={!videoUrl}
              onClick={() => {
                setTakeoff(frame);
                setSaved(false);
              }}
            >
              Set takeoff
            </Button>
            <Button
              type="button"
              variant="mark"
              disabled={!videoUrl}
              onClick={() => {
                setLanding(frame);
                setSaved(false);
              }}
            >
              Set landing
            </Button>
            <Button
              type="button"
              className="col-span-2 sm:col-span-1"
              disabled={!videoUrl}
              onClick={resetMarks}
            >
              <RotateCcw className="size-4" />
              Reset marks
            </Button>
          </div>

          <p className="text-sm text-muted">
            Takeoff:{" "}
            <span className="tabular-nums text-fg">
              {takeoff === null ? "—" : takeoff}
            </span>
            {" · "}
            Landing:{" "}
            <span className="tabular-nums text-fg">
              {landing === null ? "—" : landing}
            </span>
          </p>
          <p className="text-sm text-muted">
            Takeoff = last frame a toe still touches the floor. Landing = first
            frame a foot touches again.
          </p>
        </div>
      </section>

      {error ? (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-fg shadow-[var(--shadow-border)]">
          {error}
        </p>
      ) : null}

      <section
        className={cn(
          "rounded-lg bg-surface px-5 py-6 shadow-[var(--shadow-border)]",
          result ? "ring-1 ring-primary/40" : "",
        )}
      >
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Vertical
        </p>
        <p className="font-display mt-1 text-6xl font-extrabold tabular-nums tracking-wide text-primary">
          {result ? formatHeight(result.meters, units) : "—"}
        </p>
        {result ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Flight {result.seconds.toFixed(3)} s · {result.frames} frames at{" "}
              {captureFps} fps · h = g t² / 8
            </p>
            {implausible ? (
              <div className="mt-3 space-y-2 text-sm text-muted">
                <p>
                  That hang is huge for a standing jump — the gallery may have
                  already slowed this clip. If it looked like slow-motion, tap
                  the camera rate.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setCaptureFps(120)}>
                    120 fps
                  </Button>
                  <Button type="button" onClick={() => setCaptureFps(240)}>
                    240 fps
                  </Button>
                </div>
              </div>
            ) : null}
            {isPlus ? (
              <form
                className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!result || savePlayerId === null) return;
                  void addJump({
                    data: {
                      playerId: savePlayerId,
                      heightIn: result.meters * 39.3700787,
                      flightS: result.seconds,
                      fps: captureFps,
                    },
                  }).then(() => setSaved(true));
                }}
              >
                <select
                  value={savePlayerId ?? ""}
                  onChange={(e) => setSavePlayerId(Number(e.target.value))}
                  className="h-11 min-h-11 flex-1 rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)]"
                >
                  {players.length === 0 ? (
                    <option value="">Add a player in the coach portal</option>
                  ) : (
                    players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savePlayerId === null || saved}
                >
                  {saved ? "Saved to roster" : "Save to roster"}
                </Button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-muted">
                <Link to="/plus" className="font-semibold text-primary hover:underline">
                  HangTime Plus
                </Link>{" "}
                — first 100 get $10 lifetime
                {spotsLeft !== null
                  ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : ""}
                . Track this jump over time.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Mark takeoff and landing on the video. Same math as a jump mat.
          </p>
        )}
      </section>
        </div>
        {!isPlus ? (
          <div className="hidden lg:block">
            <AdSlot variant="rail" />
          </div>
        ) : null}
      </div>

      {!isPlus ? (
        <div className="lg:hidden">
          <AdSlot variant="banner" />
        </div>
      ) : null}

      {!isPlus ? (
        <p className="text-center text-sm text-muted">
          <Link to="/plus" className="font-semibold text-primary hover:underline">
            HangTime Plus
          </Link>
          {" — "}
          {spotsLeft === 0
            ? "Founding lifetime is full. "
            : `First 100: $10 lifetime${
                spotsLeft !== null
                  ? ` · ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
                  : ""
              }. `}
          Track results over time.
          {" · "}
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <li>
      <details className="rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="font-display text-2xl font-extrabold text-primary">{n}</span>
          <span className="flex-1 text-sm font-semibold text-fg">{title}</span>
          <span className="text-xs font-medium text-muted">Learn more</span>
        </summary>
        <div className="border-t border-border px-4 py-3 text-sm text-muted">
          {children}
        </div>
      </details>
    </li>
  );
}

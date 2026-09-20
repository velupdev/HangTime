import { formatHeight } from "@/lib/jump-math";

export type ChartPoint = {
  heightIn: number;
  at: string;
};

export function JumpChart({
  points,
  compact = false,
}: {
  points: ChartPoint[];
  compact?: boolean;
}) {
  if (points.length === 0) return null;

  const w = compact ? 72 : 320;
  const h = compact ? 28 : 160;
  const padX = compact ? 2 : 8;
  const padY = compact ? 3 : 16;
  const heights = points.map((p) => p.heightIn);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const span = Math.max(1, max - min);
  const yMin = min - span * 0.2;
  const yMax = max + span * 0.2;
  const ySpan = yMax - yMin;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? w / 2
        : padX + (i / (points.length - 1)) * (w - padX * 2);
    const y = padY + (1 - (p.heightIn - yMin) / ySpan) * (h - padY * 2);
    return { x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const best = Math.max(...heights);
  const first = points[0];
  const delta = last.heightIn - first.heightIn;

  if (compact) {
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-7 w-[4.5rem] text-primary"
        aria-hidden
      >
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.6" fill="currentColor" />
        ))}
      </svg>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Progress
        </p>
        <p className="text-sm tabular-nums text-muted">
          Best {formatHeight(best / 39.3700787, "in")}
          {points.length > 1
            ? ` · ${delta >= 0 ? "+" : "−"}${formatHeight(Math.abs(delta) / 39.3700787, "in")}`
            : ""}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-2 h-40 w-full text-primary"
        role="img"
        aria-label="Jump height over time"
      >
        <path
          d={`${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h - 2} L ${coords[0].x.toFixed(1)} ${h - 2} Z`}
          fill="currentColor"
          className="opacity-15"
        />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="3" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="4" fill="currentColor" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-muted">
        <span>{dayLabel(first.at)}</span>
        <span>{dayLabel(last.at)}</span>
      </div>
    </div>
  );
}

function dayLabel(value: string): string {
  if (value.length >= 10) return value.slice(0, 10);
  return value;
}

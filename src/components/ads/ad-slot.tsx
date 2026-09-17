import { Link } from "@tanstack/react-router";
import { ADSENSE_CLIENT, ADSENSE_SLOT, SHOW_HOUSE_ADS } from "@/lib/ads/config";
import { cn } from "@/lib/utils";

export function AdSlot({ variant }: { variant: "rail" | "banner" }) {
  return (
    <aside aria-label="Advertisement" className={cn("rounded-lg bg-surface shadow-[var(--shadow-border)]", variant === "rail" ? "sticky top-6 p-3" : "px-3 py-2")}>
      <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-muted uppercase">Ad</p>
      {SHOW_HOUSE_ADS ? (
        <HouseAd variant={variant} />
      ) : (
        <ins className="adsbygoogle mt-2 block" style={{ display: "block" }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={ADSENSE_SLOT} data-ad-format={variant === "rail" ? "rectangle" : "horizontal"} data-full-width-responsive="true" />
      )}
    </aside>
  );
}

function HouseAd({ variant }: { variant: "rail" | "banner" }) {
  if (variant === "banner") {
    return (
      <Link to="/plus" className="mt-1 flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-fg">Track jumps over a season. One athlete or a roster.</span>
        <span className="shrink-0 text-sm font-semibold text-primary">$10 lifetime</span>
      </Link>
    );
  }
  return (
    <Link to="/plus" className="mt-2 block min-h-[250px] p-2">
      <p className="font-display text-3xl font-extrabold tracking-wide text-fg">HangTime Plus</p>
      <p className="mt-2 text-sm text-muted">Save each vertical and watch it over time — for you, or every player you coach.</p>
      <p className="font-display mt-6 text-4xl font-extrabold tabular-nums text-primary">$10</p>
      <p className="text-sm text-muted">Once. Ads stay off in Plus.</p>
      <span className="mt-6 inline-flex h-11 min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg">See Plus</span>
    </Link>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

const EVENTS = new Set(["page_view", "video_upload", "jump_measured"]);

export const recordSiteEvent = createServerFn({ method: "POST" })
  .validator((input: { event: string; visitorId: string }) => ({
    event: input.event,
    visitorId: input.visitorId,
  }))
  .handler(async ({ data }) => {
    if (!EVENTS.has(data.event)) return { ok: false as const };
    const visitorId = data.visitorId.trim().slice(0, 64);
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(visitorId)) return { ok: false as const };
    try {
      const sql = await getSql();
      await sql`
        insert into site_events (event, visitor_id)
        values (${data.event}, ${visitorId})
      `;
    } catch {
      return { ok: false as const };
    }
    return { ok: true as const };
  });

export type UsageTotals = {
  visits7: number;
  visits30: number;
  visitsAll: number;
  visitors30: number;
  active7: number;
  videos7: number;
  videosAll: number;
  measured7: number;
  measuredAll: number;
};

export async function readUsageTotals(): Promise<UsageTotals> {
  const empty: UsageTotals = {
    visits7: 0,
    visits30: 0,
    visitsAll: 0,
    visitors30: 0,
    active7: 0,
    videos7: 0,
    videosAll: 0,
    measured7: 0,
    measuredAll: 0,
  };
  try {
    const sql = await getSql();
    const rows = await sql<{
      visits7: number | string;
      visits30: number | string;
      visits_all: number | string;
      visitors30: number | string;
      active7: number | string;
      videos7: number | string;
      videos_all: number | string;
      measured7: number | string;
      measured_all: number | string;
    }>`
      select
        count(*) filter (
          where event = 'page_view' and created_at > now() - interval '7 days'
        ) as visits7,
        count(*) filter (
          where event = 'page_view' and created_at > now() - interval '30 days'
        ) as visits30,
        count(*) filter (where event = 'page_view') as visits_all,
        count(distinct visitor_id) filter (
          where event = 'page_view' and created_at > now() - interval '30 days'
        ) as visitors30,
        count(distinct visitor_id) filter (
          where created_at > now() - interval '7 days'
        ) as active7,
        count(*) filter (
          where event = 'video_upload' and created_at > now() - interval '7 days'
        ) as videos7,
        count(*) filter (where event = 'video_upload') as videos_all,
        count(*) filter (
          where event = 'jump_measured' and created_at > now() - interval '7 days'
        ) as measured7,
        count(*) filter (where event = 'jump_measured') as measured_all
      from site_events
    `;
    const row = rows[0];
    if (!row) return empty;
    return {
      visits7: Number(row.visits7) || 0,
      visits30: Number(row.visits30) || 0,
      visitsAll: Number(row.visits_all) || 0,
      visitors30: Number(row.visitors30) || 0,
      active7: Number(row.active7) || 0,
      videos7: Number(row.videos7) || 0,
      videosAll: Number(row.videos_all) || 0,
      measured7: Number(row.measured7) || 0,
      measuredAll: Number(row.measured_all) || 0,
    };
  } catch {
    return empty;
  }
}

const VISITOR_KEY = "hangtime-visitor";

function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function trackUsage(event: "page_view" | "video_upload" | "jump_measured") {
  const id = visitorId();
  if (!id) return;
  if (event === "page_view") {
    try {
      if (window.sessionStorage.getItem("hangtime-viewed") === "1") return;
      window.sessionStorage.setItem("hangtime-viewed", "1");
    } catch {
      /* still count */
    }
  }
  void recordSiteEvent({ data: { event, visitorId: id } }).catch(() => undefined);
}

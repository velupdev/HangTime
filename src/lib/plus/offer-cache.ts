import type { PlusOffer } from "./server";

export const PLUS_OFFER_TTL_MS = 5 * 60 * 1000;
const KEY = "hangtime-plus-offer";

type CacheStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type CachedOffer = { at: number; offer: PlusOffer };

let inflight: Promise<PlusOffer> | null = null;

function isOffer(value: unknown): value is PlusOffer {
  if (!value || typeof value !== "object") return false;
  const offer = value as Partial<PlusOffer>;
  return (
    typeof offer.sold === "number" &&
    typeof offer.cap === "number" &&
    typeof offer.remaining === "number" &&
    typeof offer.lifetimeOpen === "boolean"
  );
}

export function readCachedPlusOffer(store: CacheStore | null, now = Date.now()): PlusOffer | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedOffer>;
    if (typeof parsed.at !== "number" || now - parsed.at > PLUS_OFFER_TTL_MS) return null;
    return isOffer(parsed.offer) ? parsed.offer : null;
  } catch {
    return null;
  }
}

export function writeCachedPlusOffer(
  store: CacheStore | null,
  offer: PlusOffer,
  now = Date.now(),
): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify({ at: now, offer }));
  } catch {
    /* private mode or a full quota — the network result is still usable */
  }
}

export function clearCachedPlusOffer(store: CacheStore | null): void {
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function browserStore(): CacheStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Reuse the founding-spots count for a few minutes. The number only changes
 * when someone buys, and a short delay does not change checkout or Plus access.
 */
export function loadPlusOffer(
  fetcher: () => Promise<PlusOffer>,
  store: CacheStore | null = browserStore(),
): Promise<PlusOffer> {
  const cached = readCachedPlusOffer(store);
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetcher()
      .then((offer) => {
        writeCachedPlusOffer(store, offer);
        return offer;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

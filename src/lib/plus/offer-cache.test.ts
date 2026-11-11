import assert from "node:assert/strict";
import test from "node:test";
import {
  PLUS_OFFER_TTL_MS,
  clearCachedPlusOffer,
  loadPlusOffer,
  readCachedPlusOffer,
  writeCachedPlusOffer,
} from "./offer-cache.ts";

const offer = { sold: 4, cap: 100, remaining: 96, lifetimeOpen: true };

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

test("reads a fresh offer and ignores an expired one", () => {
  const store = memoryStore();
  assert.equal(readCachedPlusOffer(store, 1_000), null);
  writeCachedPlusOffer(store, offer, 1_000);
  assert.deepEqual(readCachedPlusOffer(store, 1_000 + PLUS_OFFER_TTL_MS - 1), offer);
  assert.equal(readCachedPlusOffer(store, 1_000 + PLUS_OFFER_TTL_MS + 1), null);
  clearCachedPlusOffer(store);
  assert.equal(readCachedPlusOffer(store, 1_000), null);
});

test("loadPlusOffer skips the fetcher while the cache is fresh", async () => {
  const store = memoryStore();
  writeCachedPlusOffer(store, offer, Date.now());
  let calls = 0;
  const result = await loadPlusOffer(async () => {
    calls += 1;
    return offer;
  }, store);
  assert.equal(calls, 0);
  assert.deepEqual(result, offer);
});

test("loadPlusOffer fetches once and then serves the cache", async () => {
  const store = memoryStore();
  let calls = 0;
  const first = await loadPlusOffer(async () => {
    calls += 1;
    return offer;
  }, store);
  const second = await loadPlusOffer(async () => {
    calls += 1;
    return { ...offer, remaining: 1 };
  }, store);
  assert.equal(calls, 1);
  assert.deepEqual(first, offer);
  assert.deepEqual(second, offer);
});

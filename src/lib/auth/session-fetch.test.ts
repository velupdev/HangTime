import assert from "node:assert/strict";
import test from "node:test";
import {
  isGetSessionUrl,
  isPublicProductionHost,
  planSessionFetch,
  sessionBodyIsSignedOut,
} from "./session-fetch.ts";

const anon = {
  host: "hangtimeplus.com",
  cookieHeader: "",
  hasBearer: false,
  probed: true,
};

test("skips get-session for a probed anonymous visitor on the public site", () => {
  assert.equal(planSessionFetch(anon), "anonymous");
  assert.equal(planSessionFetch({ ...anon, host: "www.hangtimeplus.com" }), "anonymous");
});

test("probes once, and always networks when a session might exist", () => {
  assert.equal(planSessionFetch({ ...anon, probed: false }), "network");
  assert.equal(
    planSessionFetch({ ...anon, cookieHeader: "ht_signed_in=1" }),
    "network",
  );
  assert.equal(
    planSessionFetch({ ...anon, cookieHeader: "__Host-grok_gate_session=1" }),
    "network",
  );
  assert.equal(planSessionFetch({ ...anon, hasBearer: true }), "network");
});

test("does not skip on preview, localhost, or other hosts", () => {
  for (const host of ["localhost", "127.0.0.1", "hangtimeplus.vercel.app", "abc.grok.me"]) {
    assert.equal(isPublicProductionHost(host), false, host);
    assert.equal(planSessionFetch({ ...anon, host }), "network");
  }
});

test("recognizes get-session URLs and signed-out bodies", () => {
  assert.equal(isGetSessionUrl("/api/auth/get-session", "GET"), true);
  assert.equal(isGetSessionUrl("/api/auth/get-session?disableCookieCache=true", "GET"), true);
  assert.equal(isGetSessionUrl("https://hangtimeplus.com/api/auth/get-session", "GET"), true);
  assert.equal(isGetSessionUrl("/api/auth/get-session", "POST"), false);
  assert.equal(isGetSessionUrl("/api/auth/sign-out", "GET"), false);
  assert.equal(sessionBodyIsSignedOut("null"), true);
  assert.equal(sessionBodyIsSignedOut('{"session":null,"user":null}'), true);
  assert.equal(sessionBodyIsSignedOut('{"session":{"id":"1"},"user":{"id":"1"}}'), false);
  assert.equal(sessionBodyIsSignedOut("not-json"), false);
});

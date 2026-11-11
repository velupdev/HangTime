import assert from "node:assert/strict";
import test from "node:test";
import {
  sessionCookieMutation,
  SIGNED_IN_HINT_COOKIE,
  withSignedInHint,
} from "./signed-in-hint.ts";

const SESSION = "__Host-grok-auth.session_token";

function responseWith(...cookies: string[]): Response {
  const headers = new Headers();
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 200, headers });
}

test("ignores auth responses that do not touch the session cookie", () => {
  const response = responseWith("other=1; Path=/");
  assert.equal(sessionCookieMutation(response, SESSION), null);
  assert.equal(withSignedInHint(response, SESSION), response);
});

test("adds a readable hint when a session cookie is issued", () => {
  const response = withSignedInHint(
    responseWith(`${SESSION}=abc.def; Path=/; HttpOnly; Secure`),
    SESSION,
  );
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[1] ?? "", new RegExp(`^${SIGNED_IN_HINT_COOKIE}=1;`));
  assert.doesNotMatch(cookies[1] ?? "", /HttpOnly/i);
});

test("clears the hint when the session cookie is expired", () => {
  const response = withSignedInHint(
    responseWith(`${SESSION}=; Path=/; Max-Age=0; Secure`),
    SESSION,
  );
  const hint = response.headers.getSetCookie().find((cookie) =>
    cookie.startsWith(`${SIGNED_IN_HINT_COOKIE}=`),
  );
  assert.match(hint ?? "", /Max-Age=0/i);
});

test("a new session wins when the response both clears and sets", () => {
  const response = responseWith(
    `${SESSION}=; Path=/; Max-Age=0`,
    `${SESSION}=fresh; Path=/; HttpOnly`,
  );
  assert.equal(sessionCookieMutation(response, SESSION), "set");
});

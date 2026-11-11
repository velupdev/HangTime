/**
 * Non-secret cookie the browser can read. The real session cookie is
 * `__Host-` and HttpOnly, so client code cannot tell a signed-in visitor from
 * an anonymous one without calling `/api/auth/get-session`. This hint is set
 * only when a session cookie is issued or cleared, and it grants nothing.
 */
export const SIGNED_IN_HINT_COOKIE = "ht_signed_in";

/** Matches Better Auth's default session lifetime (7 days). */
export const SIGNED_IN_HINT_MAX_AGE = 60 * 60 * 24 * 7;

export function signedInHintCookie(action: "set" | "clear"): string {
  const value = action === "set" ? "1" : "";
  const maxAge = action === "set" ? SIGNED_IN_HINT_MAX_AGE : 0;
  return `${SIGNED_IN_HINT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

function setCookieList(response: Response): string[] {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
}

/**
 * `set` when the response plants a session token, `clear` when it expires one,
 * otherwise null. A new session wins over a clear in the same response.
 */
export function sessionCookieMutation(
  response: Response,
  sessionCookieName: string,
): "set" | "clear" | null {
  let clear = false;
  const prefix = `${sessionCookieName}=`;
  for (const cookie of setCookieList(response)) {
    if (!cookie.startsWith(prefix)) continue;
    const value = cookie.slice(prefix.length).split(";")[0] ?? "";
    const expired = /(?:^|;\s*)max-age=0(?:;|$)/i.test(cookie);
    if (!expired && value.length > 0) return "set";
    clear = true;
  }
  return clear ? "clear" : null;
}

/** Append the hint cookie when this auth response changes the session cookie. */
export function withSignedInHint(response: Response, sessionCookieName: string): Response {
  const action = sessionCookieMutation(response, sessionCookieName);
  if (!action) return response;
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of setCookieList(response)) headers.append("set-cookie", cookie);
  headers.append("set-cookie", signedInHintCookie(action));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

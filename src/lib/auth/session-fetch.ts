import { GATE_SESSION_MARKER_COOKIE } from "./gate-session-marker.ts";
import { SIGNED_IN_HINT_COOKIE } from "./signed-in-hint.ts";

export const SESSION_PROBED_KEY = "hangtime-session-probed";

export type SessionFetchPlan = "network" | "anonymous";

/**
 * Anonymous visitors on the public site do not need `/api/auth/get-session`
 * on every page view. Signed-in, gate, and preview sessions still hit the
 * network. The first view in a tab still probes once, so an existing session
 * (no hint cookie yet) is not shown as signed out, and a later gate visit in
 * a new tab can still mint a session.
 */
export function planSessionFetch(input: {
  host: string;
  cookieHeader: string;
  hasBearer: boolean;
  probed: boolean;
}): SessionFetchPlan {
  if (input.hasBearer) return "network";
  if (cookieHas(input.cookieHeader, GATE_SESSION_MARKER_COOKIE)) return "network";
  if (cookieHas(input.cookieHeader, SIGNED_IN_HINT_COOKIE)) return "network";
  if (!isPublicProductionHost(input.host)) return "network";
  if (!input.probed) return "network";
  return "anonymous";
}

export function isPublicProductionHost(host: string): boolean {
  const name = host.split(":")[0]?.trim().toLowerCase() ?? "";
  return name === "hangtimeplus.com" || name === "www.hangtimeplus.com";
}

export function cookieHas(cookieHeader: string, name: string): boolean {
  return cookieHeader.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

/** True when a get-session body means "no user". Unparseable bodies are not treated as signed out. */
export function sessionBodyIsSignedOut(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "null") return true;
  try {
    const data = JSON.parse(trimmed) as { session?: unknown; user?: unknown } | null;
    if (!data || typeof data !== "object") return true;
    return data.session == null && data.user == null;
  } catch {
    return false;
  }
}

export function isGetSessionUrl(url: string, method: string): boolean {
  if (method.toUpperCase() !== "GET") return false;
  const path = url.startsWith("http://") || url.startsWith("https://")
    ? new URL(url).pathname
    : (url.split("?")[0] ?? url);
  return path === "/api/auth/get-session" || path.endsWith("/api/auth/get-session");
}

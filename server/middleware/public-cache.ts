/**
 * CDN cache for public HTML shells. The document is the same for every
 * visitor — session, Plus, and ads hydrate in the browser — so it is safe to
 * share. Authenticated and cookie-setting responses are left alone.
 */
import { isInstallQuery } from "../../scripts/grok-pwa-shared.mjs";
import {
  isPublicDocument,
  PUBLIC_HTML_CACHE_CONTROL,
  PUBLIC_HTML_CDN_CACHE_CONTROL,
} from "../../scripts/public-cache-policy.mjs";

interface PublicCacheEvent {
  url: URL;
  req: { method?: string };
}

function hasSetCookie(response: Response): boolean {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie().length > 0;
  }
  return response.headers.has("set-cookie");
}

export default async function publicCacheMiddleware(
  event: PublicCacheEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  if (!(result instanceof Response) || result.status !== 200) return result;

  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return result;
  if (isInstallQuery(event.url.pathname + event.url.search)) return result;
  if (!isPublicDocument(event.url.pathname)) return result;

  const type = result.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return result;
  if (hasSetCookie(result)) return result;

  const existing = (result.headers.get("cache-control") ?? "").toLowerCase();
  if (existing.includes("no-store") || existing.includes("private")) return result;

  const headers = new Headers(result.headers);
  headers.set("cache-control", PUBLIC_HTML_CACHE_CONTROL);
  headers.set("cdn-cache-control", PUBLIC_HTML_CDN_CACHE_CONTROL);
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

/**
 * Last-resort cheap 404 for any unknown path that still reaches the function
 * (local preview, or a Vercel route table that has not been patched).
 *
 * On Vercel the build patches `.vercel/output/config.json` so these paths are
 * served from `public/404.html` and never invoke the function. This middleware
 * keeps the same allowlist so a request that does get here does not boot React
 * SSR, auth, or Postgres.
 */
import notFoundHtml from "../../public/404.html?raw";
import {
  isFunctionPath,
  UNKNOWN_PATH_CACHE_CONTROL,
} from "../../scripts/public-cache-policy.mjs";

interface UnknownPathEvent {
  url: URL;
  req: { method?: string };
}

const BODY = notFoundHtml;

export default function unknownPathMiddleware(
  event: UnknownPathEvent,
  next: () => unknown | Promise<unknown>,
): unknown | Promise<unknown> {
  if (isFunctionPath(event.url.pathname)) return next();

  const method = (event.req.method ?? "GET").toUpperCase();
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": UNKNOWN_PATH_CACHE_CONTROL,
    "x-robots-tag": "noindex",
  };
  if (method === "HEAD") {
    return new Response(null, { status: 404, headers });
  }
  return new Response(BODY, {
    status: 404,
    headers: {
      ...headers,
      "content-length": String(Buffer.byteLength(BODY)),
    },
  });
}

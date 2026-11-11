/**
 * Which URLs must reach the Nitro server, and which public responses may be
 * cached. Unknown paths are served as a static 404 by the Vercel routing table
 * (no function). Add a page here when you add a route — the unit test checks
 * this list against `isFunctionPath`.
 */

/** Browser revalidates; the CDN holds the public shell for an hour and may serve it stale for a day. */
export const PUBLIC_HTML_CACHE_CONTROL =
  "public, max-age=0, must-revalidate, s-maxage=3600, stale-while-revalidate=86400";

export const PUBLIC_HTML_CDN_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400";

/** Manifest content is per-host and stable. A day in the browser avoids a request on every visit. */
export const MANIFEST_CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

/** Repeated probes of the same missing path should not re-enter the function. */
export const UNKNOWN_PATH_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export const ROBOTS_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

/** Shared founding-spots count. Safe to share: it does not depend on the viewer. */
export const OFFER_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

export const OFFER_CDN_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";

const EXACT_FUNCTION_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/login",
  "/plus",
  "/admin",
]);

/** Public marketing/app shells. Same HTML for every visitor (account UI loads in the browser). */
const PUBLIC_DOCUMENTS = new Set(["/", "/privacy", "/terms", "/login", "/plus"]);

/**
 * Vercel Build Output route `src`. Homepage is the empty alternative.
 * Keep in lockstep with `isFunctionPath` — the test fails if they disagree.
 */
export const FUNCTION_PATH_SRC =
  "^/(?:(?:privacy|terms|login|plus|admin)/?|join/[^/]+/?|api/auth(?:/.*)?|_serverFn(?:/.*)?|__grok(?:/.*)?|_vercel(?:/.*)?|)$";

/**
 * @param {string} pathname
 * @returns {string}
 */
export function normalizePath(pathname) {
  const path = String(pathname ?? "/").split("?")[0].split("#")[0] || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

/**
 * Paths that must invoke the server: real pages, auth, server functions, and
 * the platform manifest. Everything else can be a static 404.
 *
 * @param {string} pathname
 */
export function isFunctionPath(pathname) {
  const path = normalizePath(pathname);
  if (EXACT_FUNCTION_PATHS.has(path)) return true;
  if (/^\/join\/[^/]+$/.test(path)) return true;
  if (path === "/api/auth" || path.startsWith("/api/auth/")) return true;
  if (path === "/_serverFn" || path.startsWith("/_serverFn/")) return true;
  if (path === "/__grok" || path.startsWith("/__grok/")) return true;
  if (path === "/_vercel" || path.startsWith("/_vercel/")) return true;
  return false;
}

/**
 * @param {string} pathname
 */
export function isPublicDocument(pathname) {
  return PUBLIC_DOCUMENTS.has(normalizePath(pathname));
}

/**
 * @typedef {{
 *   src?: string,
 *   dest?: string,
 *   status?: number,
 *   continue?: boolean,
 *   handle?: string,
 *   headers?: Record<string, string>,
 * }} VercelRoute
 * @typedef {{ version?: number, routes?: VercelRoute[] }} VercelBuildConfig
 */

/**
 * Header-only routes must `continue`, or Vercel stops before the file or
 * function and the response has no body. Nitro emits the hashed `/assets`
 * cache header this way.
 *
 * @param {VercelRoute[] | undefined} routes
 * @returns {VercelRoute[] | undefined}
 */
function continueHeaderRoutes(routes) {
  if (!routes) return routes;
  let changed = false;
  const next = routes.map((route) => {
    if (
      !route ||
      route.handle ||
      route.dest ||
      route.status != null ||
      !route.headers ||
      route.continue === true
    ) {
      return route;
    }
    changed = true;
    return { ...route, continue: true };
  });
  return changed ? next : routes;
}

/**
 * @param {VercelBuildConfig} config
 * @returns {VercelBuildConfig}
 */
export function patchVercelBuildConfig(config) {
  const routes = Array.isArray(config.routes) ? config.routes : [];
  if (routes.some((route) => route && route.dest === "/404.html" && route.status === 404)) {
    const continued = continueHeaderRoutes(routes);
    return continued === routes ? config : { ...config, routes: continued };
  }
  const catchAll = routes.findIndex(
    (route) =>
      route &&
      route.dest === "/__server" &&
      (route.src === "/(.*)" || route.src === "^/(.*)$") &&
      route.status == null,
  );
  if (catchAll === -1) {
    throw new Error(
      "Nitro did not emit a /__server catch-all; refusing to guess which paths skip the function.",
    );
  }
  const next = routes.slice();
  next.splice(
    catchAll,
    1,
    { src: FUNCTION_PATH_SRC, dest: "/__server" },
    {
      src: "/(.*)",
      status: 404,
      dest: "/404.html",
      headers: {
        "cache-control": UNKNOWN_PATH_CACHE_CONTROL,
        "x-robots-tag": "noindex",
      },
    },
  );
  next.unshift({
    src: "/robots\\.txt",
    headers: { "cache-control": ROBOTS_CACHE_CONTROL },
    continue: true,
  });
  return { ...config, routes: continueHeaderRoutes(next) ?? next };
}

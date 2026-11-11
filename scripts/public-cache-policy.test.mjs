import assert from "node:assert/strict";
import test from "node:test";
import {
  FUNCTION_PATH_SRC,
  isFunctionPath,
  isPublicDocument,
  normalizePath,
  patchVercelBuildConfig,
} from "./public-cache-policy.mjs";

const functionPaths = [
  "/",
  "/privacy",
  "/privacy/",
  "/terms",
  "/login",
  "/plus",
  "/admin",
  "/join/abc",
  "/join/abc/",
  "/api/auth",
  "/api/auth/",
  "/api/auth/get-session",
  "/api/auth/callback/google",
  "/_serverFn/src_lib_plus_server_ts--getPlusOffer_createServerFn_handler",
  "/_serverFn/src_lib_plus_server_ts--exportRoster_createServerFn_handler",
  "/__grok/manifest.webmanifest",
  "/__grok/manifest.json",
  "/_vercel/cron",
];

const staticMisses = [
  "/blog/1",
  "/blog/2",
  "/blog/3",
  "/api/blog",
  "/api/generate",
  "/api/demo",
  "/wp-login.php",
  "/xmlrpc.php",
  "/robots.txt",
  "/favicon.ico",
  "/privacy/extra",
  "/plus/extra",
  "/join",
  "/api",
  "/.env",
];

const functionSrc = new RegExp(FUNCTION_PATH_SRC);

test("function allowlist matches the Vercel route expression", () => {
  for (const path of functionPaths) {
    assert.equal(isFunctionPath(path), true, path);
    assert.equal(functionSrc.test(path), true, `regex ${path}`);
  }
  for (const path of staticMisses) {
    assert.equal(isFunctionPath(path), false, path);
    assert.equal(functionSrc.test(path), false, `regex ${path}`);
  }
});

test("public documents are the cacheable shells only", () => {
  assert.equal(normalizePath("/privacy/"), "/privacy");
  for (const path of ["/", "/privacy", "/terms", "/login", "/plus"]) {
    assert.equal(isPublicDocument(path), true, path);
  }
  for (const path of [
    "/admin",
    "/join/abc",
    "/api/auth/get-session",
    "/_serverFn/src_lib_plus_server_ts--exportRoster_createServerFn_handler",
    "/blog/1",
  ]) {
    assert.equal(isPublicDocument(path), false, path);
  }
});

test("replaces the Nitro catch-all with an allowlist and a static 404", () => {
  const patched = patchVercelBuildConfig({
    version: 3,
    routes: [
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/__server" },
    ],
  });
  assert.equal(patched.routes[0].src, "/robots\\.txt");
  assert.equal(patched.routes[0].continue, true);
  assert.equal(patched.routes[1].handle, "filesystem");
  assert.equal(patched.routes[2].src, FUNCTION_PATH_SRC);
  assert.equal(patched.routes[2].dest, "/__server");
  const miss = patched.routes[3];
  assert.equal(miss.status, 404);
  assert.equal(miss.dest, "/404.html");
  assert.match(miss.headers["cache-control"], /s-maxage=/);
  assert.equal(patchVercelBuildConfig(patched), patched);
});

test("header-only asset routes continue so the file is still served", () => {
  const patched = patchVercelBuildConfig({
    routes: [
      {
        src: "/assets/(.*)",
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/__server" },
    ],
  });
  const assets = patched.routes?.find((route) => route.src === "/assets/(.*)");
  assert.equal(assets?.continue, true);
  assert.equal(assets?.headers?.["cache-control"], "public, max-age=31536000, immutable");
});

test("refuses to patch a config that has no catch-all", () => {
  assert.throws(() => patchVercelBuildConfig({ routes: [{ handle: "filesystem" }] }));
});

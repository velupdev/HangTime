#!/usr/bin/env node
/**
 * After `vite build`, Nitro's Vercel preset sends every non-file URL to the
 * server function. Replace that catch-all so unknown paths are a static 404
 * (no function invocation) and robots.txt carries a long cache header.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { patchVercelBuildConfig } from "./public-cache-policy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, ".vercel/output/config.json");
const staticDir = join(root, ".vercel/output/static");

if (!existsSync(configPath)) {
  console.error("[vercel-output] missing config.json — vite build did not produce a Vercel output.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const patched = patchVercelBuildConfig(config);
writeFileSync(configPath, `${JSON.stringify(patched, null, 2)}\n`);

for (const name of ["robots.txt", "404.html"]) {
  if (!existsSync(join(staticDir, name))) {
    console.error(`[vercel-output] ${name} was not copied into the static output.`);
    process.exit(1);
  }
}

console.log("[vercel-output] unknown paths serve static 404; robots.txt is a static file.");

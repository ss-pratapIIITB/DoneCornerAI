#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const FETCH_CAPTURE = `globalThis.__TRUEFORGE_FETCH = app.fetch.bind(app);
  const server = { on() {}, close(cb) { cb && cb(); } };`;

const LISTEN_PATTERN =
  /const server = serve\(\{ fetch: app\.fetch, port: \w+\.PORT, hostname: \w+\.HOST \},[\s\S]*?\n  \}\);/;

const require = createRequire(import.meta.url);
let mainPath;
try {
  mainPath = require.resolve("@truefoundry/trueforge/dist/main.js");
} catch {
  process.exit(0);
}

const source = readFileSync(mainPath, "utf8");
if (source.includes("__TRUEFORGE_FETCH")) process.exit(0);
const patched = source.replace(LISTEN_PATTERN, FETCH_CAPTURE);
if (patched === source) {
  console.warn("trueforge patch: listen() pattern not found; skipped");
  process.exit(0);
}
writeFileSync(mainPath, patched);
console.log("Patched @truefoundry/trueforge to run without listen() (Vercel host).");

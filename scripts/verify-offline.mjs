import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildOfflineFieldKit,
  CACHE_PREFIX,
  FIELD_KIT_ROUTES,
  MAX_RUNTIME_ENTRIES,
} from "./offline-field-kit.mjs";

const fieldKit = buildOfflineFieldKit("dist");
const serviceWorker = readFileSync("dist/sw.js", "utf8");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
const radioIndex = readFileSync("dist/radio/index.html", "utf8");

assert.equal(serviceWorker, fieldKit.source);
assert.equal(manifest.start_url, "/radio/");
assert.equal(manifest.scope, "/");
assert.match(radioIndex, /rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(serviceWorker, new RegExp(`${CACHE_PREFIX}-core-${fieldKit.version}`));
assert.match(serviceWorker, new RegExp(`MAX_RUNTIME_ENTRIES = ${MAX_RUNTIME_ENTRIES}`));
assert.doesNotMatch(serviceWorker, /\/pagefind\//);

for (const route of FIELD_KIT_ROUTES) {
  assert.ok(fieldKit.precache.includes(route), `${route} must be precached`);
}

console.log(
  `Verified offline field kit ${fieldKit.version}: ${FIELD_KIT_ROUTES.length} routes, ${fieldKit.precache.length} requests, ${MAX_RUNTIME_ENTRIES} runtime entries.`,
);

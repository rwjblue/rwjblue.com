import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOfflineFieldKit } from "./offline-field-kit.mjs";

const distDirectory = resolve("dist");
const fieldKit = buildOfflineFieldKit(distDirectory);

writeFileSync(resolve(distDirectory, "sw.js"), fieldKit.source);
console.log(
  `Built offline field kit ${fieldKit.version} with ${fieldKit.precache.length} precached requests.`,
);

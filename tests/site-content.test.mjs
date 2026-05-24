import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("homepage presents the public workshop structure", () => {
  const homepage = read("src/pages/index.astro");

  assert.match(homepage, /Current bench/);
  assert.match(homepage, /Recent from the bench/);
  assert.match(homepage, /Selected artifacts/);
  assert.match(homepage, /\/notes\//);
  assert.match(homepage, /\/projects\//);
  assert.match(homepage, /\/radio\//);
  assert.match(homepage, /\/now\//);
});

test("content collections support notes and project artifacts", () => {
  const config = read("src/content.config.ts");

  assert.match(config, /defineCollection/);
  assert.match(config, /notes/);
  assert.match(config, /projects/);
  assert.ok(existsSync("src/content/notes/public-workshop.md"));
  assert.ok(existsSync("src/content/projects/developer-tooling.md"));
});

test("new section routes exist", () => {
  assert.ok(existsSync("src/pages/notes/index.astro"));
  assert.ok(existsSync("src/pages/projects/index.astro"));
  assert.ok(existsSync("src/pages/radio/index.astro"));
  assert.ok(existsSync("src/pages/now/index.astro"));
});

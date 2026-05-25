import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("homepage presents the public workshop structure", () => {
  const homepage = read("src/pages/index.astro");

  assert.match(homepage, /Current bench/);
  assert.match(homepage, /Recent from the bench/);
  assert.match(homepage, /Recently updated projects/);
  assert.match(homepage, /\/notes\//);
  assert.match(homepage, /\/projects\//);
  assert.match(homepage, /\/radio\//);
  assert.doesNotMatch(homepage, /\/now\//);
  assert.match(homepage, /updated/);
});

test("content collections support notes and updated projects", () => {
  const config = read("src/content.config.ts");

  assert.match(config, /defineCollection/);
  assert.match(config, /notes/);
  assert.match(config, /projects/);
  assert.match(config, /updated/);
  assert.ok(existsSync("src/content/notes/public-workshop.md"));
  assert.ok(existsSync("src/content/projects/developer-tooling.md"));
});

test("new section routes exist", () => {
  assert.ok(existsSync("src/pages/notes/index.astro"));
  assert.ok(existsSync("src/pages/projects/index.astro"));
  assert.ok(existsSync("src/pages/radio/index.astro"));
  assert.ok(!existsSync("src/pages/now/index.astro"));
});

test("primary navigation omits now", () => {
  const layout = read("src/layouts/BaseLayout.astro");

  assert.match(layout, /\/notes\//);
  assert.match(layout, /\/projects\//);
  assert.match(layout, /\/radio\//);
  assert.doesNotMatch(layout, /\/now\//);
  assert.doesNotMatch(layout, /Now/);
});

test("radio page keeps static context and lists radio notes", () => {
  const radio = read("src/pages/radio/index.astro");

  assert.match(radio, /getCollection\("notes"\)/);
  assert.match(radio, /note\.data\.tags\.includes\("radio"\)/);
  assert.match(radio, /Radio notes/);
  assert.match(radio, /href=\{`\/notes\/\$\{note\.id\}\/`\}/);
});

test("date-only frontmatter renders without local timezone drift", () => {
  const datedPages = [
    "src/pages/index.astro",
    "src/pages/notes/index.astro",
    "src/pages/notes/[slug].astro",
    "src/pages/projects/index.astro",
    "src/pages/projects/[slug].astro",
    "src/pages/radio/index.astro",
  ];

  for (const path of datedPages) {
    assert.match(read(path), /timeZone: "UTC"/, path);
  }
});

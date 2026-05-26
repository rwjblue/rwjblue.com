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

test("rss endpoint publishes notes with canonical domains", () => {
  assert.ok(existsSync("src/pages/rss.xml.ts"));

  const rssEndpoint = read("src/pages/rss.xml.ts");

  assert.match(rssEndpoint, /@astrojs\/rss/);
  assert.match(rssEndpoint, /getCollection\("notes"\)/);
  assert.match(rssEndpoint, /markdown-it/);
  assert.match(rssEndpoint, /sanitize-html/);
  assert.match(rssEndpoint, /note\.data\.tags\.includes\("radio"\)/);
  assert.match(rssEndpoint, /https:\/\/n1rwj\.com/);
  assert.match(rssEndpoint, /https:\/\/rwjblue\.com/);
  assert.doesNotMatch(rssEndpoint, /getCollection\("projects"\)/);
});

test("layout advertises the notes rss feed", () => {
  const layout = read("src/layouts/BaseLayout.astro");

  assert.match(layout, /rel="alternate"/);
  assert.match(layout, /type="application\/rss\+xml"/);
  assert.match(layout, /title="Robert Jackson \/ Notes"/);
  assert.match(layout, /href="\/rss\.xml"/);
});

test("notes provide social share metadata", () => {
  const layout = read("src/layouts/BaseLayout.astro");
  const notePage = read("src/pages/notes/[slug].astro");

  assert.match(layout, /rel="canonical"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /property="og:description"/);
  assert.match(layout, /property="og:image"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(notePage, /description=\{note\.data\.summary\}/);
  assert.match(notePage, /canonicalPath=\{`\/notes\/\$\{note\.id\}\/`\}/);
  assert.match(notePage, /type="article"/);
});

test("legacy note slugs redirect to their current urls", () => {
  assert.ok(existsSync("public/_redirects"));

  const redirects = read("public/_redirects");

  assert.match(
    redirects,
    /^\/notes\/2026-05-25-rhode-island-pota-rove\/\s+\/notes\/2026-05-25-pota-rove\/\s+301$/m,
  );
});

test("ri pota tracker uses file-based mise tasks", () => {
  const taskCommands = [
    ["update-parks", "update-parks"],
    ["update-profile", "update-profile"],
    ["backfill-activations", "backfill-activations"],
    ["build-tracker-data", "build-tracker-data"],
    ["update-tracker", "update-tracker"],
  ];

  assert.ok(existsSync("scripts/pota/ri-tracker.mjs"));

  for (const [file, command] of taskCommands) {
    const path = `.mise/tasks/pota/ri/${file}`;

    assert.ok(existsSync(path), path);

    const task = read(path);

    assert.match(task, /^#!\/usr\/bin\/env bash/);
    assert.match(task, /#MISE description=/);
    assert.match(task, /scripts\/pota\/ri-tracker\.mjs/);
    assert.match(task, new RegExp(` ${command}(\\s|$)`));
  }
});

test("ri pota tracker project page is wired for map-first tracking", () => {
  assert.ok(existsSync("src/pages/projects/2026-activate-all-ri-pota.astro"));
  assert.ok(existsSync("src/content/projects/2026-activate-all-ri-pota.md"));
  assert.ok(existsSync("src/data/pota/ri-tracker.json"));
  assert.ok(existsSync("data/pota/ri/activations.json"));

  const page = read("src/pages/projects/2026-activate-all-ri-pota.astro");
  const radio = read("src/pages/radio/index.astro");
  const project = read("src/content/projects/2026-activate-all-ri-pota.md");

  assert.match(page, /ri-tracker\.json/);
  assert.match(page, /leaflet/);
  assert.match(page, /tile\.openstreetmap\.org/);
  assert.match(page, /OpenStreetMap/);
  assert.match(page, /remaining/i);
  assert.match(page, /id="checklist-title">Reference checklist/);
  assert.doesNotMatch(page, /<p class="section-label">Checklist<\/p>/);
  assert.match(page, /class=\{`pota-reference-check \$\{reference\.status\}`\}/);
  assert.match(page, /class=\{`pota-reference \$\{reference\.status\}`\}/);
  assert.match(page, /href=\{reference\.potaUrl\}/);
  assert.match(page, /pota-reference-name/);
  assert.doesNotMatch(page, /Remaining first/);
  assert.doesNotMatch(page, /<p>Not yet activated<\/p>/);
  assert.doesNotMatch(page, /<p>Open<\/p>/);
  assert.match(page, /title="RI POTA Challenge \/ N1RWJ"/);
  assert.match(page, /description=\{shareDescription\}/);
  assert.match(page, /canonicalPath="\/projects\/2026-activate-all-ri-pota\/"/);
  assert.match(page, /image="\/images\/pota\/2026-05-25-rhode-island-pota-rove-map\.jpg"/);
  assert.match(project, /2026 Activate All RI POTA/);
  assert.match(radio, /\/projects\/2026-activate-all-ri-pota\//);
});

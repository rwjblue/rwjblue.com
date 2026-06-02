import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("homepage presents a radio-led dispatch with live paths", () => {
  const homepage = read("src/pages/index.astro");

  assert.match(homepage, /N1RWJ/);
  assert.match(homepage, /On the bench/);
  assert.match(homepage, /benchLinks/);
  assert.match(homepage, /latestNote/);
  assert.match(homepage, /Recent notes/);
  assert.match(homepage, /Active projects/);
  assert.match(homepage, /href=\{`\/notes\/\$\{latestNote\.id\}\/`\}/);
  assert.match(homepage, /\/radio\/shack\//);
  assert.match(homepage, /\/projects\/2026-activate-all-ri-pota\//);
  assert.match(homepage, /href="\/radio\/"/);
  assert.doesNotMatch(homepage, /Current bench/);
  assert.doesNotMatch(homepage, /\/now\//);
});

test("content collections support notes and updated projects", () => {
  const config = read("src/content.config.ts");
  const blackHutNote = read("src/content/notes/2026-05-27-black-hut-wildlife-management-area-pota.md");

  assert.match(config, /defineCollection/);
  assert.match(config, /notes/);
  assert.match(config, /projects/);
  assert.match(config, /updated/);
  assert.match(config, /shareImageHero/);
  assert.match(blackHutNote, /shareImageHero:/);
  assert.ok(existsSync("src/content/notes/public-workshop.md"));
  assert.ok(existsSync("src/content/projects/developer-tooling.md"));
});

test("new section routes exist", () => {
  assert.ok(existsSync("src/pages/notes/index.astro"));
  assert.ok(existsSync("src/pages/projects/index.astro"));
  assert.ok(existsSync("src/pages/radio/index.astro"));
  assert.ok(existsSync("src/pages/radio/shack.astro"));
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

test("radio page keeps static context, links shack notes, and lists radio notes", () => {
  const radio = read("src/pages/radio/index.astro");

  assert.match(radio, /getCollection\("notes"\)/);
  assert.match(radio, /note\.data\.tags\.includes\("radio"\)/);
  assert.match(radio, /Radio notes/);
  assert.match(radio, /href=\{`\/notes\/\$\{note\.id\}\/`\}/);
  assert.match(radio, /\/radio\/shack\//);
  assert.match(radio, /My shack/);
});

test("shack page documents station and portable setup", () => {
  assert.ok(existsSync("src/pages/radio/shack.astro"));

  const shack = read("src/pages/radio/shack.astro");

  assert.match(shack, /title="My shack \/ N1RWJ"/);
  assert.match(shack, /<h1>My shack<\/h1>/);
  assert.match(shack, /Home station/);
  assert.match(shack, /Portable kit/);
  assert.match(shack, /Operating focus/);
  assert.match(shack, /Last updated/);
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
  const noteSharePage = read("src/pages/notes/[slug]/share-image.astro");
  const roveNote = read("src/content/notes/2026-05-25-pota-rove.md");

  assert.match(layout, /rel="canonical"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /property="og:description"/);
  assert.match(layout, /property="og:image"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(notePage, /description=\{note\.data\.summary\}/);
  assert.match(notePage, /canonicalPath=\{`\/notes\/\$\{note\.id\}\/`\}/);
  assert.match(notePage, /\/images\/pota\/\$\{note\.id\}\/share\.png/);
  assert.match(notePage, /type="article"/);
  assert.match(noteSharePage, /getStaticPaths/);
  assert.match(noteSharePage, /contactMapForNote/);
  assert.match(noteSharePage, /share-map/);
  assert.match(noteSharePage, /note\.data\.shareImageHero/);
  assert.match(noteSharePage, /share-card--hero/);
  assert.match(noteSharePage, /share-card--map/);
  assert.match(roveNote, /contactMap: src\/data\/pota\/contact-maps\/2026-05-25-pota-rove\.json/);
  assert.doesNotMatch(roveNote, /2026-05-25-rhode-island-pota-rove-map\.jpg/);
});

test("cq wpx note is wired to a checked-in contact map artifact", () => {
  const note = read("src/content/notes/2026-05-31-cq-wpx-cw-learning-weekend.md");

  assert.ok(
    existsSync("src/data/pota/contact-maps/2026-05-31-cq-wpx-cw-learning-weekend.json"),
  );
  assert.ok(
    existsSync("public/images/pota/2026-05-31-cq-wpx-cw-learning-weekend/share.png"),
  );
  assert.match(
    note,
    /contactMap: src\/data\/pota\/contact-maps\/2026-05-31-cq-wpx-cw-learning-weekend\.json/,
  );
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

test("pota image sanitizer and contact-map bootstrap are available as file-based mise tasks", () => {
  assert.ok(existsSync("scripts/pota/sanitize-images.sh"));
  assert.ok(existsSync("scripts/pota/generate-note-share-image.sh"));
  assert.ok(existsSync(".mise/tasks/pota/images/sanitize"));
  assert.ok(existsSync("scripts/pota/render-contact-map.mjs"));
  assert.ok(existsSync(".mise/tasks/pota/images/render-contact-map"));
  assert.ok(existsSync(".mise/tasks/pota/images/generate-note-share-image"));
  assert.ok(existsSync(".mise/tasks/pota/contact-map/from-adi"));
  assert.ok(existsSync(".agents/skills/pota-contact-map-bootstrap/SKILL.md"));

  const task = read(".mise/tasks/pota/images/sanitize");
  const mapTask = read(".mise/tasks/pota/images/render-contact-map");
  const noteShareTask = read(".mise/tasks/pota/images/generate-note-share-image");
  const bootstrapTask = read(".mise/tasks/pota/contact-map/from-adi");
  const bootstrapSkill = read(".agents/skills/pota-contact-map-bootstrap/SKILL.md");
  const skill = read(".agents/skills/pota-field-report/SKILL.md");

  assert.match(task, /^#!\/usr\/bin\/env bash/);
  assert.match(task, /#MISE description=/);
  assert.match(task, /#USAGE flag "--slug <slug>"/);
  assert.match(task, /#USAGE flag "--max-edge <px>"/);
  assert.match(task, /scripts\/pota\/sanitize-images\.sh/);
  assert.match(mapTask, /#MISE description=/);
  assert.match(mapTask, /#USAGE flag "--input <adi>"/);
  assert.match(mapTask, /node scripts\/pota\/render-contact-map\.mjs/);
  assert.match(noteShareTask, /#MISE description=/);
  assert.match(noteShareTask, /scripts\/pota\/generate-note-share-image\.sh/);
  assert.match(bootstrapTask, /#MISE description=/);
  assert.match(bootstrapTask, /#USAGE flag "--output <json>"/);
  assert.match(bootstrapTask, /node scripts\/pota\/render-contact-map\.mjs/);
  assert.match(bootstrapSkill, /mise run pota:contact-map:from-adi/);
  assert.match(skill, /mise run pota:images:sanitize/);
  assert.match(skill, /mise run pota:contact-map:from-adi/);
  assert.match(skill, /mise run pota:images:generate-note-share-image/);
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
  assert.match(page, /image="\/images\/pota\/ri-pota-challenge-share\.png"/);
  assert.match(project, /2026 Activate All RI POTA/);
  assert.match(radio, /\/projects\/2026-activate-all-ri-pota\//);
});

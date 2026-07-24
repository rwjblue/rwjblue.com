import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(path, "utf8");

test("homepage presents a notes-first recent activity timeline", () => {
  const homepage = read("src/pages/index.astro");

  assert.match(homepage, /N1RWJ/);
  assert.match(homepage, /activityItems/);
  assert.match(homepage, /Recent activity/);
  assert.match(homepage, /Active projects/);
  assert.match(homepage, /type: "note"/);
  assert.match(homepage, /type: "project"/);
  assert.match(homepage, /note\.data\.date/);
  assert.match(homepage, /effectiveProjectUpdatedDate/);
  assert.match(homepage, /href=\{item\.href\}/);
  assert.match(homepage, /\/radio\/shack\//);
  assert.match(homepage, /href="\/radio\/"/);
  assert.doesNotMatch(homepage, /On the bench/);
  assert.doesNotMatch(homepage, /benchLinks/);
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
  assert.match(config, /shareImage/);
  assert.doesNotMatch(config, /shareImageH[e]ro/);
  assert.match(blackHutNote, /shareImage:/);
  assert.doesNotMatch(blackHutNote, /shareImageH[e]ro:/);
  assert.ok(existsSync("src/content/notes/public-workshop.md"));
  assert.ok(existsSync("src/content/projects/developer-tooling.md"));
});

test("project listings use effective project update dates", () => {
  const homepage = read("src/pages/index.astro");
  const projects = read("src/pages/projects/index.astro");

  assert.match(homepage, /effectiveProjectUpdatedDate/);
  assert.match(homepage, /formatDate\(updated\)/);
  assert.match(projects, /effectiveProjectUpdatedDate/);
  assert.match(projects, /formatDate\(updated\)/);
});

test("rove to FL project links the day-one field note", () => {
  const projectPage = read("src/pages/projects/2026-06-rove-to-fl.astro");

  assert.match(projectPage, /Field notes/);
  assert.match(
    projectPage,
    /\/notes\/2026-06-19-rhode-island-to-florida-rove-day-one\//,
  );
});

test("Rockville WMA activation is associated with the day-one field note", () => {
  const parksData = JSON.parse(read("src/data/pota/parks.json"));
  const rockville = parksData.parks.find((park) => park.reference === "US-6991");
  const activation = rockville?.activations.find(
    (entry) => entry.date === "2026-06-19",
  );

  assert.ok(rockville, "expected US-6991 in generated park data");
  assert.ok(activation, "expected the 2026-06-19 Rockville activation");
  assert.equal(activation.qsos.total, 11);
  assert.ok(
    activation.notes.some(
      (note) =>
        note.href ===
        "/notes/2026-06-19-rhode-island-to-florida-rove-day-one/",
    ),
  );
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

test("radio page links the RBN skimmer finder utility", () => {
  const radio = read("src/pages/radio/index.astro");

  assert.match(radio, /Radio tools/);
  assert.match(radio, /Operating tools/);
  assert.match(radio, /\/radio\/rbn-skimmers\//);
  assert.match(radio, /RBN Skimmer Finder/);
});

test("radio page links the CW Practice Schedule without adding top-level navigation", () => {
  const radio = read("src/pages/radio/index.astro");
  const layout = read("src/layouts/BaseLayout.astro");

  assert.ok(existsSync("src/pages/radio/cw-practice.astro"));
  assert.match(radio, /\/radio\/cw-practice\//);
  assert.match(radio, /CW Practice Schedule/);
  assert.doesNotMatch(layout, /\/radio\/cw-practice\//);
});

test("CW Practice Schedule offers only local time and UTC views", () => {
  const clock = read("src/pages/radio/cw-practice.astro");

  assert.match(clock, /data-zone="local"[^>]*>Local time</);
  assert.match(clock, /data-zone="utc"[^>]*>UTC</);
  assert.doesNotMatch(clock, /data-zone="home"/);
  assert.doesNotMatch(clock, /Here now/);
  assert.doesNotMatch(clock, /cw-clock-primary-utc/);
  assert.doesNotMatch(clock, /cw-clock-next-utc/);
  assert.match(clock, /literal <code>DX<\/code>/);
  assert.match(clock, /Do not send a country prefix/);
  assert.match(clock, /DX country prefix/);
  assert.doesNotMatch(clock, /state, province, or DX country\./);
  assert.match(clock, /CW Academy students send their first name and CWA/);
  assert.match(clock, /data-calendar-subscribe/);
  assert.doesNotMatch(clock, /webcal:\/\/rwjblue\.com/);

  const client = read("src/lib/cw-practice-client.ts");

  assert.match(client, /window\.location\.href/);
  assert.match(client, /webcal:\/\//);
});

test("rbn skimmer finder page provides utility markup and client boot script", () => {
  assert.ok(existsSync("src/pages/radio/rbn-skimmers.astro"));

  const page = read("src/pages/radio/rbn-skimmers.astro");

  assert.match(page, /title="RBN Skimmer Finder \/ N1RWJ"/);
  assert.match(page, /id="rbn-skimmer-tool"/);
  assert.match(page, /id="rbn-use-location"/);
  assert.match(page, /id="rbn-grid"/);
  assert.match(page, /id="rbn-map"/);
  assert.match(page, /id="rbn-open-link"/);
  assert.match(page, /initRbnSkimmerTool/);

  const client = read("src/lib/rbn-skimmers-client.ts");

  assert.match(client, /RBN_NODES_URL/);
  assert.match(client, /navigator\.geolocation/);
  assert.match(client, /rankSkimmers/);
  assert.match(client, /buildRbnMainUrl/);
  assert.match(client, /L\.map/);
  assert.match(client, /localStorage/);
});

test("NCDXF beacon guide links the field note and provides both listening workflows", () => {
  assert.ok(existsSync("src/pages/radio/beacons.astro"));

  const radio = read("src/pages/radio/index.astro");
  const page = read("src/pages/radio/beacons.astro");
  const client = read("src/lib/ncdxf-beacons-client.ts");
  const map = read("src/components/NcdxfBeaconMap.astro");
  const notePage = read("src/pages/notes/[slug].astro");
  const shareImage = read("src/lib/note-share-image.ts");
  const note = read(
    "src/content/notes/2026-07-23-learning-to-read-the-bands-with-ncdxf-beacons.md",
  );

  assert.match(radio, /\/radio\/beacons\//);
  assert.match(radio, /NCDXF Beacon Guide/);
  assert.match(page, /id="ncdxf-beacon-tool"/);
  assert.match(page, /data-beacon-panel="scan"/);
  assert.match(page, /data-beacon-panel="path"/);
  assert.match(page, /2026-07-23-learning-to-read-the-bands-with-ncdxf-beacons/);
  assert.match(page, /initNcdxfBeaconTool/);
  assert.match(client, /navigator\.geolocation/);
  assert.match(client, /localStorage/);
  assert.match(client, /transmissionAt/);
  assert.match(client, /beaconWindowAt/);
  assert.match(map, /NCDXF_BEACONS/);
  assert.match(map, /class="beacon-network-map"/);
  assert.match(map, /class="beacon-station-list"/);
  assert.match(notePage, /note\.data\.beaconMap && <NcdxfBeaconMap/);
  assert.match(shareImage, /renderNcdxfBeaconShareImage/);
  assert.match(note, /beaconMap: true/);
  assert.match(note, /\[NCDXF Beacon Guide\]\(\/radio\/beacons\/\)/);
  assert.match(note, /I have not completed a full field test yet/);
  assert.match(note, /callsign sent as Morse code at 22/);
  assert.match(note, /CAT control makes\s+this mode practical/);
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
  assert.match(noteSharePage, /note\.data\.shareImage/);
  assert.doesNotMatch(noteSharePage, /shareImageH[e]ro/);
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

test("legacy paths redirect to their current urls", () => {
  assert.ok(existsSync("public/_redirects"));

  const redirects = read("public/_redirects");

  assert.match(
    redirects,
    /^\/notes\/2026-05-25-rhode-island-pota-rove\/\s+\/notes\/2026-05-25-pota-rove\/\s+301$/m,
  );
  assert.match(redirects, /^\/rss\s+\/rss\.xml\s+301$/m);
  assert.match(redirects, /^\/rss\/\s+\/rss\.xml\s+301$/m);
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
  assert.match(bootstrapSkill, /archives the source ADIF/);
  assert.match(bootstrapSkill, /repeat --input/);
  assert.match(skill, /mise run pota:images:sanitize/);
  assert.match(skill, /mise run pota:contact-map:from-adi/);
  assert.match(skill, /archives the source ADIF/);
  assert.match(skill, /mise run pota:images:generate-note-share-image/);
});

test("pota park page workflow is documented for agents", () => {
  assert.ok(existsSync(".mise/tasks/pota/update"));
  assert.ok(existsSync(".mise/tasks/pota/park/ensure"));
  assert.ok(existsSync(".mise/tasks/pota/park/build-page-data"));
  assert.ok(existsSync(".mise/tasks/pota/park/backfill-known"));

  const updateTask = read(".mise/tasks/pota/update");
  const ensureTask = read(".mise/tasks/pota/park/ensure");
  const fieldReportSkill = read(".agents/skills/pota-field-report/SKILL.md");
  const riPotaSkill = read(".agents/skills/ri-pota/skill.md");
  const agents = read("AGENTS.md");

  assert.match(updateTask, /#USAGE flag "--full-backfill"/);
  assert.match(updateTask, /usage_full_backfill/);
  assert.match(updateTask, /\$\{args\[@\]\+"\$\{args\[@\]\}"\}/);
  assert.match(updateTask, /scripts\/pota\/update\.mjs/);
  assert.match(ensureTask, /scripts\/pota\/parks\.mjs ensure/);
  assert.match(fieldReportSkill, /mise run pota:park:ensure -- US-1234/);
  assert.match(fieldReportSkill, /mise run pota:update/);
  assert.match(fieldReportSkill, /\/radio\/pota\/US-1234\//);
  assert.match(riPotaSkill, /mise run pota:update/);
  assert.match(riPotaSkill, /--full-backfill/);
  assert.match(riPotaSkill, /\/radio\/pota\/US-1234\//);
  assert.match(agents, /mise run pota:update/);
  assert.match(agents, /mise run pota:park:ensure -- US-1234/);
  assert.match(agents, /--full-backfill/);
  assert.match(agents, /\/radio\/pota\/US-1234\//);
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
  assert.match(page, /href=\{reference\.href\}/);
  assert.match(page, /reference\.potaUrl/);
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

test("canonical POTA park pages are generated from local park data", () => {
  assert.ok(existsSync("src/data/pota/parks.json"));
  assert.ok(existsSync("src/pages/radio/pota/[reference].astro"));

  const page = read("src/pages/radio/pota/[reference].astro");
  const data = JSON.parse(read("src/data/pota/parks.json"));
  const sachuest = data.parks.find((park) => park.reference === "US-0516");

  assert.match(page, /parks\.json/);
  assert.match(page, /getStaticPaths/);
  assert.match(page, /canonicalPath=\{park\.href\}/);
  assert.match(page, /pota-activation-list/);
  assert.match(page, /my activations/);
  assert.match(page, /My activations/);
  assert.doesNotMatch(page, /park\.publicStats\.activations/);
  assert.match(page, /map\.fitBounds/);
  assert.match(page, /US-RI/);
  assert.match(page, /tile\.openstreetmap\.org/);
  assert.match(page, /OpenStreetMap/);
  assert.equal(sachuest.href, "/radio/pota/US-0516/");
  assert.ok(
    sachuest.activations.some((activation) =>
      activation.notes.some(
        (note) =>
          note.id === "2026-06-04-sachuest-point-national-wildlife-refuge-pota",
      ),
    ),
  );
});

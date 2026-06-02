# Homepage Radio Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a radio-first homepage that feels personal and current, with a linked "On the bench" panel and a new `/radio/shack/` setup page.

**Architecture:** Keep the site Astro-native. The homepage continues to derive recent notes and projects from existing content collections, while local page data defines the static bench links. A new static Astro page owns the durable shack/setup writeup, and the radio landing page links into it.

**Tech Stack:** Astro 6, Astro content collections, plain CSS in `src/styles/global.css`, Node test runner, mise tasks, `jj`, and `agent-browser` for viewport verification.

---

## File Structure

- Modify `src/pages/index.astro`: replace static `currentBench` prose with a linked `benchLinks` model, revise the radio-first hero copy, and render the latest note as a real sidebar destination.
- Create `src/pages/radio/shack.astro`: add a durable "My shack" page using `BaseLayout`, existing section/list styles, and concise setup copy.
- Modify `src/pages/radio/index.astro`: add a visible path to `/radio/shack/` near the existing radio context.
- Modify `src/styles/global.css`: add focused styles for the linked bench panel and the shack/setup page lists while preserving the existing visual language.
- Modify `tests/site-content.test.mjs`: update smoke tests for the new homepage copy, linked bench panel, shack route, and radio page link.

## Task 1: Pin The New Route And Homepage Expectations

**Files:**
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Update the homepage smoke test**

Replace the existing `homepage presents the public workshop structure` test with:

```js
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
  assert.match(homepage, /\/radio\//);
  assert.doesNotMatch(homepage, /Current bench/);
  assert.doesNotMatch(homepage, /\/now\//);
});
```

- [ ] **Step 2: Update the section routes test**

Replace the existing `new section routes exist` test with:

```js
test("section routes exist", () => {
  assert.ok(existsSync("src/pages/notes/index.astro"));
  assert.ok(existsSync("src/pages/projects/index.astro"));
  assert.ok(existsSync("src/pages/radio/index.astro"));
  assert.ok(existsSync("src/pages/radio/shack.astro"));
  assert.ok(!existsSync("src/pages/now/index.astro"));
});
```

- [ ] **Step 3: Update the radio page smoke test**

Replace the existing `radio page keeps static context and lists radio notes` test with:

```js
test("radio page keeps static context, links shack notes, and lists radio notes", () => {
  const radio = read("src/pages/radio/index.astro");

  assert.match(radio, /getCollection\("notes"\)/);
  assert.match(radio, /note\.data\.tags\.includes\("radio"\)/);
  assert.match(radio, /Radio notes/);
  assert.match(radio, /href=\{`\/notes\/\$\{note\.id\}\/`\}/);
  assert.match(radio, /\/radio\/shack\//);
  assert.match(radio, /My shack/);
});
```

- [ ] **Step 4: Add a shack page smoke test**

Add this test after the radio page smoke test:

```js
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
```

- [ ] **Step 5: Run tests and verify the expected failure**

Run:

```bash
npm test
```

Expected: FAIL because `src/pages/radio/shack.astro` does not exist yet and the homepage still contains `Current bench`.

- [ ] **Step 6: Commit the failing characterization tests**

Run:

```bash
jj commit -m "Test homepage radio dispatch expectations"
```

Expected: `jj` creates a commit and advances to a new empty working copy revision.

## Task 2: Add The Shack Page

**Files:**
- Create: `src/pages/radio/shack.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create `src/pages/radio/shack.astro`**

Add:

```astro
---
import BaseLayout from "../../layouts/BaseLayout.astro";

const updated = "June 2, 2026";

const homeStation = [
  {
    label: "Radio",
    text: "Elecraft K4D at the desk for home operating, contest practice, CW work, and experiments that benefit from a stable station.",
  },
  {
    label: "Antenna",
    text: "DX Commander Expedition, usually treated as the known-good home vertical when I want repeatable 20-meter performance.",
  },
  {
    label: "Operating position",
    text: "A practical bench for listening, logging, debugging RF problems, and keeping the station easy to reconfigure.",
  },
];

const portableKit = [
  {
    label: "Field radios",
    text: "Elecraft KX2 and KX3 for portable HF, POTA activations, quick experiments, and lightweight setups.",
  },
  {
    label: "Antennas",
    text: "Whips and wire antennas depending on the park, available supports, wind, time, and how much setup friction the outing can tolerate.",
  },
  {
    label: "Logging",
    text: "Portable logging is treated as part of the station: simple enough to use in the field, detailed enough to reconstruct what happened later.",
  },
];

const operatingFocus = [
  "CW practice and getting more comfortable at real on-air speeds.",
  "POTA activations, especially repeatable field workflows around Rhode Island parks.",
  "Antenna and station experiments that produce notes worth finding again.",
  "Contest weekends used as dense practice, not only as score-chasing.",
];
---

<BaseLayout
  title="My shack / N1RWJ"
  description="The current N1RWJ home station, portable HF kit, antennas, and operating workflow notes."
  canonicalPath="/radio/shack/"
>
  <section class="page-intro">
    <p class="eyebrow">N1RWJ</p>
    <h1>My shack</h1>
    <p>
      This is the current shape of my radio setup: the home station, portable
      HF kits, antennas, logging habits, and operating workflows behind the
      field notes on this site.
    </p>
    <p class="meta">Last updated {updated}</p>
  </section>

  <section class="section-block wide" aria-labelledby="home-station-title">
    <div class="section-heading">
      <p class="section-label">Station</p>
      <h2 id="home-station-title">Home station</h2>
    </div>
    <div class="setup-list">
      {
        homeStation.map((item) => (
          <div>
            <h3>{item.label}</h3>
            <p>{item.text}</p>
          </div>
        ))
      }
    </div>
  </section>

  <section class="section-block wide" aria-labelledby="portable-kit-title">
    <div class="section-heading">
      <p class="section-label">Field</p>
      <h2 id="portable-kit-title">Portable kit</h2>
    </div>
    <div class="setup-list">
      {
        portableKit.map((item) => (
          <div>
            <h3>{item.label}</h3>
            <p>{item.text}</p>
          </div>
        ))
      }
    </div>
  </section>

  <section class="bridge" aria-labelledby="operating-focus-title">
    <p class="section-label">Practice</p>
    <h2 id="operating-focus-title">Operating focus</h2>
    <ul class="plain-list">
      {operatingFocus.map((item) => <li>{item}</li>)}
    </ul>
    <nav class="path-links" aria-label="Related radio paths">
      <a href="/radio/">Radio notes</a>
      <a href="/projects/2026-activate-all-ri-pota/">RI POTA tracker</a>
    </nav>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Add setup list CSS**

In `src/styles/global.css`, add this block near `.split-list`:

```css
.setup-list {
  display: grid;
  border-top: 1px solid var(--line);
}

.setup-list div {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.setup-list h3 {
  color: var(--ink);
}

.setup-list p {
  max-width: 720px;
  margin-bottom: 0;
}

.plain-list {
  display: grid;
  gap: 8px;
  padding-left: 1.15rem;
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}
```

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npm test -- tests/site-content.test.mjs
```

Expected: the new shack page test passes; homepage and radio page tests may still fail until later tasks.

- [ ] **Step 4: Run Astro check for the new route**

Run:

```bash
mise run check
```

Expected: PASS with Astro content sync completing.

- [ ] **Step 5: Commit the shack page**

Run:

```bash
jj commit -m "Add N1RWJ shack page"
```

Expected: `jj` creates a commit and advances to a new empty working copy revision.

## Task 3: Rework The Homepage Into Radio Dispatch

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Replace homepage data setup**

In `src/pages/index.astro`, replace the `notes`, `recentProjects`, and `currentBench` declarations with:

```astro
const allNotes = (await getCollection("notes")).sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
);

const latestNote = allNotes[0];
const notes = allNotes.slice(0, 4);

const projects = (await getCollection("projects")).sort(
  (a, b) => b.data.updated.valueOf() - a.data.updated.valueOf(),
);

const recentProjects = projects.slice(0, 3);

const benchLinks = [
  {
    label: "Latest note",
    title: latestNote.data.title,
    text: `${formatDate(latestNote.data.date)} · ${latestNote.data.summary}`,
    href: `/notes/${latestNote.id}/`,
  },
  {
    label: "Radio setup",
    title: "My shack",
    text: "Home station, portable HF kit, antennas, and operating workflow notes.",
    href: "/radio/shack/",
  },
  {
    label: "POTA",
    title: "2026 Activate All RI POTA",
    text: "The map-first tracker for activating every Rhode Island POTA reference.",
    href: "/projects/2026-activate-all-ri-pota/",
  },
  {
    label: "Radio notes",
    title: "N1RWJ field reports",
    text: "POTA, CW, station setup, antennas, and practical radio debugging.",
    href: "/radio/",
  },
];
```

- [ ] **Step 2: Replace the hero copy and sidebar markup**

In `src/pages/index.astro`, replace the hero section with:

```astro
<section class="hero compact" aria-labelledby="page-title">
  <div class="intro">
    <p class="eyebrow">N1RWJ / Robert Jackson</p>
    <h1 id="page-title">Radio notes from the bench and field.</h1>
    <p class="lede strong">
      I operate amateur radio as N1RWJ, mostly around portable HF, CW, POTA,
      antennas, and the station work that makes those things repeatable.
    </p>
    <p class="lede">
      This site is where I keep field reports, station notes, project context,
      and the occasional software writeup. The common thread is practical
      debugging: make the setup clear, try the experiment, write down what
      actually happened.
    </p>
  </div>

  <aside class="bench-panel" aria-labelledby="bench-title">
    <h2 id="bench-title">On the bench</h2>
    <div class="bench-list linked">
      {
        benchLinks.map((item) => (
          <a href={item.href}>
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
          </a>
        ))
      }
    </div>
  </aside>
</section>
```

- [ ] **Step 3: Rename the lower section headings**

In the first lower section, change:

```astro
<p class="section-label">Recent</p>
<h2>Recent from the bench</h2>
```

to:

```astro
<p class="section-label">Latest</p>
<h2>Recent notes</h2>
```

In the projects section, change:

```astro
<p class="section-label">Projects</p>
<h2>Recently updated projects</h2>
```

to:

```astro
<p class="section-label">Projects</p>
<h2>Active projects</h2>
```

- [ ] **Step 4: Replace the closing bridge copy**

Replace the final bridge section with:

```astro
<section class="bridge" aria-labelledby="bridge-title">
  <p class="section-label">Workshop</p>
  <h2 id="bridge-title">Radio leads, but the habits carry across.</h2>
  <p>
    Portable radio, station building, software tooling, and infrastructure all
    reward the same work: clear logs, repeatable setups, careful debugging, and
    honest notes about what failed.
  </p>
  <nav class="path-links" aria-label="Workshop paths">
    <a href="/radio/shack/">My shack</a>
    <a href="/notes/">Notes</a>
    <a href="/projects/">Projects</a>
    <a href="/radio/">Radio</a>
  </nav>
</section>
```

- [ ] **Step 5: Add linked bench CSS**

In `src/styles/global.css`, replace the existing `.bench-list div`, `.bench-list span`, and `.bench-list p` blocks with:

```css
.bench-list a {
  display: grid;
  gap: 6px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none;
}

.bench-list a:hover strong {
  color: var(--blue);
}

.bench-list span {
  display: block;
  color: var(--rust);
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
}

.bench-list strong {
  color: var(--ink);
  font-size: 1rem;
  line-height: 1.35;
}

.bench-list p {
  margin-bottom: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.45;
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/site-content.test.mjs
```

Expected: homepage tests pass if the new literals and links are present. The radio page test may still fail until Task 4.

- [ ] **Step 7: Commit the homepage dispatch**

Run:

```bash
jj commit -m "Rework homepage as a radio dispatch"
```

Expected: `jj` creates a commit and advances to a new empty working copy revision.

## Task 4: Link The Shack Page From Radio

**Files:**
- Modify: `src/pages/radio/index.astro`

- [ ] **Step 1: Add a shack setup section before radio notes**

In `src/pages/radio/index.astro`, add this section after the existing "What belongs here" section and before the "Field reports" section:

```astro
<section class="bridge" aria-labelledby="shack-title">
  <p class="section-label">Station</p>
  <h2 id="shack-title">My shack</h2>
  <p>
    The current home station, portable HF kit, antennas, logging habits, and
    operating workflow notes behind the field reports.
  </p>
  <nav class="path-links" aria-label="Station setup">
    <a href="/radio/shack/">View the setup</a>
  </nav>
</section>
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npm test -- tests/site-content.test.mjs
```

Expected: PASS for the homepage, route, shack, and radio smoke tests.

- [ ] **Step 3: Commit the radio page link**

Run:

```bash
jj commit -m "Link radio page to shack notes"
```

Expected: `jj` creates a commit and advances to a new empty working copy revision.

## Task 5: Full Validation And Browser Verification

**Files:**
- No source edits expected unless validation finds a real issue.

- [ ] **Step 1: Run Astro validation**

Run:

```bash
mise run check
```

Expected: PASS.

- [ ] **Step 2: Run the static build**

Run:

```bash
mise run build
```

Expected: PASS and `dist/` generated.

- [ ] **Step 3: Start the dev server**

Run:

```bash
mise run dev
```

Expected: Astro reports a local URL such as `http://localhost:4321/`.

- [ ] **Step 4: Verify desktop homepage with agent-browser**

Run:

```bash
agent-browser open http://localhost:4321/
agent-browser wait --load networkidle
agent-browser set viewport 1440 1000
agent-browser screenshot --full --screenshot-dir /private/tmp/rwjblue-homepage-checks
agent-browser snapshot -i
```

Expected: the screenshot shows the radio-first hero, linked "On the bench" panel, recent notes, and active projects without overlapping text.

- [ ] **Step 5: Verify mobile homepage with agent-browser**

Run:

```bash
agent-browser set viewport 390 844
agent-browser screenshot --full --screenshot-dir /private/tmp/rwjblue-homepage-checks
agent-browser snapshot -i
```

Expected: the hero, bench links, recent notes, and projects stack cleanly. Text remains readable and no section overlaps another.

- [ ] **Step 6: Verify radio routes with agent-browser**

Run:

```bash
agent-browser open http://localhost:4321/radio/
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser open http://localhost:4321/radio/shack/
agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot --full --screenshot-dir /private/tmp/rwjblue-homepage-checks
```

Expected: `/radio/` includes a visible link to "My shack"; `/radio/shack/` renders the setup page with Home station, Portable kit, Operating focus, and Last updated content.

- [ ] **Step 7: Close the browser session**

Run:

```bash
agent-browser close
```

Expected: the agent-browser session closes.

- [ ] **Step 8: Commit validation fixes only if needed**

If validation required source changes, commit them:

```bash
jj commit -m "Polish homepage radio dispatch layout"
```

Expected: commit only real fixes found during validation. If no source changes were needed, skip this step.

## Self-Review Checklist

- The plan covers the approved spec: homepage structure, linked bench panel, `/radio/shack/`, radio page link, tests, Astro validation, build validation, and `agent-browser` screen checks.
- The plan keeps scope to existing Astro pages, global CSS, and smoke tests.
- No new content collection, equipment database, live data, deployment change, or template redesign is included.
- Every source file named in the spec has a task.
- Every verification command has an expected result.

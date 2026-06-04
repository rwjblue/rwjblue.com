# Homepage Notes-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the homepage so readers see a merged recent activity timeline immediately, with active projects in a secondary rail.

**Architecture:** Keep the homepage as a single Astro page backed by existing `notes` and `projects` content collections. Build normalized activity objects in frontmatter, sort by date, and render them through existing list-style CSS patterns with a few homepage-specific layout classes.

**Tech Stack:** Astro content collections, TypeScript in Astro frontmatter, shared CSS, Node test runner assertions.

---

### Task 1: Update Homepage Content Test

**Files:**
- Modify: `tests/site-content.test.mjs`

- [ ] **Step 1: Replace the homepage test assertions**

Replace the body of `test("homepage presents a radio-led dispatch with live paths", () => { ... })` with:

```js
test("homepage presents a notes-first recent activity timeline", () => {
  const homepage = read("src/pages/index.astro");

  assert.match(homepage, /N1RWJ/);
  assert.match(homepage, /activityItems/);
  assert.match(homepage, /Recent activity/);
  assert.match(homepage, /Active projects/);
  assert.match(homepage, /type: "note"/);
  assert.match(homepage, /type: "project"/);
  assert.match(homepage, /note\.data\.date/);
  assert.match(homepage, /project\.data\.updated/);
  assert.match(homepage, /href=\{item\.href\}/);
  assert.match(homepage, /\/radio\/shack\//);
  assert.match(homepage, /href="\/radio\/"/);
  assert.doesNotMatch(homepage, /On the bench/);
  assert.doesNotMatch(homepage, /benchLinks/);
  assert.doesNotMatch(homepage, /Current bench/);
  assert.doesNotMatch(homepage, /\/now\//);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --test-name-pattern "homepage presents a notes-first recent activity timeline"`

Expected: FAIL because `activityItems` and the new homepage structure do not exist yet.

### Task 2: Implement Notes-First Homepage Markup

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace derived homepage data**

Replace the current `latestNote`, `notes`, `recentProjects`, and `benchLinks` declarations with:

```js
const noteItems = allNotes.map((note) => ({
  type: "note" as const,
  label: "Note",
  date: note.data.date,
  title: note.data.title,
  summary: note.data.summary,
  href: `/notes/${note.id}/`,
}));

const projects = (await getCollection("projects")).sort(
  (a, b) => b.data.updated.valueOf() - a.data.updated.valueOf(),
);

const projectItems = projects.map((project) => ({
  type: "project" as const,
  label: "Project",
  date: project.data.updated,
  title: project.data.title,
  summary: project.data.summary,
  href: `/projects/${project.id}/`,
  status: project.data.status,
}));

const activityItems = [...noteItems, ...projectItems]
  .sort((a, b) => b.date.valueOf() - a.date.valueOf())
  .slice(0, 8);

const activeProjects = projects
  .filter((project) => project.data.status === "active")
  .slice(0, 4);
```

- [ ] **Step 2: Replace the homepage body**

Replace everything inside `<BaseLayout>...</BaseLayout>` with:

```astro
<BaseLayout>
  <section class="home-intro" aria-labelledby="page-title">
    <p class="eyebrow">N1RWJ / Robert Jackson</p>
    <h1 id="page-title">Recent field notes and workshop updates.</h1>
    <p class="lede">
      Portable HF, CW, POTA, station work, software tooling, and the practical
      debugging notes that make those projects easier to repeat.
    </p>
  </section>

  <div class="home-grid">
    <section class="section-block activity-block" aria-labelledby="activity-title">
      <div class="section-heading">
        <p class="section-label">Latest</p>
        <h2 id="activity-title">Recent activity</h2>
      </div>
      <ol class="entry-list activity-list">
        {
          activityItems.map((item) => (
            <li class={`activity-item activity-item--${item.type}`}>
              <div class="activity-meta">
                <span>{item.label}</span>
                <time datetime={item.date.toISOString()}>
                  {formatDate(item.date)}
                </time>
              </div>
              <a href={item.href}>{item.title}</a>
              <p>{item.summary}</p>
            </li>
          ))
        }
      </ol>
      <nav class="section-more" aria-label="Browse writing">
        <a href="/notes/">All notes</a>
        <a href="/projects/">All projects</a>
      </nav>
    </section>

    <aside class="section-block project-rail" aria-labelledby="projects-title">
      <div class="section-heading">
        <p class="section-label">Projects</p>
        <h2 id="projects-title">Active projects</h2>
      </div>
      <div class="artifact-list compact">
        {
          activeProjects.map((project) => (
            <a href={`/projects/${project.id}/`} class="artifact-item">
              <span>
                {project.data.status} · updated {formatDate(project.data.updated)}
              </span>
              <strong>{project.data.title}</strong>
              <p>{project.data.summary}</p>
            </a>
          ))
        }
      </div>
      <nav class="section-more" aria-label="Project index">
        <a href="/projects/">All projects</a>
      </nav>
    </aside>
  </div>

  <nav class="path-links home-paths" aria-label="Site sections">
    <a href="/notes/">Notes</a>
    <a href="/projects/">Projects</a>
    <a href="/radio/">Radio</a>
    <a href="/radio/shack/">My shack</a>
  </nav>
</BaseLayout>
```

- [ ] **Step 3: Run the focused test and verify it passes**

Run: `npm test -- --test-name-pattern "homepage presents a notes-first recent activity timeline"`

Expected: PASS for the homepage test.

### Task 3: Add Homepage Layout CSS

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add homepage-specific layout rules**

Add these rules after the `.lede.strong` block:

```css
.home-intro {
  max-width: 760px;
  padding-bottom: 28px;
}

.home-intro h1 {
  max-width: 720px;
  margin-bottom: 14px;
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
}

.home-intro .lede {
  max-width: 680px;
  margin-bottom: 0;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.38fr);
  gap: 46px;
  align-items: start;
}

.activity-block {
  min-width: 0;
}

.activity-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: baseline;
}

.activity-meta span {
  color: var(--rust);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    monospace;
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
}

.activity-meta time {
  color: var(--quiet);
}

.project-rail {
  min-width: 0;
}

.artifact-list.compact .artifact-item {
  padding: 16px 0;
}

.artifact-list.compact .artifact-item strong {
  font-size: 1rem;
  line-height: 1.35;
}

.artifact-list.compact .artifact-item p {
  font-size: 0.92rem;
  line-height: 1.45;
}

.home-paths {
  margin-top: 42px;
}
```

- [ ] **Step 2: Update mobile grid selector**

In the `@media (max-width: 820px)` grid reset selector, add `.home-grid` after `.section-grid,` so the homepage columns stack on mobile.

- [ ] **Step 3: Add mobile homepage spacing**

Inside `@media (max-width: 820px)`, after the `h1` rule, add:

```css
  .home-intro {
    padding-bottom: 24px;
  }

  .home-intro h1 {
    font-size: clamp(2.2rem, 12vw, 3.4rem);
  }

  .home-grid {
    gap: 34px;
  }
```

- [ ] **Step 4: Run validation**

Run: `mise run check`

Expected: PASS.

Run: `mise run build`

Expected: PASS.

### Task 4: Visual Verification

**Files:**
- No source files changed unless visual verification exposes a defect.

- [ ] **Step 1: Start preview server**

Run: `mise run preview`

Expected: the preview server starts and prints a local URL, normally `http://localhost:4321/`.

- [ ] **Step 2: Capture desktop screenshot**

Open the homepage at desktop width and verify:

- The intro is compact.
- Recent activity appears in the first viewport.
- Projects appear in a right rail.
- No text overlaps.

- [ ] **Step 3: Capture mobile screenshot**

Open the homepage at mobile width and verify:

- The intro, recent activity, projects, and path links stack in that order.
- Timeline summaries fit without horizontal overflow.
- No text overlaps.

- [ ] **Step 4: Stop preview server**

Stop the preview process before finishing.

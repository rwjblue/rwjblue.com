# rwjblue.com

Personal landing page for `rwjblue.com` and `n1rwj.com`. `n1rwj.radio` is
planned but is not currently attached.

## Content Model

The site is a small public workshop:

- Home is the overview: current bench, recent notes, and recently updated
  projects.
- Notes are dated updates, logs, observations, and field reports.
- Projects are durable workstreams or artifacts that can collect context over
  time.
- Radio is the N1RWJ context page plus radio-tagged notes.

When in doubt, write a note. Notes are the lowest-friction content type and can
later link to, or be linked from, a project.

## Adding Content

### Add A Note

Create a Markdown file in `src/content/notes/`:

```md
---
title: Short descriptive title
date: YYYY-MM-DD
summary: One sentence describing why this note exists.
tags:
  - radio
  - field-report
---

Write the note here.
```

Notes appear on `/notes/` and the three newest notes appear on the homepage.
Any note tagged `radio` also appears on `/radio/`.

Use notes for:

- Field reports
- POTA activation notes
- Station setup notes
- Debugging writeups
- Small software observations
- Site/workshop updates

### Add Or Update A Project

Create or edit a Markdown file in `src/content/projects/`:

```md
---
title: Project name
status: active
updated: YYYY-MM-DD
summary: One sentence describing the project or durable workstream.
tags:
  - radio
  - tooling
---

Write durable project context here.
```

Projects appear on `/projects/`. Recently updated projects appear on the
homepage, sorted by `updated`.

Use projects for durable buckets: ongoing tools, long-running maintenance,
radio fieldcraft, historical work, or experiments that should have a stable URL.
When a project changes, update its `updated` date. If the change is a log entry
or field report, write a note instead and optionally link it from the project.

Project status must be one of:

- `active`
- `historical`
- `experiment`
- `quiet`

## Where Updates Go

- "I did something today" goes in `notes`.
- "I learned or debugged something specific" goes in `notes`.
- "This is a field report" goes in `notes` with `radio` and `field-report`.
- "This describes an ongoing area of work" goes in `projects`.
- "This project changed materially" updates the project body and `updated`.
- "This is current focus" updates the homepage `currentBench` data in
  `src/pages/index.astro`.

## Local Development

This project uses [mise](https://mise.jdx.dev/) for tool versions and file-based
tasks.

```bash
mise install
mise run install
mise run dev
```

## Validation

```bash
mise run check
mise run build
```

## Deployment

The site deploys to Cloudflare Workers Static Assets. See
[docs/deployment.md](docs/deployment.md).

---
name: note-authoring
description: Draft, edit, clean up, or publish Astro notes for rwjblue.com from rough notes, dictation, screenshots, or an existing draft. Use for work in src/content/notes, including frontmatter, slugs, asset organization, editorial cleanup, social share images, publication readiness, and final validation. POTA activation reports use pota-field-report as a specialized extension of this skill.
---

# Note Authoring

Create concise, accurate, useful notes that feel complete enough to share while
preserving meaningful uncertainty and follow-up work.

## Workflow

1. Read the full existing note when editing; do not optimize one section without
   checking the article's overall flow.
2. Establish the intended reader, the useful outcome, and what has actually been
   verified. Ask only for missing facts that materially affect the note.
3. Inspect nearby notes for current conventions before introducing a new
   structure or asset pattern.
4. Draft or revise the note in `src/content/notes/`.
5. Add and visually inspect images, captions, alt text, and social metadata.
6. Remove duplicated diagnostics, stale setup history, placeholders, and
   resolved questions. Keep a short remaining-tests or open-questions section
   when it honestly scopes what is not yet verified.
7. Run `mise run check` and `mise run build`. For image or layout changes, also
   inspect the rendered result at representative desktop and mobile sizes.

For a POTA activation or rove, also use `pota-field-report`; it adds park links,
tags, log-derived maps, image sanitation, and tracker updates.

## File and Frontmatter Conventions

Use `YYYY-MM-DD-short-descriptive-slug.md` for dated notes. Keep the filename
lowercase, ASCII, and hyphenated. Put related assets under a matching directory,
usually `public/images/<topic>/<slug>/`.

Use the current collection schema from `src/content.config.ts`:

```yaml
---
title: A clear reader-facing title
date: YYYY-MM-DD
publishAt: "YYYY-MM-DDTHH:MM:SS-04:00" # optional scheduled publication
summary: "One concise sentence that works in indexes and link previews."
visibility: draft # omit for public notes
shareImage: /images/<topic>/<slug>/share.png # optional
tags:
  - relevant-tag
---
```

`title`, `date`, and `summary` are required. Keep tags lowercase and reuse the
site's established vocabulary. Give recurring events and projects a stable,
specific tag so reports can be found across years. Specialized notes may also
use `contactMap` or `boundaryMap`; follow the owning feature's guidance before
adding them.

`visibility` defaults to `public` and supports three states:

- `public` appears everywhere unless it has a future `publishAt`.
- `unlisted` receives a production route with `noindex` metadata but is omitted
  from indexes, RSS, and generated POTA data. Treat it as public to anyone who
  has or guesses the URL.
- `draft` renders during `mise run dev` and opt-in draft preview builds, but is
  omitted from normal production route generation and all public discovery
  surfaces.

Use `publishAt` only with `visibility: public` (or omitted visibility) when a
finished note should publish automatically later. It must be a quoted ISO 8601
timestamp with an explicit `Z` or numeric UTC offset. Before that timestamp the
note is a scheduled preview: it renders in local development and
`INCLUDE_DRAFTS=true` preview builds with `noindex`, but normal production
builds omit its route and all public discovery links. The hourly Worker check
triggers a production rebuild after the timestamp; expect publication within
about one hour plus build time.

Keep drafts in `src/content/notes/` so they use the real note layout. Drafts
and scheduled notes appear in separate preview-only sections on the local notes
index. Set `INCLUDE_DRAFTS=true` for an explicit static preview build. Change a
draft to `public` only when the publication checklist is complete; add a future
`publishAt` when that completed note should wait for automatic publication.

Files under `public/` are copied into every build regardless of note
visibility. Do not put sensitive draft- or scheduled-only material there. Keep
private assets off the production branch or introduce an explicit
processed-asset workflow before relying on publication gating for them.

## Editorial Standard

- Lead with what worked, changed, or was learned.
- Write in Robert's first-person voice: plain, technical, modest, and useful
  later.
- Give enough context for a reader to reproduce or evaluate the work without
  turning the article into an unfiltered investigation log.
- Preserve uncertainty instead of inventing facts. Distinguish confirmed
  behavior from inference and planned testing.
- Use ADIF/Cabrillo logs, telemetry, repository inspection, and other research
  artifacts silently to establish facts. Write the published narrative from
  Robert's point of view; avoid phrases such as "the log shows," "the data
  confirms," or descriptions of the verification process unless examining the
  artifact is itself part of the story.
- Prefer a compact troubleshooting section over a chronological list of every
  failed attempt.
- Use descriptive headings and short paragraphs that read well on a phone.
- Link primary projects, manuals, issues, and pull requests near the claims they
  support.
- Link the first natural mention of every other amateur radio operator named
  in prose to `https://www.qrz.com/db/CALLSIGN`, including when both their name
  and callsign are given. Verify uncertain callsigns before publication. Do
  not force QRZ links into code blocks or literal exchange examples.
- Keep credentials, private network addresses, pre-shared keys, and other
  secrets out of prose and screenshots.

## Images

- Use root-relative Markdown paths and descriptive alt text.
- Resize images for the web and strip metadata, especially location metadata.
  Use a topic-specific sanitizer when the repository provides one.
- Inspect screenshots for secrets, notifications, account details, and
  irrelevant desktop chrome before publishing.
- Place each image beside the text it supports. Avoid an image dump at the end.
- Keep a reproducible generator script when a designed or data-derived image
  would otherwise be difficult to update.

## Social Share Images

`shareImage` is the only editor-facing social-image field.

Resolution order:

1. A note with `contactMap` or `boundaryMap` uses its generated map card. For a
   contact-map note, `shareImage` optionally supplies the hero photo inside that
   card.
2. An ordinary note with `shareImage` publishes that asset directly.
3. An ordinary note without `shareImage` receives the branded generated card
   containing its title, summary, date, and tags.

For a purpose-built card:

- Use 1200 x 630 pixels.
- Make the title and central idea legible at roughly 600 x 315 pixels.
- Prefer one strong visual relationship over a dense screenshot.
- Reuse the site's established colors and `rwjblue / N1RWJ` identity.
- Verify the built page's `og:image` and `twitter:image` point to the intended
  asset.

Do not add another frontmatter field for a hero or preview image. Use
`shareImage` with the behavior above.

## Completion Checklist

- Frontmatter matches `src/content.config.ts`.
- Visibility matches the intended publication state.
- The filename, asset directory, title, summary, and tags agree.
- Claims and unresolved questions accurately reflect what was tested.
- Research artifacts support the facts without becoming the narrator.
- Other hams named in prose have a verified QRZ link at first mention.
- Links, image paths, and alt text are valid.
- Social-image selection is deliberate or the generated fallback is acceptable.
- `mise run check` and `mise run build` pass.
- Any changed visual has been inspected at a realistic rendered size.

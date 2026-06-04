---
name: pota-field-report
description: Draft publishable Astro notes for Parks on the Air (POTA) activations from dictated or rough mobile field notes. Use when the user wants to record, clean up, or publish a POTA operation recap, activation report, QRP field note, radio field log, portable HF outing, CW activation note, or post-operation field report for rwjblue.com.
---

# POTA Field Report

Turn rough, dictated, or fragmentary POTA operation notes into a site-ready Astro
note draft for this repository.

## Output Target

Create a Markdown note in `src/content/notes/` using this site's current content
schema:

```yaml
---
title: ...
date: YYYY-MM-DD
summary: ...
shareImageHero: /images/pota/<slug>/<filename>.jpg # optional
tags:
  - radio
  - pota
---
```

Use a filename like `YYYY-MM-DD-park-or-place-pota.md`. Keep the slug lowercase,
ASCII, and hyphenated.

## Workflow

1. Extract facts from the user's dictated notes.
2. Ask for missing essentials only when they are needed to create a credible
   draft: location or park, operation date, and a basic activation summary.
3. Preserve uncertainty instead of inventing facts. Mark uncertain details with
   plain prose such as "I need to confirm..." or "I think...".
4. For a rove or multiple related stops on one day, prefer one combined note
   unless the user asks for separate posts. Summarize the whole route first,
   then give each park its own subsection.
5. Read `references/report-template.md` before drafting the report body.
6. Ensure every referenced POTA park has local metadata before linking it:
   `mise run pota:park:ensure -- US-1234`. For a rove, run this for every
   stop/reference in the note.
7. Write the Astro note draft into `src/content/notes/`.
8. If images are provided or mentioned, sanitize them with
   `mise run pota:images:sanitize -- --slug <slug> <image>...` before
   referencing files in `public/images/pota/<slug>/`.
9. After writing, refresh generated POTA tracker and park page data:
   `mise run pota:update`.
10. After writing, run the repository's normal validation for content changes
   when practical: `mise run check` and `mise run build`.

## Dictation Cleanup

- Normalize obvious speech-to-text artifacts without changing the meaning.
- Convert spoken punctuation and section labels into clean Markdown.
- Keep radio terms intact: POTA, QRP, CW, SSB, HF, EFHW, QSO, RBN, SOTA, park
  references, callsigns, bands, modes, and rig names.
- If a callsign, park reference, frequency, band, or QSO count is ambiguous,
  leave it unresolved and ask or mark it as uncertain.
- When later evidence resolves uncertainty, update the prose directly and
  remove stale "to confirm" notes.
- Do not over-polish. The report should still sound like the operator made a
  note soon after the activation.

## Rove Notes

For a multi-park rove, use a single flowing narrative with one subsection per
park or twofer. Open with the total result when known: number of stops, park
references, total QSOs, mode, and the main lesson or texture of the day.

For each park subsection:

- Link the heading to the local canonical POTA park page:
  `## [Park Name, US-1234](/radio/pota/US-1234/)`.
- Include the park name, POTA reference, QSO count, bands, modes, UTC window,
  and equipment that changed at that stop.
- Mention setup and teardown time when the user gave it, especially for quick
  rove logistics.
- Add frontmatter tags for every park reference, lowercased:
  `us-7719`, `us-6983`, etc.
- For twofers, put both linked park references in the same heading and explain
  the shared operating position once.

## Editorial Voice

Write from first principles for useful portable radio field notes. The report
should connect the operator's intent, the site constraints, the station choices,
the on-air result, and the lessons worth remembering. Keep it in Robert's
public-site style: plain, technical, concise, modest, and useful later.

Write from Robert's perspective. Prefer direct first-person prose over detached
phrases like "the station" when "I used..." or "the KX3..." sounds more natural.
Do not imitate another writer's style directly, but it is fine to aim for a
practical field-notes feel: grounded observations, useful details, and no hype.

Good field reports usually include:

- Why this park, site, time window, or setup was chosen.
- What the operator expected before arriving.
- What changed once the site was actually seen.
- How the station was deployed: radio, antenna, support, power, logging, and
  operating position.
- What happened on the air: bands, modes, contact pace, problems, and stopping
  point.
- One or two grounded observations about conditions, ergonomics, or workflow.
- A short note about what to repeat or adjust next time.

When naming a POTA park with its reference anywhere in the note, link that
park/reference text to the local canonical POTA park page, not only section headings. This
includes first mentions, "At a glance" location bullets, and later repeated
references when the park name/reference is useful to the reader:
`[Park Name, US-1234](/radio/pota/US-1234/)`.

The canonical page at `/radio/pota/US-1234/` provides the external POTA.app
link, park metadata, map, and activation ledger. Keep lowercased reference tags
such as `us-1234` in frontmatter so field notes can attach to matching
activation rows by date and reference.

Prefer:

- "I set the wire low because the site was busy..."
- "The station worked, but the logging flow still needs cleanup."
- "Next time I would bring..."

Avoid:

- Inflated adventure writing.
- Generic ham-radio filler.
- Stiff phrasing such as "the station was deployed" when a simpler sentence
  would sound more like Robert.
- Treating QRP as implied. Mention QRP only when the user's notes identify the
  operation as QRP.
- Invented drama, contacts, weather, park facts, or equipment details.
- Making a corrected field mistake sound like a moral. State what happened, why
  it matters, and what to remember.

## Image Handling

If images are attached and accessible, run them through the local sanitizer
before placing or replacing files under `public/images/pota/<slug>/`:

```bash
mise run pota:images:sanitize -- --slug <slug> <image>...
```

The sanitizer writes web-sized JPEGs with lowercase hyphenated filenames,
auto-orients the image, and strips metadata, including location metadata. Use
`--max-edge 900` for tall contact maps or route screenshots, and the default
1600px max edge for normal field photos. Reference the sanitized files in
Markdown with root-relative paths:

```markdown
![Portable station setup at <place>](/images/pota/<slug>/station-setup.jpg)
```

For roves, put the final route or contact map near the top of the note if one is
provided. Put park photos inline with the park subsection they describe instead
of collecting them at the bottom.

When a subsection has several photos, use the site's compact photo grid pattern
instead of a long run of full-width images:

```html
<div class="photo-grid">
  <img src="/images/pota/<slug>/first-photo.jpg" alt="Descriptive alt text">
  <img src="/images/pota/<slug>/second-photo.jpg" alt="Descriptive alt text">
</div>
```

For a single supporting photo that should be smaller than the lead image:

```html
<div class="photo-grid photo-grid--single">
  <img src="/images/pota/<slug>/station-setup.jpg" alt="Descriptive alt text">
</div>
```

For a contact map, prefer generating checked-in JSON from the ADI log when
`GRIDSQUARE` data is available. Use the `pota-contact-map-bootstrap` skill for
this flow:

```bash
mise run pota:contact-map:from-adi -- \
  --input <log.adi> \
  --output src/data/pota/contact-maps/<slug>.json \
  --title "N1RWJ at US-1234" \
  --subtitle "Park Name - 25 QSOs - May 27, 2026"
```

Wire the generated JSON through `PotaContactMap.astro` from the note page rather
than committing the ADI. For a route screenshot or other tall utility image that
should be more compact than a field photo, combine the single-image grid with
the compact modifier:

```html
<div class="photo-grid photo-grid--single photo-grid--compact">
  <img src="/images/pota/<slug>/route-map.jpg" alt="Descriptive alt text">
</div>
```

If the note has a dedicated contact map and should use that map in social
previews, generate the checked-in share image too:

```bash
mise run pota:images:generate-note-share-image -- <slug>
```

When a field photo should dominate the social card, set `shareImageHero` in the
note frontmatter to the root-relative path for that image. The share card will
use a hero-primary layout with a smaller contact map panel.

If images are only mentioned during dictation, add a short "Images to add" list
with expected filenames or captions. Do not pretend missing images exist.

## Completion Checklist

Before reporting completion, confirm:

- The note has valid frontmatter for the `notes` collection.
- The report includes where, when, equipment, and a prose walkthrough.
- CW-specific equipment such as keyer or paddle is included when relevant.
- Unknown facts are marked as unknown instead of fabricated.
- Image paths or placeholders are clear.

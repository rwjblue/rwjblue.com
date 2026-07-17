---
name: pota-field-report
description: Draft publishable Astro notes for Parks on the Air (POTA) activations from dictated or rough mobile field notes. Use when the user wants to record, clean up, or publish a POTA operation recap, activation report, QRP field note, radio field log, portable HF outing, CW activation note, rove, or post-operation field report for rwjblue.com. Extends the repository's note-authoring workflow with POTA-specific links, tags, images, contact maps, and tracker updates.
---

# POTA Field Report

Turn rough activation notes into a site-ready field report without inventing
contacts, conditions, equipment, or park facts.

## Base Workflow

This skill extends `note-authoring`. Before taking action, read
`../note-authoring/SKILL.md` completely and follow its requirements. This skill
adds the POTA-specific rules below; it does not replace the base editorial,
asset, social-image, or validation workflow.

Also read `references/report-template.md` before drafting the report body.

## POTA Frontmatter and Filename

Start with the base note frontmatter and add the applicable POTA fields:

```yaml
---
title: <Park or trip> POTA field report
date: YYYY-MM-DD
summary: "One concise sentence about the activation, setup, or lesson."
shareImage: /images/pota/<slug>/<hero-photo>.jpg # optional
contactMap: src/data/pota/contact-maps/<slug>.json # optional
tags:
  - radio
  - pota
  - field-notes
  - us-1234
---
```

Use a filename such as `YYYY-MM-DD-park-or-place-pota.md`. Add every activated
POTA reference as a lowercase tag so field notes attach to activation rows.

For contact-map notes, `shareImage` is the optional hero photo used inside the
generated map card; the generated card remains the published social image. Do
not add a separate hero-image field.

## Workflow

1. Extract facts from the user's notes and preserve unresolved uncertainty.
2. Ask for missing essentials only when needed for a credible draft: park or
   location, operation date, and a basic activation result.
3. For each referenced park, run
   `mise run pota:park:ensure -- US-1234` before linking it.
4. Draft the note in `src/content/notes/`, following the base skill and report
   template.
5. Sanitize supplied images with
   `mise run pota:images:sanitize -- --slug <slug> <image>...` before using the
   results from `public/images/pota/<slug>/`.
6. When suitable ADI/ADIF logs are available, use the
   `pota-contact-map-bootstrap` skill to create the checked-in contact map.
7. If the note has a contact map, generate its checked-in social card with
   `mise run pota:images:generate-note-share-image -- <slug>`.
8. Refresh generated tracker and park-page data with `mise run pota:update`.
9. Complete the base skill's validation and visual checks.

For a rove or multiple related stops on one day, prefer one combined note unless
the user asks for separate posts. Summarize the full route first, then give each
park or twofer its own subsection.

## Evidence and Dictation Cleanup

- Normalize obvious speech-to-text artifacts without changing meaning.
- Keep POTA, QRP, CW, SSB, HF, EFHW, QSO, RBN, SOTA, callsigns, bands, modes,
  and rig names intact.
- Link callsigns in prose to QRZ with
  `[CALL](https://www.qrz.com/db/CALL)`. Do not link callsigns in code, raw logs,
  file paths, or frontmatter.
- Treat ADI and log data as evidence. Prefer “I made 12 CW QSOs” over “the log
  shows 12 QSOs.”
- If a callsign, park reference, frequency, band, time, or QSO count remains
  ambiguous, ask or mark it as uncertain.
- When evidence resolves an uncertainty, update the prose and remove the stale
  qualification.

## Field-Report Content

Connect the operator's intent, site constraints, station choices, on-air
result, and repeatable lessons. Include the details that were actually supplied:

- why the park, site, time window, or setup was chosen
- what changed after arrival
- radio, antenna, support, power, logging, operating position, and CW gear
- bands, modes, contact pace, problems, and stopping point
- conditions, ergonomics, or workflow observations
- what to repeat or adjust next time

Do not imply QRP unless the source notes establish it. State corrected field
mistakes plainly rather than turning them into drama or a moral.

## Park Links and Roves

Link park names and references to the local canonical page, not directly to
POTA.app:

```markdown
[Park Name, US-1234](/radio/pota/US-1234/)
```

Do this in headings, first mentions, “At a glance” location bullets, and later
mentions where the name/reference helps the reader.

For each rove stop:

- Use a linked park/reference heading.
- Include QSO count, bands, modes, approximate UTC window, and equipment that
  changed at that stop.
- Mention setup or teardown time when it affected the rove.
- Put twofer references in one heading and explain the shared position once.

## POTA Images and Maps

Use the sanitizer's default 1600px maximum edge for ordinary photos and
`--max-edge 900` for tall route or contact-map screenshots.

Place photos with the relevant stop or observation. For multiple photos, use
the site's compact grid:

```html
<div class="photo-grid">
  <img src="/images/pota/<slug>/first-photo.jpg" alt="Descriptive alt text">
  <img src="/images/pota/<slug>/second-photo.jpg" alt="Descriptive alt text">
</div>
```

For one supporting image, use `photo-grid photo-grid--single`; add
`photo-grid--compact` for a tall utility image.

When `GRIDSQUARE` data is available, prefer a checked-in contact-map JSON built
from the source log. Repeat `--input` in operating order for split rove logs so
the activation sequence is preserved. The task archives the source ADIF and
writes the JSON consumed by the site; do not commit a separate raw ADIF beside
the note. Use the bootstrap skill to choose the title and subtitle, then run its
generated command in this form:

```bash
mise run pota:contact-map:from-adi -- \
  --input "$HOME/Downloads/activation.adi" \
  --output "src/data/pota/contact-maps/<slug>.json" \
  --title "N1RWJ at US-1234" \
  --subtitle "12 QSOs - June 1, 2026"
```

If a contact map has `shareImage`, its selected photo is composed with the map.
Without `shareImage`, the generator uses the map-only card. Regenerate the card
after changing the title, summary, map, selected photo, or contact data.

## POTA Completion Checklist

In addition to the base checklist, confirm:

- Park/reference text links to local canonical pages.
- Every reference has a lowercase frontmatter tag.
- Local park metadata exists.
- Where, when, equipment, activation result, and useful field lessons are
  present when known.
- Images have been sanitized and stripped of location metadata.
- Contact-map data and its checked-in share card are current when applicable.
- `mise run pota:update` has refreshed the tracker and park pages.

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
4. Read `references/report-template.md` before drafting the report body.
5. Write the Astro note draft into `src/content/notes/`.
6. If images are provided or mentioned, create or reference
   `public/images/pota/<slug>/`.
7. After writing, run the repository's normal validation for content changes
   when practical: `mise run check` and `mise run build`.

## Dictation Cleanup

- Normalize obvious speech-to-text artifacts without changing the meaning.
- Convert spoken punctuation and section labels into clean Markdown.
- Keep radio terms intact: POTA, QRP, CW, SSB, HF, EFHW, QSO, RBN, SOTA, park
  references, callsigns, bands, modes, and rig names.
- If a callsign, park reference, frequency, band, or QSO count is ambiguous,
  leave it unresolved and ask or mark it as uncertain.
- Do not over-polish. The report should still sound like the operator made a
  note soon after the activation.

## Editorial Voice

Write from first principles for useful portable radio field notes. The report
should connect the operator's intent, the site constraints, the station choices,
the on-air result, and the lessons worth remembering. Keep it in Robert's
public-site style: plain, technical, concise, modest, and useful later.

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

Prefer:

- "I set the wire low because the site was busy..."
- "The station worked, but the logging flow still needs cleanup."
- "Next time I would bring..."

Avoid:

- Inflated adventure writing.
- Generic ham-radio filler.
- Treating QRP as implied. Mention QRP only when the user's notes identify the
  operation as QRP.
- Invented drama, contacts, weather, park facts, or equipment details.

## Image Handling

If images are attached and accessible, place them under
`public/images/pota/<slug>/` with descriptive lowercase filenames. Reference
them in Markdown with root-relative paths:

```markdown
![Portable station setup at <place>](/images/pota/<slug>/station-setup.jpg)
```

If images are only mentioned during dictation, add a short "Images to add" list
with expected filenames or captions. Do not pretend missing images exist.

## Completion Checklist

Before reporting completion, confirm:

- The note has valid frontmatter for the `notes` collection.
- The report includes where, when, equipment, and a prose walkthrough.
- CW-specific equipment such as keyer or paddle is included when relevant.
- Unknown facts are marked as unknown instead of fabricated.
- Image paths or placeholders are clear.

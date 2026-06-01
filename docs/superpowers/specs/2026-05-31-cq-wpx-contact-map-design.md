# CQ WPX Contact Map Design

## Goal

Add a contact map to the `2026-05-31-cq-wpx-cw-learning-weekend` note using
the existing note-level contact-map pipeline, with the CQ WPX weekend ADI export
as the source of truth for the 37 contest QSOs described in the post.

## Current State

- The note page template already renders a contact map whenever a note includes
  `contactMap` frontmatter.
- Existing checked-in map JSON files live in
  `src/data/pota/contact-maps/` and are loaded through
  `src/data/pota/contact-maps/index.ts`.
- Source ADI files are expected to be copied into the gitignored archive under
  `data/pota/source-adi/` before generating checked-in JSON artifacts.
- The CQ WPX note currently has a hero image but no `contactMap` frontmatter.

## Proposed Approach

Reuse the current contact-map workflow without changing templates or component
behavior:

- Copy the CQ WPX ADI export from iCloud Downloads into the local source archive
  under `data/pota/source-adi/`, following the existing archive convention.
- Generate a new checked-in JSON contact map in
  `src/data/pota/contact-maps/` using `scripts/pota/render-contact-map.mjs`.
- Add `contactMap` frontmatter to the CQ WPX note so the existing note template
  renders the map automatically.

This keeps the contest post aligned with the other map-enabled notes and avoids
creating a second rendering path just because the source is a contest log rather
than a POTA activation log.

## Data And Naming

- Treat the ADI file as the authoritative source for the 37 contacts in the
  post.
- Use a WPX-specific output filename that matches the note slug, for example
  `2026-05-31-cq-wpx-cw-learning-weekend.json`.
- Keep the generated map JSON public and checked in.
- Keep the raw ADI file in the gitignored source archive only.

## Error Handling

- If the ADI export cannot be found or cannot be parsed, stop before wiring the
  note frontmatter so the post does not reference a missing artifact.
- Do not change the note template or contact-map component unless the generated
  data exposes a real incompatibility.

## Verification

- Run `mise run check`
- Run `mise run build`
- Preview the CQ WPX note locally
- Verify the note at desktop and mobile widths to confirm the map renders
  correctly and sits cleanly within the existing layout

## Out of Scope

- Renaming the “POTA contact map” component or data directories
- Generalizing the contact-map model for non-POTA radio posts
- Adding new legend, copy, or styling variants just for contest logs

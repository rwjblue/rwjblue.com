# CQ WPX DXCC Share Card Design

## Goal

Update the `2026-05-31-cq-wpx-cw-learning-weekend` note share card so the
social image highlights the 13 brand-new any-mode DXCC entities from the CQ WPX
CW weekend, while keeping the existing K4D hero photo as the primary visual.

## Current State

- Notes with a contact map already render through
  `src/pages/notes/[slug]/share-image.astro`.
- When a note has `shareImageHero`, the share card uses a hero-photo layout:
  large image on the left, map and summary content on the right.
- The current CQ WPX note has a hero image but no contact map, so the existing
  template does not yet support a DXCC-focused achievement layout for it.

## Proposed Approach

Add a note-specific share-card variant for the CQ WPX note that preserves the
existing left-side hero image and replaces the right-side content with a compact
DXCC achievement panel.

The right panel should contain:

- An eyebrow line: `CQ WPX CW`
- A primary headline: `13 new DXCC`
- A short secondary line such as `May 30-31, 2026`
- A badge grid showing the 13 brand-new any-mode entities from the note

The badge grid should optimize for DXCC correctness rather than forcing emoji
flags everywhere. Use emoji flags where they are unambiguous and stable, and
use text-only badges where the DXCC entity does not map cleanly to a standard
flag emoji.

The 13 entities to display are:

- Crete
- Estonia
- Cayman Islands
- Georgia
- Trinidad & Tobago
- Hawaii
- Isle of Man
- Bulgaria
- Cyprus
- Greece
- Poland
- Serbia
- Bonaire

## Data Model

Keep this scoped to the CQ WPX note.

- Add optional note frontmatter fields for share-card metadata only if needed
  to avoid hard-coding the entity list inside the template.
- Prefer a small frontmatter list such as `shareImageBadges` over introducing a
  broader site-wide DXCC content model.
- Do not add CW-specific entity data to this card; the share card should show
  only the 13 all-mode new entities.

## Layout Rules

- Preserve the current 1200x630 share image size.
- Keep the hero image visually dominant on the left side.
- Make the right panel readable at link-preview sizes by using a compact grid
  and short labels.
- Treat each entity as a pill or badge, not a paragraph list.
- Keep the overall visual language aligned with the existing share-card system
  rather than creating a separate poster style.

## Error Handling

- If the note-specific badge data is missing, the share-image page should still
  render a sensible fallback rather than failing.
- The CQ WPX note should keep working with its regular hero image if the badge
  variant is not available.

## Verification

- Run `mise run check`
- Run `mise run build`
- Regenerate or preview the note share-image page locally
- Verify the card at desktop size and inspect legibility of the right-side
  badges in the rendered 1200x630 image

## Out of Scope

- Building a general-purpose DXCC visualization system for all notes
- Showing the 18 CW-specific new entities on this card
- Reworking the main note page layout

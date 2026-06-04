# Homepage Notes-First Redesign

Date: 2026-06-04

## Goal

Make the landing page useful immediately for readers who want to see what has
been published recently. The homepage should stop spending the first viewport on
a large identity hero and instead lead with a merged recent-activity timeline.

## Chosen Direction

Use a notes-first layout with a project rail.

On desktop, the page opens with a compact identity/header area followed directly
by a two-column content layout:

- Main column: a unified recent activity timeline.
- Right rail: active or recently updated projects.

On mobile, the page stacks in reading order:

- Compact identity.
- Recent activity timeline.
- Projects.
- Small navigation links.

## Content Model

The recent activity timeline should merge notes and projects into one dated
list, sorted newest first:

- Notes use `date` as the timeline date.
- Projects use `updated` as the timeline date.
- Each item shows a type label, date, title, and summary.
- Notes link to `/notes/<slug>/`.
- Projects link to `/projects/<slug>/`.

The project rail should still exist because projects give useful context to the
ongoing work, but it should not compete with the timeline as the primary thing
to read.

## Page Structure

Replace the current large hero and "On the bench" panel with:

- A small intro block with `N1RWJ / Robert Jackson`, one concise heading, and one
  paragraph explaining the site.
- A primary "Recent activity" section containing the merged timeline.
- A secondary "Active projects" aside on the right at desktop widths.
- A compact bottom link row for notes, projects, radio, and shack pages.

Remove the separate workshop bridge section from the homepage. Its idea is still
valid, but it repeats the intro and pushes content down.

## Visual Design

Keep the existing restrained typography, color tokens, top borders, and list
treatment. The redesign should feel like the current site becoming denser and
more useful, not like a new visual system.

Specific layout targets:

- Reduce the homepage `h1` scale substantially compared with the current hero.
- Put timeline items above the fold on desktop and mobile.
- Keep projects visible on desktop without turning them into large cards.
- Avoid nested cards and decorative panels.
- Maintain comfortable line length for summaries.

## Accessibility

Use semantic sections, headings, an ordered list for recent activity, readable
link text, and valid `datetime` attributes.

## Validation

Run:

- `mise run check`
- `mise run build`

Because this changes the homepage layout, verify the page visually at desktop
and mobile widths before calling the work complete.

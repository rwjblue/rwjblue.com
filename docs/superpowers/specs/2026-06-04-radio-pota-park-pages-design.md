# Radio POTA Park Pages Design

## Goal

Create canonical POTA reference pages at `/radio/pota/US-1234/`. These pages
are independent of any single project and become the stable place to link park
mentions, field notes, activations, and project metadata.

## Current State

The RI POTA challenge tracker already has useful park and activation data in
`src/data/pota/ri-tracker.json`, but the public page only shows summary fields:
first activation, latest activation, activation count, status, and reference
notes. The generator reads a broader local activation ledger at
`data/pota/ri/activations.json` and field note tags from `src/content/notes/`,
but it does not write a full per-reference activation list into a canonical
park-page data source.

Field notes currently associate with parks through lowercased POTA reference
tags such as `us-6992`. That is enough for a first version, but the page should
show the note on the matching activation row, not only as park-level related
content.

## Canonical URL

Each POTA reference gets a canonical local URL:

```text
/radio/pota/US-1234/
```

The page should use the uppercase reference in generated paths and links. The
RI challenge tracker, field notes, and future POTA-related pages should link to
this local URL instead of directly linking park mentions to POTA.app. The local
park page should still include a prominent external POTA.app link.

## Park Page Content

Each page should show top-level park information:

- POTA reference
- park name
- grid square
- basic location or region text from POTA data
- public POTA stats when cached
- external POTA.app link
- a small map centered on the park

Below the park summary, show all known activations for that reference, newest
first. Each activation row should include:

- activation date
- callsign
- total QSO count
- mode breakdown
- whether it qualifies for the relevant challenge rules when applicable
- inline field note links when a note matches the activation
- inline project labels when that activation belongs to a broader project

Project labels are activation metadata. The park page itself is not scoped to
the RI challenge or any other project.

## Field Note Attachment

Use a simple first-version inference rule:

1. The note frontmatter `date` must match the activation date.
2. The note must include a lowercased reference tag such as `us-6992`.

When both conditions match, attach the note inline to that activation row. The
page may also include a compact "field notes for this reference" index, but the
primary relationship is note-to-activation.

This rule is intentionally simple. It may be insufficient for a future note that
covers multiple activations of the same reference on different dates. If that
happens, add explicit note frontmatter later rather than overbuilding now.

## Project Labels

For the RI POTA challenge, add an inline project label to activation rows when:

- the reference is part of the RI challenge reference set,
- the activation date is in 2026, and
- the activation qualifies under the challenge rules.

The label should be concise, for example `2026 RI POTA Challenge`, and should
link back to `/projects/2026-activate-all-ri-pota/` when useful.

Future projects can add their own membership rules without changing the
canonical park-page route.

## Data Model

Add a broader local POTA park data source that is not owned by the RI challenge.
It should support rendering any valid POTA reference, even though the site will
only intentionally link to parks Robert has personal context for.

The generated park-page data should include:

- cached park metadata keyed by reference
- all known activations grouped by reference
- note metadata including slug, title, date, and tags
- derived note attachments for activation rows
- derived project labels for activation rows

The initial implementation can reuse the existing RI park cache and activation
ledger where practical, but the public route should not depend on the RI
tracker JSON as its only source.

## Park Ensure Task

Add a task like:

```bash
mise run pota:park:ensure -- US-1234
```

The task should fetch or populate the local cached park record for any valid
POTA reference. It should cache enough data for the page to render before a new
field note is published:

- reference
- name
- latitude and longitude
- grid
- location or region text
- public stats when available

The task may render any valid POTA park, but normal workflows should call it
only for parks with personal site context: activations, field notes, or project
membership.

## Backfill Scope

After adding the task and page data pipeline, backfill local park records for:

- every POTA reference tag currently used by field notes
- every reference in the local activation ledger
- every reference in the RI POTA challenge tracker

This ensures existing field note links, activation pages, and RI tracker links
all resolve to working canonical pages.

## RI Tracker Changes

Update the RI challenge checklist and map popups so park links point to
`/radio/pota/US-1234/`. Keep POTA.app available from the canonical park page.

The RI tracker should continue to focus on challenge progress. It should not own
the park detail route.

## Agent Workflow Updates

Update `.agents/skills/pota-field-report/SKILL.md` so field note drafting:

- runs `mise run pota:park:ensure -- US-1234` for each referenced park,
- does this for every stop in a rove,
- keeps lowercased reference tags such as `us-1234`,
- links park mentions to `/radio/pota/US-1234/` instead of POTA.app, and
- relies on the canonical page to provide the external POTA.app link.

Update `.agents/skills/ri-pota/skill.md` so RI challenge work:

- expects checklist and map links to use canonical park pages,
- ensures park records exist for all RI challenge references after tracker
  refreshes or backfills, and
- treats RI challenge labels as activation metadata shown on canonical park
  pages rather than as project-owned detail pages.

After implementation, update `AGENTS.md` with the canonical URL convention,
the park ensure task, and the backfill sources.

## Testing And Validation

For implementation, add focused tests for:

- park metadata caching and page-data generation,
- note-to-activation attachment by reference tag and date,
- project label derivation for RI challenge activations,
- route generation for canonical park pages, and
- RI tracker links pointing to local park pages.

Run `mise run check` and `mise run build` after Astro, CSS, data, or
configuration changes. Since this adds visible pages, verify representative
desktop and mobile layouts in a browser.

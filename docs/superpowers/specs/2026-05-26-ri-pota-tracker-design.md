# Rhode Island POTA Tracker Design

## Goal

Add a public project page that tracks Robert Jackson's effort to activate every
Parks on the Air reference associated with Rhode Island by December 31, 2026.

The tracker is a challenge page and a practical dashboard. It should make the
overall progress obvious, show the remaining work clearly, and provide an
interactive map for exploring completed and remaining references.

## Scope

The public page is exposed at `/projects/2026-activate-all-ri-pota/`.

The tracker includes every reference returned by the POTA `US-RI` park list,
including references whose `locationDesc` includes other states. Any valid
activation by one of Robert's callsigns counts toward completion, regardless of
activation year.

The initial version uses only official POTA park data, activation status, and
field note links inferred from existing note tags. It does not include locally
maintained planning metadata such as ferry access, parking, hike difficulty, or
twofer notes.

## Architecture

The tracker is static at build time. Astro imports generated local JSON data and
does not call POTA APIs during page rendering.

The browser loads an interactive Leaflet map and map tiles, but all tracker
facts come from local generated JSON. Visitors never call POTA APIs from the
site.

The implementation has four data layers:

- raw API caches under `data/pota/ri/cache/`;
- a durable normalized activation ledger under `data/pota/ri/activations.json`;
- generated site data under `src/data/pota/ri-tracker.json`;
- note links inferred from the existing Astro `notes` content collection by
  matching tags like `us-7865`.

Raw cache files are downloaded snapshots. The activation ledger is the durable
source for known completed references. Generated site data is derived from the
official park list, the activation ledger, and note tags.

## POTA Data Sources

Use these public POTA endpoints:

- `https://api.pota.app/location/parks/US-RI`
- `https://api.pota.app/profile/N1RWJ`
- `https://api.pota.app/park/activations/{reference}?count=all`

The `US-RI` location endpoint provides the official inventory, including
reference, name, coordinates, grid, location description, and public aggregate
activity counts.

The profile endpoint is a freshness feed, not durable history. It includes
recent activity and the profile's callsigns, but recent activations can age out.
Refreshing the profile cache must merge newly observed activations into the
durable ledger instead of replacing known status.

Per-park activation endpoints are used for deliberate historical backfill. They
are heavier than the profile endpoint, so they are cached by reference and
refetched only when explicitly requested or stale by policy.

## Completion Rules

A reference is complete when the activation ledger contains at least one
qualifying activation for that reference by one of Robert's callsigns.

The callsign list comes from the profile data and currently includes `N1RWJ`,
`KC1YDM`, and `KB9SMK`. The page can still display `N1RWJ` as the public radio
identity.

For repeated activations, the tracker records enough data to show the first
known qualifying activation and the latest known activation. The first known
activation is the completion date. The latest activation is useful context in
popups and tables.

## Update Tasks

Use project-local, file-based mise tasks under `.mise/tasks/`, following the
repo's existing task convention. Namespaced task files under
`.mise/tasks/pota/ri/` should produce `pota:ri:*` task names.

The expected tasks are:

- `mise run pota:ri:update-parks`
- `mise run pota:ri:update-profile`
- `mise run pota:ri:backfill-activations`
- `mise run pota:ri:build-tracker-data`
- `mise run pota:ri:update-tracker`

`pota:ri:update-tracker` is the normal low-impact update path. It refreshes the
official park list and profile snapshot, merges recent activations into the
ledger, and rebuilds generated site data.

`pota:ri:backfill-activations` is explicit because it can make one request per
park reference. It should use cached per-park responses when available and
summarize any failed references.

TypeScript is preferred for non-trivial task logic involving API calls, JSON
normalization, or argument parsing. If TypeScript tasks are used, local task
tooling should follow the mise task skill conventions, including a local
dependency install task and type checking.

## Page Experience

The page starts with the challenge framing:

- title and short description;
- deadline of December 31, 2026;
- completed count, total count, remaining count, and percent complete;
- last updated timestamp from generated tracker metadata.

The primary visual element is an interactive Leaflet map:

- green markers for completed references;
- yellow markers for remaining references;
- panning and zooming enabled;
- visible tile attribution;
- marker popups with reference details.

Completed reference popups show activation-focused details:

- reference;
- park name;
- completion date;
- QSO and mode summary when known;
- callsign used;
- POTA link;
- field note link when a note tag matches the reference.

Remaining reference popups show planning-neutral details:

- reference;
- park name;
- grid;
- location description;
- POTA link.

The full checklist sits below the map and remains the source of truth for
scanning. It defaults to remaining references first, followed by completed
references. Rows show reference, park name, status, first activation date if
completed, latest activation if known, and field note link when available.

The project should also be reachable through normal project navigation, and the
radio page should link to it as a featured radio project.

## Map Provider

Use Leaflet for map rendering. Keep the tile URL and attribution in one small
configuration point so the site can switch providers later.

Do not bulk-download, prefetch, or commit map tiles. The initial design assumes
normal interactive tile loading in the visitor's browser with proper
attribution.

If map JavaScript or map tiles fail, the checklist still renders and carries
the tracker content.

## Storage And Commit Separation

Store raw downloaded POTA cache data under `data/pota/ri/cache/`:

- `parks-US-RI.json`
- `profile-N1RWJ.json`
- `activations/{reference}.json`

Store the durable activation ledger at:

- `data/pota/ri/activations.json`

Store generated Astro input at:

- `src/data/pota/ri-tracker.json`

Implementation and downloaded/generated data should land in separate commits:

1. code commit: page, scripts, tasks, normalization logic, and tests;
2. data commit: raw POTA caches, durable activation ledger updates, and
   generated tracker JSON.

The code commit should remain reviewable without the noisy external data
snapshot.

## Error Handling

If a POTA API request fails during a cache update, the task should fail clearly
and avoid replacing the previous cache with partial or invalid data.

If profile data is unavailable, tracker generation can still use the existing
park cache and durable activation ledger.

If per-park backfill fails for a reference, the backfill task should report that
reference and continue by default, then summarize failures at the end. A stricter
mode can be added later if needed.

The generated tracker data includes a `lastUpdated` value so stale data is
visible on the public page.

## Validation

Add focused tests for the data normalization and page wiring:

- every `US-RI` reference appears in the generated tracker data;
- multi-state references from the official `US-RI` list are included;
- completion can come from any callsign in the profile callsign list;
- old ledger activations remain complete even when absent from the latest
  profile snapshot;
- notes tagged with a lower-case POTA reference like `us-7865` link to the
  matching tracker reference;
- remaining references sort before completed references in the checklist data.

After implementation, run:

```bash
mise run check
mise run build
```

Because this is a visual map-first page, also verify desktop and mobile layouts
in a browser.

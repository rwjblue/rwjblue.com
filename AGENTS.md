@RTK.md

# Repository Guidelines

## Repository Purpose
- Personal static landing page for `rwjblue.com`, `n1rwj.com`, and
  `n1rwj.radio`.
- Keep the site simple, fast, and deployable as a static Astro build on
  Cloudflare Workers Static Assets.

## Project Structure
- `src/pages/index.astro` contains the public landing page markup and page data.
- `src/styles/global.css` contains global styling for the current single-page
  experience.
- `public/` contains source static assets copied into the build output.
- `docs/deployment.md` documents the Cloudflare Workers setup and domain model.
- `.mise/config.toml` and `.mise/tasks/` define the local toolchain and task
  wrappers.
- `dist/` is generated output; do not edit it by hand.

## Development Commands
- `mise install`: install the configured tool versions.
- `mise run install`: install project dependencies with npm.
- `mise run dev`: start the Astro development server.
- `mise run check`: run Astro validation.
- `mise run build`: build the static site into `dist/`.
- `mise run preview`: preview the production build locally.
- `mise run deploy`: deploy the static site to Cloudflare Workers.

## Coding Style
- Follow the existing Astro and CSS style before introducing new patterns.
- Keep copy concise and accurate for a public personal site.
- Prefer semantic HTML and accessible landmarks, labels, and link text.
- Keep CSS custom properties centralized in `:root` when adding shared colors or
  tokens.
- Use ASCII unless a file already requires non-ASCII content.

## Testing And Validation
- For content-only documentation changes, inspect the diff before finishing.
- For Astro, CSS, asset, or configuration changes, run `mise run check` and
  `mise run build` before reporting completion.
- If visual layout changes are made, also verify the page in a browser at mobile
  and desktop widths.

## Deployment Notes
- Deployment is handled by Cloudflare Workers Static Assets with Wrangler.
- `wrangler.jsonc` is the source of truth for the Worker name, static asset
  directory, custom domains, and preview URL setting.
- Production serves `rwjblue.com` and `n1rwj.com` as Worker custom domains.
- `n1rwj.radio` is not attached until its DNS is managed by Cloudflare.
- Keep the Worker static-only unless the site starts needing request-time
  behavior.
- Keep real Cloudflare credentials and other secrets out of the repository.

## Version Control
- This repo uses `jj` for source control.
- Keep commits focused and descriptive.
- Match the existing commit style when creating commits.

jj-commit-default: auto

<!-- codex: ham-mcp begin -->
## Ham Radio MCP Guidance

- Use the configured ham radio MCP servers when they are relevant to the task.
- Prefer `qrz` and `lotw` for callsign, logbook, and award verification workflows.
- Prefer `pota`, `sota`, `solar`, and `wspr` for park, summit, propagation, and band-condition questions.
- Do not put credentials in repo files. Authentication should be handled through the local OS keychain via `qso-auth`.
<!-- codex: ham-mcp end -->

<!-- codex: pota-ri begin -->
## POTA RI Challenge Tooling

The `2026 Activate All RI POTA` project tracks activating every Rhode Island
POTA reference by December 31, 2026.

### Key files
- `src/data/pota/ri-tracker.json` — generated tracker state (completed/remaining,
  coordinates, activation history). Read this to answer questions about which
  parks are done and which remain.
- `src/data/pota/parks.json` — generated canonical POTA park-page data for
  `/radio/pota/US-1234/` pages.
- `data/pota/parks/cache/` — cached POTA park metadata used to render canonical
  park pages.
- `data/pota/ri/` — local caches (park list, profile, activation ledger) used to
  regenerate tracker data.

### Available scripts and tasks

| Task | Script | Purpose |
|------|--------|---------|
| `mise run pota:update [--full-backfill]` | `scripts/pota/update.mjs` | One-command refresh for POTA profile, RI tracker data, park metadata, and canonical park pages. Use `--full-backfill` to refresh RI park list and back-fill activation history too. |
| `mise run pota:ri:travel-times [-- --grid FN41fr]` | `scripts/pota/travel-times.mjs` | Estimate driving times from a home grid square to remaining parks. Uses OSRM routing (requires network); falls back to haversine × 1.4 / 80 km/h. |
| `mise run pota:ri:update-tracker` | `scripts/pota/ri-tracker.mjs` | Refresh parks, profile, and rebuild tracker data in one step. |
| `mise run pota:ri:update-parks` | `scripts/pota/ri-tracker.mjs` | Fetch the latest RI park list from POTA API. |
| `mise run pota:ri:update-profile` | `scripts/pota/ri-tracker.mjs` | Fetch N1RWJ profile and merge recent activations into the ledger. |
| `mise run pota:ri:build-tracker-data` | `scripts/pota/ri-tracker.mjs` | Rebuild `ri-tracker.json` from local caches without hitting the network. |
| `mise run pota:ri:backfill-activations` | `scripts/pota/ri-tracker.mjs` | Back-fill activation history for all RI references from the POTA API. |
| `mise run pota:park:ensure -- US-1234` | `scripts/pota/parks.mjs` | Ensure local cached metadata for one or more POTA references before linking a field note. |
| `mise run pota:park:backfill-known` | `scripts/pota/parks.mjs` | Ensure park metadata for all references found in field-note tags, the activation ledger, and RI tracker data. |
| `mise run pota:park:build-page-data` | `scripts/pota/parks.mjs` | Rebuild generated canonical park-page data from local caches. |

### Canonical park pages
- Use `/radio/pota/US-1234/` as the local canonical URL for POTA reference
  pages.
- Field notes should link park/reference mentions to the local canonical page,
  not directly to POTA.app. The canonical park page provides the external
  POTA.app link.
- Before publishing a field note for a new reference, run
  `mise run pota:park:ensure -- US-1234`, then run `mise run pota:update`.
- After a new activation, field note, or POTA profile change, run
  `mise run pota:update`. Use `mise run pota:update --full-backfill` when
  the RI park list or historical activation history also needs to be refreshed.
- Keep lowercased POTA reference tags such as `us-1234` in note frontmatter so
  field notes can attach to matching activation rows by date and reference.

### Park notes
- **US-0513 Block Island NWR** — requires a ferry from Point Judith (~1 hr each
  way); plan for a half-day minimum. Travel-time estimates for this reference
  are misleading (straight-line only).
- **US-10545 Hillsdale Preserve** — also an Historical and Archaeological
  Preserve; antennas staked into the ground are not permitted here.

### Live data
- Use the `pota` MCP tool (`pota_spots` with `location=US-RI`) to check for
  current activators before heading out.
- Use `solar_conditions` and `solar_band_outlook` to assess HF conditions for
  the day before planning a park visit.
<!-- codex: pota-ri end -->

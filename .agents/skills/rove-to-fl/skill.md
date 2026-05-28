---
name: rove-to-fl
description: 2026 RI→FL road trip planning — read itinerary state, find park clusters per corridor segment, update booking status. Use when the user wants to plan driving legs, find parks to activate, or update the trip itinerary.
---

# 2026 Rove to FL

Goal: drive the I-95 corridor from Providence, RI to Singer Island / Riviera Beach, FL, activating POTA parks along the way. Arrive by **June 26, 2026** for Field Day (June 27–28).

## Constraints

| Constraint | Value |
|-----------|-------|
| Work window | 13:00–17:00 local (no activating during this window) |
| Max consecutive camping nights | 2 |
| Arrive FL by | 2026-06-26 |
| Field Day | 2026-06-27 at Singer Island / Riviera Beach |

## Step 1 — Read the itinerary

`data/pota/rove-to-fl/itinerary.json` is the hand-editable source of truth for the trip plan. It has:
- `days[]` — one entry per travel day with `date`, `states`, `overnight` (type + booking status), `parkTargets`, `notes`, `approxDriveMiles`
- `constraints` — the trip rules above

`overnight.type` is one of `camp | hotel | home | tbd`.
`booking.status` is one of `planned | booked | n/a`.

```bash
node -e "
  const d = JSON.parse(require('fs').readFileSync('data/pota/rove-to-fl/itinerary.json','utf8'));
  console.log('Days planned:', d.days.length);
  d.days.forEach((day, i) => {
    const o = day.overnight;
    console.log(\`Day \${i+1} \${day.date}: \${o.type} @ \${o.name} [\${o.booking.status}]\`);
    if (day.parkTargets.length) console.log('  Parks:', day.parkTargets.join(', '));
  });
"
```

## Step 2 — Check corridor park data

`src/data/pota/rove-to-fl.json` has 1,000+ POTA parks within ~75 km of I-95 across 10 states (CT → FL). Filter by state to see what's available for a given leg:

```bash
node -e "
  const d = JSON.parse(require('fs').readFileSync('src/data/pota/rove-to-fl.json','utf8'));
  const state = 'US-NC'; // change as needed
  const parks = d.parks.filter(p => p.state === state);
  console.log(state, parks.length, 'corridor parks');
  parks.sort((a,b) => b.activations - a.activations)
       .slice(0,20)
       .forEach(p => console.log(p.reference, p.activations, 'acts', p.name));
"
```

Route summary is in `d.route` — each entry has `code`, `name`, `total`, `corridorCount`.

## Step 3 — Find clusters per leg

**TODO**: `scripts/pota/rove-clusters.mjs` currently reads `ri-tracker.json` (RI only). It needs a `--source` or `--state` flag to accept corridor parks from `rove-to-fl.json` for per-leg cluster analysis. Until that's built, use the node snippet above to get a ranked list and pick targets manually.

When extending rove-clusters, the entry point to adapt is the park-loading section at the top of `buildMatrix()`. Pass `--state US-NC` (or a list of refs) and load from `src/data/pota/rove-to-fl.json` instead of `ri-tracker.json`.

## Step 4 — Update the itinerary

Edit `data/pota/rove-to-fl/itinerary.json` directly to:
- Add or update `days[]` entries
- Fill `parkTargets` with chosen POTA refs
- Update `overnight.booking.status` from `planned` → `booked` and add `confirmation`
- Adjust `approxDriveMiles` as the route gets firmer

The project page at `src/pages/projects/2026-06-rove-to-fl.astro` renders the itinerary automatically and flags any consecutive-camping violations.

## Step 5 — Refresh corridor park data (if stale)

```bash
mise run pota:rove-to-fl:update-tracker   # fetch all states + rebuild JSON
mise run pota:rove-to-fl:build-tracker-data  # rebuild from cache only
```

## Key files

| Path | Purpose |
|------|---------|
| `data/pota/rove-to-fl/itinerary.json` | Hand-editable trip plan — source of truth |
| `src/data/pota/rove-to-fl.json` | Generated corridor park data (1,000+ parks) |
| `data/pota/rove-to-fl/cache/` | Raw POTA API caches per state |
| `scripts/pota/rove-to-fl-tracker.mjs` | Corridor park data pipeline |
| `scripts/pota/rove-clusters.mjs` | Rove cluster finder (RI-focused today; extend for corridor) |
| `scripts/pota/lib/routing.mjs` | Shared routing utilities (grid→latlon, haversine, OSRM) |
| `src/pages/projects/2026-06-rove-to-fl.astro` | Public project page |

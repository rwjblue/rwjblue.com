---
name: cloudflare-analytics-report
description: Generate a concise readership and site-health report for rwjblue.com from locally authenticated Cloudflare APIs. Use when the user asks whether the site is being read, requests traffic or visitor analytics, wants popular content or referrer summaries, or asks whether 404s, errors, performance, cache behavior, or scanner traffic indicate a real problem.
---

# Cloudflare Analytics Report

Use the bundled script to query Cloudflare through the repository's local
Wrangler OAuth session. Keep the report focused on whether people are reading
the site and whether errors need attention.

## Run the Report

From the repository root, run:

```bash
mise exec -- node .agents/skills/cloudflare-analytics-report/scripts/report.mjs
```

The default period is the last 30 complete UTC days compared with the preceding
30 days. Use `--days N` for another period, `--json` for structured output, or
`--no-diagnostics` to skip recent path-level 404 analysis.

If Wrangler is not authenticated, ask the user to run `mise exec -- npx
wrangler login`. Do not open the Cloudflare dashboard unless the user asks for
the browser or the local API workflow cannot provide the required data.

## Interpret the Results

Treat Web Analytics beacon data as the readership signal:

- Lead with visits, pageviews, and pageviews per visit.
- Use the confidence intervals to decide whether a period-over-period change is
  meaningful. When intervals overlap, describe the traffic as roughly flat
  within sampling uncertainty.
- Aggregate `rwjblue.com` and `n1rwj.com`; they serve the same site.
- Mention the strongest content, external referrers, device split, and
  geography only when they clarify who is reading or what is resonating.
- Treat browser and operating-system details as diagnostic information, not
  default readership reporting.

Treat edge analytics as operational context:

- Do not present edge HTML responses as human pageviews.
- Do not sum daily unique-IP estimates into a monthly visitor count.
- Use total requests, bandwidth, cached-byte share, 5xx responses, threats, and
  status distribution to explain load or anomalies.
- Expect automated probes to inflate requests and 404s.

## Review 404s

The script hides common WordPress, PHP, secret-file, and administration probes
from its potential-issue list. Before calling a remaining path broken:

1. Check whether the path is a normal browser probe such as `/favicon.ico` or
   an Apple touch icon.
2. Inspect `public/`, `src/pages/`, Astro configuration, redirects, and a
   current `dist/` build when available.
3. Distinguish discovery endpoints such as `/sitemap.xml`, `/robots.txt`, and
   feeds from reader-facing pages.
4. Report scanner-only 404 volume as noise. Escalate repeated legitimate paths,
   missing site assets, or any meaningful 5xx responses.

Path-level edge data on the free plan is recent and limited to one-day query
windows. Treat the seven-day diagnostic sample as supporting evidence, not a
complete monthly ranking.

## Reporting Style

Answer the two primary questions first:

1. Is the site being read?
2. Is anything broken or worth attention?

Keep the normal report compact. Include detailed scanner paths, full status
tables, content types, and raw API data only when the user asks or an anomaly
requires them. State the exact reporting dates and note when sampled data is
rounded or uncertain.

## Security

Obtain credentials only through `wrangler auth token --json`. Keep the token in
memory, never print it, and never write it to the repository or a temporary
file. All report operations must remain read-only.

#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const CONFIG = {
  accountId: "478f5e15ae2afa01364d19f42a3e06f2",
  hosts: ["rwjblue.com", "n1rwj.com"],
  zones: ["rwjblue.com", "n1rwj.com"],
};

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const API_BASE = "https://api.cloudflare.com/client/v4";

function usage() {
  return `Usage: report.mjs [--days N] [--json] [--no-diagnostics]

Generate a Cloudflare readership and site-health report.

Options:
  --days N          Complete UTC days to report (default: 30)
  --json            Emit structured JSON instead of Markdown
  --no-diagnostics  Skip recent path-level 404 analysis
  -h, --help        Show this help`;
}

function parseArgs(argv) {
  const options = { days: 30, json: false, diagnostics: true };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--days") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isInteger(value) || value < 1 || value > 90) {
        throw new Error("--days must be an integer between 1 and 90");
      }
      options.days = value;
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--no-diagnostics") {
      options.diagnostics = false;
    } else if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function reportingPeriods(days) {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const currentEnd = addDays(today, -1);
  const currentStart = addDays(currentEnd, -(days - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    current: { start: formatDate(currentStart), end: formatDate(currentEnd) },
    previous: { start: formatDate(previousStart), end: formatDate(previousEnd) },
  };
}

function wranglerToken() {
  try {
    const stdout = execFileSync(
      "npx",
      ["--no-install", "wrangler", "auth", "token", "--json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const parsed = JSON.parse(stdout);
    if (typeof parsed.token !== "string" || parsed.token.length === 0) {
      throw new Error("Wrangler returned no OAuth token");
    }
    return parsed.token;
  } catch (error) {
    const detail =
      error instanceof Error && "stderr" in error
        ? String(error.stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    throw new Error(
      `Unable to obtain the local Wrangler token. Run "mise exec -- npx wrangler login" first.${detail ? `\n${detail}` : ""}`,
    );
  }
}

async function fetchJson(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `Cloudflare API request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

async function graphql(token, query, variables) {
  const payload = await fetchJson(GRAPHQL_URL, token, {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(
      payload.errors.map((error) => error.message ?? String(error)).join("; "),
    );
  }
  return payload.data;
}

async function discoverZones(token) {
  const url = new URL(`${API_BASE}/zones`);
  url.searchParams.set("per_page", "50");
  const payload = await fetchJson(url, token);
  if (!payload.success) {
    throw new Error(`Unable to list Cloudflare zones: ${JSON.stringify(payload.errors)}`);
  }

  const byName = new Map(payload.result.map((zone) => [zone.name, zone]));
  return CONFIG.zones.map((name) => {
    const zone = byName.get(name);
    if (!zone) {
      throw new Error(`Cloudflare zone not found: ${name}`);
    }
    return { id: zone.id, name: zone.name };
  });
}

function hostFilter() {
  return `OR: [${CONFIG.hosts
    .map((host) => `{ requestHost: ${JSON.stringify(host)} }`)
    .join(", ")}]`;
}

async function loadReadership(token, periods) {
  const hosts = hostFilter();
  const query = `
    query Readership(
      $accountTag: string
      $currentStart: Date
      $currentEnd: Date
      $previousStart: Date
      $previousEnd: Date
    ) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          current: rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            avg { sampleInterval }
            sum { visits }
            confidence(level: 0.95) {
              count { estimate lower upper sampleSize }
              sum { visits { estimate lower upper sampleSize } }
            }
          }
          previous: rumPageloadEventsAdaptiveGroups(
            limit: 1
            filter: {
              bot: 0
              date_geq: $previousStart
              date_leq: $previousEnd
              ${hosts}
            }
          ) {
            count
            avg { sampleInterval }
            sum { visits }
            confidence(level: 0.95) {
              count { estimate lower upper sampleSize }
              sum { visits { estimate lower upper sampleSize } }
            }
          }
          paths: rumPageloadEventsAdaptiveGroups(
            limit: 15
            orderBy: [count_DESC]
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            sum { visits }
            dimensions { requestPath }
          }
          referrers: rumPageloadEventsAdaptiveGroups(
            limit: 30
            orderBy: [count_DESC]
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            sum { visits }
            dimensions { refererHost }
          }
          countries: rumPageloadEventsAdaptiveGroups(
            limit: 10
            orderBy: [count_DESC]
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            dimensions { countryName }
          }
          devices: rumPageloadEventsAdaptiveGroups(
            limit: 10
            orderBy: [count_DESC]
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            dimensions { deviceType }
          }
          vitals: rumWebVitalsEventsAdaptiveGroups(
            limit: 1
            filter: {
              bot: 0
              date_geq: $currentStart
              date_leq: $currentEnd
              ${hosts}
            }
          ) {
            count
            avg { sampleInterval }
            quantiles {
              largestContentfulPaintP75
              interactionToNextPaintP75
              cumulativeLayoutShiftP75
              timeToFirstByteP75
            }
            sum {
              lcpGood
              lcpNeedsImprovement
              lcpPoor
              inpGood
              inpNeedsImprovement
              inpPoor
              clsGood
              clsNeedsImprovement
              clsPoor
              ttfbGood
              ttfbNeedsImprovement
              ttfbPoor
            }
          }
        }
      }
    }
  `;

  const data = await graphql(token, query, {
    accountTag: CONFIG.accountId,
    currentStart: periods.current.start,
    currentEnd: periods.current.end,
    previousStart: periods.previous.start,
    previousEnd: periods.previous.end,
  });
  const account = data.viewer.accounts[0];
  if (!account) {
    throw new Error(`Cloudflare account not found: ${CONFIG.accountId}`);
  }
  return account;
}

async function loadEdgeDaily(token, zone, periods) {
  const query = `
    query EdgeDaily($zoneTag: string, $start: Date, $end: Date) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            orderBy: [date_ASC]
            filter: { date_geq: $start, date_leq: $end }
          ) {
            dimensions { date }
            sum {
              requests
              bytes
              cachedBytes
              threats
              responseStatusMap {
                edgeResponseStatus
                requests
              }
            }
          }
        }
      }
    }
  `;
  const data = await graphql(token, query, {
    zoneTag: zone.id,
    start: periods.previous.start,
    end: periods.current.end,
  });
  return data.viewer.zones[0]?.httpRequests1dGroups ?? [];
}

function emptyEdgeSummary() {
  return {
    requests: 0,
    bytes: 0,
    cachedBytes: 0,
    threats: 0,
    statuses: {},
  };
}

function addEdgeRows(summary, rows, start, end) {
  for (const row of rows) {
    const date = row.dimensions.date;
    if (date < start || date > end) continue;
    summary.requests += row.sum.requests ?? 0;
    summary.bytes += row.sum.bytes ?? 0;
    summary.cachedBytes += row.sum.cachedBytes ?? 0;
    summary.threats += row.sum.threats ?? 0;
    for (const status of row.sum.responseStatusMap ?? []) {
      const key = String(status.edgeResponseStatus);
      summary.statuses[key] = (summary.statuses[key] ?? 0) + status.requests;
    }
  }
}

function statusRange(statuses, lower, upper) {
  return Object.entries(statuses).reduce((total, [status, count]) => {
    const value = Number.parseInt(status, 10);
    return value >= lower && value <= upper ? total + count : total;
  }, 0);
}

async function loadEdgeSummary(token, zones, periods) {
  const rowsByZone = await Promise.all(
    zones.map(async (zone) => ({
      zone,
      rows: await loadEdgeDaily(token, zone, periods),
    })),
  );

  const current = emptyEdgeSummary();
  const previous = emptyEdgeSummary();
  for (const { rows } of rowsByZone) {
    addEdgeRows(current, rows, periods.current.start, periods.current.end);
    addEdgeRows(previous, rows, periods.previous.start, periods.previous.end);
  }

  for (const summary of [current, previous]) {
    summary.notFound = summary.statuses["404"] ?? 0;
    summary.serverErrors = statusRange(summary.statuses, 500, 599);
    summary.redirects = statusRange(summary.statuses, 300, 399);
  }

  return { current, previous };
}

function datesBetween(start, end) {
  const dates = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(formatDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

async function load404Day(token, zone, date) {
  const query = `
    query NotFoundPaths($zoneTag: string, $date: Date) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          paths: httpRequestsAdaptiveGroups(
            limit: 50
            orderBy: [count_DESC]
            filter: {
              date: $date
              requestSource: "eyeball"
              edgeResponseStatus: 404
            }
          ) {
            count
            avg { sampleInterval }
            dimensions {
              clientRequestHTTPHost
              clientRequestPath
            }
          }
        }
      }
    }
  `;
  const data = await graphql(token, query, { zoneTag: zone.id, date });
  return data.viewer.zones[0]?.paths ?? [];
}

async function inBatches(items, batchSize, callback) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(callback))));
  }
  return results;
}

const SCANNER_PATTERNS = [
  /^\/\.?(?:env|git)(?:[./]|$)/i,
  /^\/\.aws\/credentials/i,
  /(?:^|\/)wp-(?:admin|content|includes|login)/i,
  /(?:^|\/)(?:wordpress|phpmyadmin|pgadmin|jenkins)(?:\/|$)/i,
  /(?:^|\/)(?:phpunit|adminer|wso|shell)(?:[./]|$)/i,
  /\.(?:php|asp|aspx|jsp)(?:\/|$)/i,
  /^\/(?:api\/(?:reset|image)|actuator|cgi-bin)(?:\/|$)/i,
  /^\/(?:docker-compose\.ya?ml|yarn-error\.log|phpunit\.xml)$/i,
  /^\/(?:config\.(?:json|php|js)|web\.config)$/i,
  /^\/(?:server|team|chat\/?|faq\/?|support|profile|url|autocomplete|ip|setup\/?)$/i,
];

const EXPECTED_BROWSER_PATHS = [
  /^\/favicon\.ico$/i,
  /^\/apple-touch-icon(?:-precomposed)?\.png$/i,
];

function classify404(path) {
  if (SCANNER_PATTERNS.some((pattern) => pattern.test(path))) return "scanner";
  if (EXPECTED_BROWSER_PATHS.some((pattern) => pattern.test(path))) return "browser";
  if (/^\/(?:sitemap(?:-index)?\.xml|robots\.txt|rss\/?|feed\/?)$/i.test(path)) {
    return "discovery";
  }
  if (
    /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|ico|json|xml|txt)$/i.test(
      path,
    )
  ) {
    return "asset";
  }
  return "page";
}

async function load404Diagnostics(token, zones, currentPeriod) {
  const allDates = datesBetween(currentPeriod.start, currentPeriod.end);
  const dates = allDates.slice(-7);
  const jobs = zones.flatMap((zone) => dates.map((date) => ({ zone, date })));
  const errors = [];
  const results = await inBatches(jobs, 4, async ({ zone, date }) => {
    try {
      return { zone, date, rows: await load404Day(token, zone, date) };
    } catch (error) {
      errors.push({
        zone: zone.name,
        date,
        message: error instanceof Error ? error.message : String(error),
      });
      return { zone, date, rows: [] };
    }
  });

  const aggregated = new Map();
  for (const { zone, rows } of results) {
    for (const row of rows) {
      const host = row.dimensions.clientRequestHTTPHost || zone.name;
      const path = row.dimensions.clientRequestPath || "/";
      const key = `${host}\u0000${path}`;
      const existing = aggregated.get(key) ?? {
        host,
        path,
        count: 0,
        sampleSize: 0,
        category: classify404(path),
      };
      existing.count += row.count ?? 0;
      existing.sampleSize +=
        (row.count ?? 0) / Math.max(1, row.avg?.sampleInterval ?? 1);
      aggregated.set(key, existing);
    }
  }

  const sorted = [...aggregated.values()].sort((left, right) => right.count - left.count);
  return {
    dates: dates.length > 0 ? { start: dates[0], end: dates.at(-1) } : null,
    potentialIssues: sorted
      .filter(
        (row) =>
          row.sampleSize >= 2 &&
          row.count >= 10 &&
          (row.category === "page" ||
            row.category === "asset" ||
            row.category === "discovery"),
      )
      .slice(0, 10),
    browserProbes: sorted.filter((row) => row.category === "browser").slice(0, 5),
    scannerRequestEstimate: sorted
      .filter((row) => row.category === "scanner")
      .reduce((total, row) => total + row.count, 0),
    errors,
  };
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function confidenceValue(row, metric) {
  if (!row) return null;
  if (metric === "pageviews") return row.confidence?.count ?? null;
  return row.confidence?.sum?.visits ?? null;
}

function metricValue(row, metric) {
  if (!row) return 0;
  return metric === "pageviews" ? row.count ?? 0 : row.sum?.visits ?? 0;
}

function confidenceOverlaps(left, right) {
  if (!left || !right) return true;
  return left.lower <= right.upper && right.lower <= left.upper;
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function trendSummary(currentRow, previousRow) {
  const metrics = ["pageviews", "visits"];
  const descriptions = metrics.map((metric) => {
    const current = metricValue(currentRow, metric);
    const previous = metricValue(previousRow, metric);
    const change = percentChange(current, previous);
    const overlap = confidenceOverlaps(
      confidenceValue(currentRow, metric),
      confidenceValue(previousRow, metric),
    );
    return { metric, current, previous, change, overlap };
  });
  const allOverlap = descriptions.every((metric) => metric.overlap);
  return {
    classification: allOverlap ? "roughly flat within sampling uncertainty" : "changed",
    metrics: descriptions,
  };
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function summarizeVitals(row) {
  if (!row) return null;
  const quantiles = row.quantiles ?? {};
  const sums = row.sum ?? {};
  const quality = {};
  for (const [name, prefix] of [
    ["lcp", "lcp"],
    ["inp", "inp"],
    ["cls", "cls"],
    ["ttfb", "ttfb"],
  ]) {
    const good = sums[`${prefix}Good`] ?? 0;
    const needsImprovement = sums[`${prefix}NeedsImprovement`] ?? 0;
    const poor = sums[`${prefix}Poor`] ?? 0;
    quality[name] = {
      good,
      needsImprovement,
      poor,
      total: good + needsImprovement + poor,
      goodPercent: round(ratio(good, good + needsImprovement + poor) * 100, 1),
    };
  }
  return {
    sampleInterval: row.avg?.sampleInterval ?? 1,
    p75: {
      lcpMs: round((quantiles.largestContentfulPaintP75 ?? 0) / 1000),
      inpMs: round((quantiles.interactionToNextPaintP75 ?? 0) / 1000),
      cls: round(quantiles.cumulativeLayoutShiftP75 ?? 0, 3),
      ttfbMs: round((quantiles.timeToFirstByteP75 ?? 0) / 1000),
    },
    quality,
  };
}

function buildReport(periods, readership, edge, diagnostics) {
  const currentRow = firstRow(readership.current);
  const previousRow = firstRow(readership.previous);
  const pageviews = metricValue(currentRow, "pageviews");
  const visits = metricValue(currentRow, "visits");
  const trend = trendSummary(currentRow, previousRow);
  const direct = (readership.referrers ?? []).find(
    (row) => (row.dimensions.refererHost ?? "") === "",
  );
  const externalReferrers = (readership.referrers ?? [])
    .filter((row) => {
      const host = row.dimensions.refererHost ?? "";
      return host !== "" && !CONFIG.hosts.includes(host);
    })
    .slice(0, 5)
    .map((row) => ({
      host: row.dimensions.refererHost,
      pageviews: row.count,
      visits: row.sum?.visits ?? 0,
    }));

  return {
    generatedAt: new Date().toISOString(),
    periods,
    readership: {
      verdict: visits > 0 ? "yes" : "no measured visits",
      pageviews,
      visits,
      pageviewsPerVisit: round(ratio(pageviews, visits), 2),
      pageviewsPerDay: round(pageviews / Math.max(1, datesBetween(periods.current.start, periods.current.end).length), 1),
      visitsPerDay: round(visits / Math.max(1, datesBetween(periods.current.start, periods.current.end).length), 1),
      sampling: {
        interval: currentRow?.avg?.sampleInterval ?? 1,
        pageviews95: confidenceValue(currentRow, "pageviews"),
        visits95: confidenceValue(currentRow, "visits"),
      },
      trend,
    },
    content: (readership.paths ?? []).slice(0, 8).map((row) => ({
      path: row.dimensions.requestPath || "/",
      pageviews: row.count,
      visits: row.sum?.visits ?? 0,
    })),
    acquisition: {
      directOrUnavailablePageviews: direct?.count ?? 0,
      directOrUnavailableShare: round(ratio(direct?.count ?? 0, pageviews) * 100, 1),
      externalReferrers,
    },
    audience: {
      devices: (readership.devices ?? []).map((row) => ({
        name: row.dimensions.deviceType || "unknown",
        pageviews: row.count,
        share: round(ratio(row.count, pageviews) * 100, 1),
      })),
      countries: (readership.countries ?? []).slice(0, 5).map((row) => ({
        name: row.dimensions.countryName || "unknown",
        pageviews: row.count,
        share: round(ratio(row.count, pageviews) * 100, 1),
      })),
    },
    performance: summarizeVitals(firstRow(readership.vitals)),
    health: {
      requests: edge.current.requests,
      requestChangePercent: round(
        percentChange(edge.current.requests, edge.previous.requests) ?? 0,
        1,
      ),
      bytes: edge.current.bytes,
      cachedByteShare: round(ratio(edge.current.cachedBytes, edge.current.bytes) * 100, 1),
      notFound: edge.current.notFound,
      notFoundShare: round(ratio(edge.current.notFound, edge.current.requests) * 100, 1),
      serverErrors: edge.current.serverErrors,
      redirects: edge.current.redirects,
      threats: edge.current.threats,
      diagnostics,
    },
  };
}

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value) {
  return numberFormat.format(Math.round(value));
}

function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = -1;
  do {
    value /= 1000;
    index += 1;
  } while (value >= 1000 && index < units.length - 1);
  return `${round(value, value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function signedPercent(value) {
  return `${value >= 0 ? "+" : ""}${round(value, 1)}%`;
}

function renderMarkdown(report) {
  const lines = [];
  const { readership, content, acquisition, audience, performance, health } = report;
  lines.push("# Cloudflare analytics report", "");
  lines.push(
    `Period: ${report.periods.current.start} through ${report.periods.current.end} (complete UTC days)`,
    "",
  );
  lines.push("## Is the site being read?", "");
  if (readership.verdict === "yes") {
    lines.push(
      `**Yes.** Cloudflare estimates **${formatNumber(readership.visits)} visits** and **${formatNumber(readership.pageviews)} pageviews**—about ${readership.visitsPerDay} visits per day and ${readership.pageviewsPerVisit} pageviews per visit.`,
      "",
    );
  } else {
    lines.push("Cloudflare measured no visits during this period.", "");
  }

  const trendParts = readership.trend.metrics.map((metric) => {
    const label = metric.metric === "pageviews" ? "pageviews" : "visits";
    return metric.change === null
      ? `${label} had no prior baseline`
      : `${label} ${signedPercent(metric.change)}`;
  });
  lines.push(
    `Compared with ${report.periods.previous.start} through ${report.periods.previous.end}: ${trendParts.join(", ")}. Overall, traffic is **${readership.trend.classification}**.`,
    "",
  );

  if (content.length > 0) {
    lines.push("## What people read", "", "| Page | Views | Visits |", "|---|---:|---:|");
    for (const row of content.slice(0, 6)) {
      lines.push(
        `| \`${row.path.replaceAll("|", "\\|")}\` | ${formatNumber(row.pageviews)} | ${formatNumber(row.visits)} |`,
      );
    }
    lines.push("");
  }

  const external = acquisition.externalReferrers;
  const deviceText = audience.devices
    .slice(0, 3)
    .map((row) => `${row.name} ${row.share}%`)
    .join(", ");
  const countryText = audience.countries
    .slice(0, 3)
    .map((row) => `${row.name} ${row.share}%`)
    .join(", ");
  lines.push("## Audience and discovery", "");
  lines.push(
    `${acquisition.directOrUnavailableShare}% of pageviews had no external referrer. Device mix: ${deviceText || "unavailable"}. Leading countries: ${countryText || "unavailable"}.`,
    "",
  );
  if (external.length > 0) {
    lines.push(
      `External referrers: ${external
        .map((row) => `${row.host} (${formatNumber(row.visits)} visits)`)
        .join(", ")}.`,
      "",
    );
  }

  lines.push("## Site health", "");
  const majorServerErrorThreshold = Math.max(5, health.requests * 0.001);
  if (health.serverErrors === 0) {
    lines.push("- No 5xx responses were recorded.");
  } else if (health.serverErrors < majorServerErrorThreshold) {
    lines.push(
      `- ${formatNumber(health.serverErrors)} isolated 5xx response${health.serverErrors === 1 ? " was" : "s were"} recorded; this is not a meaningful error pattern.`,
    );
  } else {
    lines.push(`- **Attention:** ${formatNumber(health.serverErrors)} 5xx responses were recorded.`);
  }
  lines.push(
    `- ${formatNumber(health.notFound)} requests returned 404 (${health.notFoundShare}% of edge requests).`,
  );
  const diagnostic = health.diagnostics;
  if (diagnostic) {
    if (diagnostic.potentialIssues.length > 0) {
      const candidates = diagnostic.potentialIssues
        .slice(0, 5)
        .map(
          (row) =>
            `\`${row.host}${row.path}\` (~${formatNumber(row.count)}, ${row.category})`,
        )
        .join(", ");
      lines.push(`- Potential non-scanner 404s to verify: ${candidates}.`);
    } else {
      lines.push("- Recent path-level 404s appear to be scanner noise or routine browser probes.");
    }
    if (diagnostic.scannerRequestEstimate > 0) {
      lines.push(
        `- The recent detailed sample identified at least ~${formatNumber(diagnostic.scannerRequestEstimate)} obvious scanner probes.`,
      );
    }
  }
  lines.push(
    `- Edge volume was ${formatNumber(health.requests)} requests (${signedPercent(health.requestChangePercent)}), ${formatBytes(health.bytes)} transferred, with ${health.cachedByteShare}% of bytes served from cache.`,
    `- Cloudflare recorded ${formatNumber(health.threats)} threat events.`,
    "",
  );

  if (performance) {
    const qualityValues = Object.values(performance.quality).filter(
      (metric) => metric.total > 0,
    );
    const good =
      qualityValues.length > 0 &&
      qualityValues.every((metric) => metric.goodPercent >= 90);
    lines.push("## Performance", "");
    lines.push(
      `Core Web Vitals look **${good ? "good" : "mixed"}**: P75 LCP ${performance.p75.lcpMs} ms, INP ${performance.p75.inpMs} ms, CLS ${performance.p75.cls}, and TTFB ${performance.p75.ttfbMs} ms.`,
      "",
    );
  }

  if (readership.sampling.interval > 1) {
    lines.push(
      `_Cloudflare sampled older Web Analytics data at roughly 1 in ${round(readership.sampling.interval, 1)} events and extrapolated the estimates. Treat small changes and path counts as directional._`,
      "",
    );
  }
  return `${lines.join("\n").trim()}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const periods = reportingPeriods(options.days);
  const token = wranglerToken();
  const zones = await discoverZones(token);
  const [readership, edge] = await Promise.all([
    loadReadership(token, periods),
    loadEdgeSummary(token, zones, periods),
  ]);
  const diagnostics = options.diagnostics
    ? await load404Diagnostics(token, zones, periods.current)
    : null;
  const report = buildReport(periods, readership, edge, diagnostics);
  process.stdout.write(
    options.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report),
  );
}

main().catch((error) => {
  process.stderr.write(
    `cloudflare-analytics-report: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

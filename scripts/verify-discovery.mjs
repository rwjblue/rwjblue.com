import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sitemapIndex = read("dist/sitemap-index.xml");
const sitemap = read("dist/sitemap-0.xml");
const robots = read("dist/robots.txt");
const note = read(
  "dist/notes/2026-07-23-learning-to-read-the-bands-with-ncdxf-beacons/index.html",
);

assert.match(sitemapIndex, /https:\/\/rwjblue\.com\/sitemap-0\.xml/);
assert.match(robots, /Sitemap: https:\/\/rwjblue\.com\/sitemap-index\.xml/);
assert.doesNotMatch(sitemap, /share-image|share\.png|\/search\//);
assert.doesNotMatch(sitemap, /2026-07-21-reliance-ocfd/);
assert.doesNotMatch(sitemap, /2026-07-28-operating-w1aw/);

const jsonLd = [...note.matchAll(
  /<script type="application\/ld\+json">(.*?)<\/script>/gs,
)].map((match) => JSON.parse(match[1]));
const flattened = jsonLd.flat();
const article = flattened.find((entry) => entry["@type"] === "Article");
const breadcrumbs = flattened.find(
  (entry) => entry["@type"] === "BreadcrumbList",
);

assert.equal(article?.headline, "Learning to Read the Bands with NCDXF Beacons");
assert.equal(article?.author?.["@id"], "https://rwjblue.com/about/#person");
assert.equal(breadcrumbs?.itemListElement?.length, 3);

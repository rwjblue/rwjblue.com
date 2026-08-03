import assert from "node:assert/strict";
import { test } from "node:test";
import {
  articleStructuredData,
  breadcrumbStructuredData,
} from "../src/lib/structured-data.ts";
import { createSitemapFilter } from "../scripts/sitemap-filter.mjs";

test("sitemap filter excludes private notes and utility routes", () => {
  const filter = createSitemapFilter();

  assert.equal(filter("https://rwjblue.com/notes/public-workshop/"), true);
  assert.equal(
    filter(
      "https://rwjblue.com/notes/2026-07-21-reliance-ocfd-replacement-wire-testing/",
    ),
    false,
  );
  assert.equal(filter("https://rwjblue.com/search/"), false);
  assert.equal(
    filter("https://rwjblue.com/publication-schedule.json"),
    false,
  );
  assert.equal(
    filter("https://rwjblue.com/notes/public-workshop/share-image/"),
    false,
  );
});

test("structured data uses canonical URLs and deterministic breadcrumb positions", () => {
  const breadcrumbs = breadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: "Notes", path: "/notes/" },
  ]);
  const article = articleStructuredData({
    title: "Example",
    description: "A note.",
    path: "/notes/example/",
    published: new Date("2026-07-25T00:00:00Z"),
  });

  assert.deepEqual(
    breadcrumbs.itemListElement.map((item) => item.position),
    [1, 2],
  );
  assert.equal(
    breadcrumbs.itemListElement[1].item,
    "https://rwjblue.com/notes/",
  );
  assert.equal(article.url, "https://rwjblue.com/notes/example/");
  assert.equal(article["@type"], "Article");
});

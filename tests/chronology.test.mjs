import assert from "node:assert/strict";
import { test } from "node:test";

import { compareChronologicalItemsNewestFirst } from "../src/lib/chronology.ts";

const item = (id, date, order, slug = "series") => ({
  id,
  date: new Date(`${date}T00:00:00Z`),
  series: order === undefined ? undefined : { slug, order },
});

test("same-day entries from one series put the latest part first", () => {
  const entries = [
    item("part-one", "2026-07-26", 1),
    item("part-three", "2026-07-26", 3),
    item("part-two", "2026-07-26", 2),
  ].sort(compareChronologicalItemsNewestFirst);

  assert.deepEqual(entries.map(({ id }) => id), [
    "part-three",
    "part-two",
    "part-one",
  ]);
});

test("date remains the primary chronological sort", () => {
  const entries = [
    item("later-series-part", "2026-07-25", 2),
    item("newer-date", "2026-07-26", 1),
  ].sort(compareChronologicalItemsNewestFirst);

  assert.deepEqual(entries.map(({ id }) => id), [
    "newer-date",
    "later-series-part",
  ]);
});

test("unrelated same-day entries use a deterministic descending key", () => {
  const entries = [
    item("alpha", "2026-07-26"),
    item("bravo", "2026-07-26"),
  ].sort(compareChronologicalItemsNewestFirst);

  assert.deepEqual(entries.map(({ id }) => id), ["bravo", "alpha"]);
});

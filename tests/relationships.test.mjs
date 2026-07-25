import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectSeries,
  selectRelatedItems,
  seriesContextForNote,
} from "../src/lib/relationships.ts";

const note = (id, order, visibility = "public") => ({
  id,
  data: {
    title: id,
    date: new Date(`2026-06-${String(order).padStart(2, "0")}T00:00:00Z`),
    summary: id,
    visibility,
    tags: ["radio"],
    series: { slug: "trip", title: "Trip", order },
  },
});

test("series ordering and navigation are deterministic", () => {
  const entries = [note("three", 3), note("one", 1), note("two", 2)];
  const series = collectSeries(entries);
  const context = seriesContextForNote(entries[2], series);

  assert.deepEqual(series[0].entries.map((entry) => entry.id), [
    "one",
    "two",
    "three",
  ]);
  assert.equal(context.previous.id, "one");
  assert.equal(context.next.id, "three");
});

test("series validation rejects conflicting titles and duplicate order", () => {
  assert.throws(
    () => collectSeries([note("one", 1), note("duplicate", 1)]),
    /order 1/,
  );
  const conflict = note("two", 2);
  conflict.data.series.title = "Other";
  assert.throws(() => collectSeries([note("one", 1), conflict]), /conflicting/);
});

test("series collection excludes draft and unlisted entries", () => {
  const series = collectSeries([
    note("public", 1),
    note("unlisted", 2, "unlisted"),
    note("draft", 3, "draft"),
  ]);
  assert.deepEqual(series[0].entries.map((entry) => entry.id), ["public"]);
});

test("related items exclude current and rank shared tags stably", () => {
  const current = {
    type: "note",
    href: "/notes/current/",
    tags: ["radio", "pota"],
  };
  const items = [
    {
      ...current,
      label: "Note",
      date: new Date("2026-01-01"),
      title: "Current",
      summary: "",
    },
    {
      type: "project",
      label: "Project",
      href: "/projects/pota/",
      tags: ["radio", "pota"],
      date: new Date("2026-01-01"),
      title: "POTA project",
      summary: "",
    },
    {
      type: "note",
      label: "Note",
      href: "/notes/radio/",
      tags: ["radio"],
      date: new Date("2026-07-01"),
      title: "Radio note",
      summary: "",
    },
  ];

  assert.deepEqual(
    selectRelatedItems(current, items).map((item) => item.href),
    ["/projects/pota/", "/notes/radio/"],
  );
});

test("related items include the other public content type when available", () => {
  const current = {
    type: "note",
    href: "/notes/current/",
    tags: ["radio"],
  };
  const notes = Array.from({ length: 5 }, (_, index) => ({
    type: "note",
    label: "Note",
    href: `/notes/${index}/`,
    tags: ["radio"],
    date: new Date(`2026-07-${20 - index}`),
    title: `Note ${index}`,
    summary: "",
  }));
  const project = {
    type: "project",
    label: "Project",
    href: "/projects/radio/",
    tags: ["radio"],
    date: new Date("2026-01-01"),
    title: "Radio project",
    summary: "",
  };

  const related = selectRelatedItems(current, [...notes, project]);
  assert.equal(related.length, 4);
  assert.ok(related.some((item) => item.type === "project"));
});

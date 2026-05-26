import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../src/lib/format.ts";

test("formatDate renders date-only values without timezone drift", () => {
  // YAML date-only values parse as midnight UTC; without timeZone: "UTC",
  // negative-offset timezones would display the previous day.
  const date = new Date("2025-01-15T00:00:00.000Z");
  assert.equal(formatDate(date), "Jan 15, 2025");
});

test("formatDate supports long month format", () => {
  const date = new Date("2025-01-15T00:00:00.000Z");
  assert.equal(formatDate(date, "long"), "January 15, 2025");
});

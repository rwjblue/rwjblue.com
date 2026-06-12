import { test } from "node:test";
import assert from "node:assert/strict";

import {
  effectiveProjectUpdatedDate,
  latestTrackerActivationDate,
} from "../src/lib/project-updates.ts";

test("latestTrackerActivationDate returns the newest activation date", () => {
  assert.equal(
    latestTrackerActivationDate({
      references: [
        { latestActivation: { date: "2026-06-03" } },
        { latestActivation: { date: "2026-06-04" } },
      ],
    })?.toISOString(),
    "2026-06-04T00:00:00.000Z",
  );
});

test("effectiveProjectUpdatedDate uses RI POTA activation activity", () => {
  const updated = effectiveProjectUpdatedDate(
    {
      id: "2026-activate-all-ri-pota",
      data: { updated: new Date("2026-05-26T00:00:00.000Z") },
    },
    {
      riPotaTrackerData: {
        references: [
          { latestActivation: { date: "2026-06-04" } },
        ],
      },
    },
  );

  assert.equal(updated.toISOString(), "2026-06-04T00:00:00.000Z");
});

test("effectiveProjectUpdatedDate uses RI POTA tracker generation activity", () => {
  const updated = effectiveProjectUpdatedDate(
    {
      id: "2026-activate-all-ri-pota",
      data: { updated: new Date("2026-05-26T00:00:00.000Z") },
    },
    {
      riPotaTrackerData: {
        generatedAt: "2026-06-12T23:29:18.981Z",
        references: [
          { latestActivation: { date: "2026-06-09" } },
        ],
      },
    },
  );

  assert.equal(updated.toISOString(), "2026-06-12T00:00:00.000Z");
});

test("effectiveProjectUpdatedDate uses rove to FL generated planning data", () => {
  const updated = effectiveProjectUpdatedDate(
    {
      id: "2026-06-rove-to-fl",
      data: { updated: new Date("2026-06-10T00:00:00.000Z") },
    },
    {
      riPotaTrackerData: { references: [] },
      roveToFlData: {
        generatedAt: "2026-06-12T01:44:26.818Z",
      },
    },
  );

  assert.equal(updated.toISOString(), "2026-06-12T00:00:00.000Z");
});

test("effectiveProjectUpdatedDate leaves other projects on frontmatter dates", () => {
  const updated = effectiveProjectUpdatedDate(
    {
      id: "developer-tooling",
      data: { updated: new Date("2026-05-24T00:00:00.000Z") },
    },
    {
      riPotaTrackerData: {
        references: [
          { latestActivation: { date: "2026-06-04" } },
        ],
      },
    },
  );

  assert.equal(updated.toISOString(), "2026-05-24T00:00:00.000Z");
});

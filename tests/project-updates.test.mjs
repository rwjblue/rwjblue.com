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

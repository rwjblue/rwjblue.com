import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildPotaUpdatePlan,
  parsePotaUpdateArgs,
} from "../scripts/pota/update.mjs";

test("parsePotaUpdateArgs defaults to the standard update path", () => {
  assert.deepEqual(parsePotaUpdateArgs([]), {
    fullBackfill: false,
  });
});

test("parsePotaUpdateArgs enables full backfill", () => {
  assert.deepEqual(parsePotaUpdateArgs(["--full-backfill"]), {
    fullBackfill: true,
  });
});

test("parsePotaUpdateArgs rejects unknown flags", () => {
  assert.throws(
    () => parsePotaUpdateArgs(["--wat"]),
    /Unknown option: --wat/,
  );
});

test("buildPotaUpdatePlan returns the standard refresh command sequence", () => {
  assert.deepEqual(buildPotaUpdatePlan({ fullBackfill: false }), [
    ["mise", "run", "pota:ri:update-profile"],
    ["mise", "run", "pota:ri:build-tracker-data"],
    ["mise", "run", "pota:park:backfill-known"],
  ]);
});

test("buildPotaUpdatePlan includes RI park and activation backfills when requested", () => {
  assert.deepEqual(buildPotaUpdatePlan({ fullBackfill: true }), [
    ["mise", "run", "pota:ri:update-parks"],
    ["mise", "run", "pota:ri:update-profile"],
    ["mise", "run", "pota:ri:backfill-activations"],
    ["mise", "run", "pota:ri:build-tracker-data"],
    ["mise", "run", "pota:park:backfill-known"],
  ]);
});

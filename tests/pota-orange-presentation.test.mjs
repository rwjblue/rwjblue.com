import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldEmphasizeOrangeGuidance } from "../src/lib/pota/orange-presentation.ts";

test("orange guidance stays prominent through May 31 in Rhode Island", () => {
  assert.equal(shouldEmphasizeOrangeGuidance("required", new Date("2026-06-01T03:59:59Z")), true);
  assert.equal(shouldEmphasizeOrangeGuidance("required", new Date("2026-06-01T04:00:00Z")), false);
});

test("orange guidance becomes prominent on August 15 in Rhode Island", () => {
  assert.equal(shouldEmphasizeOrangeGuidance("required", new Date("2026-08-15T03:59:59Z")), false);
  assert.equal(shouldEmphasizeOrangeGuidance("required", new Date("2026-08-15T04:00:00Z")), true);
});

test("reminders span the new year and include recommendations and area guidance", () => {
  for (const status of ["required", "recommended", "area-dependent"]) {
    assert.equal(shouldEmphasizeOrangeGuidance(status, new Date("2026-12-31T17:00:00Z")), true);
    assert.equal(shouldEmphasizeOrangeGuidance(status, new Date("2027-01-01T17:00:00Z")), true);
    assert.equal(shouldEmphasizeOrangeGuidance(status, new Date("2026-07-01T16:00:00Z")), false);
  }
});

test("parks with no general orange requirement stay quiet year-round", () => {
  for (const date of ["2026-01-01T17:00:00Z", "2026-07-01T16:00:00Z", "2026-09-12T16:00:00Z"]) {
    assert.equal(shouldEmphasizeOrangeGuidance("not-required", new Date(date)), false);
  }
});

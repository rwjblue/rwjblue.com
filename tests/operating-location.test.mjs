import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATING_GRID_STORAGE_KEY,
  readSavedOperatingGrid,
  saveOperatingGrid,
} from "../src/lib/operating-location.ts";

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("radio tools share one normalized operating grid", () => {
  const storage = memoryStorage();

  assert.equal(saveOperatingGrid("fn41fr", storage), "FN41FR");
  assert.equal(readSavedOperatingGrid(storage), "FN41FR");
  assert.equal(storage.getItem(OPERATING_GRID_STORAGE_KEY), "FN41FR");
});

test("saved operating grid migrates from either legacy radio tool", () => {
  for (const legacyKey of ["rbnSkimmers.grid", "ncdxfBeacons.grid"]) {
    const storage = memoryStorage({ [legacyKey]: "FN41FR" });

    assert.equal(readSavedOperatingGrid(storage), "FN41FR");
    assert.equal(storage.getItem(OPERATING_GRID_STORAGE_KEY), "FN41FR");
  }
});

test("saved operating grid ignores invalid legacy values", () => {
  const storage = memoryStorage({
    "rbnSkimmers.grid": "not-a-grid",
    "ncdxfBeacons.grid": "EL96WD",
  });

  assert.equal(readSavedOperatingGrid(storage), "EL96WD");
});

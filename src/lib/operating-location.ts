import { gridToLatLon } from "./geo.ts";

export const OPERATING_GRID_STORAGE_KEY = "radioTools.operatingGrid";
const LEGACY_GRID_STORAGE_KEYS = [
  "rbnSkimmers.grid",
  "ncdxfBeacons.grid",
] as const;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSavedOperatingGrid(
  storage = browserStorage(),
): string | null {
  if (!storage) return null;

  for (const key of [
    OPERATING_GRID_STORAGE_KEY,
    ...LEGACY_GRID_STORAGE_KEYS,
  ]) {
    const grid = normalizeGrid(readItem(storage, key));
    if (!grid) continue;
    if (key !== OPERATING_GRID_STORAGE_KEY) {
      writeItem(storage, OPERATING_GRID_STORAGE_KEY, grid);
    }
    return grid;
  }

  return null;
}

export function saveOperatingGrid(
  value: string,
  storage = browserStorage(),
): string | null {
  const grid = normalizeGrid(value);
  if (!grid || !storage) return null;
  writeItem(storage, OPERATING_GRID_STORAGE_KEY, grid);
  return grid;
}

function normalizeGrid(value: string | null): string | null {
  const grid = String(value ?? "").trim().toUpperCase();
  return grid && gridToLatLon(grid) ? grid : null;
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readItem(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Persistence is optional; the tools still work when storage is blocked.
  }
}

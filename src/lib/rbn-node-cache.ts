import type { RbnNodeRecord } from "./rbn-skimmers.ts";

export const RBN_NODE_CACHE_FRESH_MS = 60 * 1000;
export const RBN_NODE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

interface RbnNodeCachePayload {
  version: 1;
  fetchedAt: number;
  nodes: RbnNodeRecord[];
}

export interface CachedRbnNodes {
  nodes: RbnNodeRecord[];
  fetchedAt: number;
  ageMs: number;
  isFresh: boolean;
}

export function encodeRbnNodeCache(
  nodes: RbnNodeRecord[],
  fetchedAt = Date.now(),
): string {
  const payload: RbnNodeCachePayload = {
    version: 1,
    fetchedAt,
    nodes,
  };
  return JSON.stringify(payload);
}

export function decodeRbnNodeCache(
  value: string | null,
  now = Date.now(),
): CachedRbnNodes | null {
  if (!value) return null;

  try {
    const payload = JSON.parse(value) as Partial<RbnNodeCachePayload>;
    if (
      payload.version !== 1 ||
      !Number.isFinite(payload.fetchedAt) ||
      !Array.isArray(payload.nodes) ||
      !payload.nodes.every(isRbnNodeRecord)
    ) {
      return null;
    }

    const fetchedAt = payload.fetchedAt as number;
    const ageMs = Math.max(0, now - fetchedAt);
    if (ageMs > RBN_NODE_CACHE_MAX_AGE_MS) return null;

    return {
      nodes: payload.nodes,
      fetchedAt,
      ageMs,
      isFresh: ageMs <= RBN_NODE_CACHE_FRESH_MS,
    };
  } catch {
    return null;
  }
}

function isRbnNodeRecord(value: unknown): value is RbnNodeRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const node = value as Record<string, unknown>;
  const stringFields = ["call", "grid", "sk_ver", "sk_opt", "lst_age"];
  if (stringFields.some((field) => field in node && typeof node[field] !== "string")) {
    return false;
  }

  return !("band" in node) || (typeof node.band === "object" && node.band !== null);
}

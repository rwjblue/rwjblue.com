import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RBN_NODE_CACHE_FRESH_MS,
  RBN_NODE_CACHE_MAX_AGE_MS,
  decodeRbnNodeCache,
  encodeRbnNodeCache,
} from "../src/lib/rbn-node-cache.ts";

const now = Date.UTC(2026, 6, 13, 17, 0, 0);
const nodes = [
  { call: "NU4F", grid: "EL96WD", lst_age: "online" },
  { call: "AA0O", grid: "EL87PS", lst_age: "online" },
];

test("RBN node cache round-trips fresh node data", () => {
  const encoded = encodeRbnNodeCache(nodes, now - 30_000);

  assert.deepEqual(decodeRbnNodeCache(encoded, now), {
    nodes,
    fetchedAt: now - 30_000,
    ageMs: 30_000,
    isFresh: true,
  });
});

test("RBN node cache keeps recent stale data for background refresh", () => {
  const fetchedAt = now - RBN_NODE_CACHE_FRESH_MS - 1;
  const cached = decodeRbnNodeCache(encodeRbnNodeCache(nodes, fetchedAt), now);

  assert.equal(cached?.isFresh, false);
  assert.equal(cached?.ageMs, RBN_NODE_CACHE_FRESH_MS + 1);
  assert.deepEqual(cached?.nodes, nodes);
});

test("RBN node cache rejects expired and malformed data", () => {
  const expiredAt = now - RBN_NODE_CACHE_MAX_AGE_MS - 1;

  assert.equal(
    decodeRbnNodeCache(encodeRbnNodeCache(nodes, expiredAt), now),
    null,
  );
  assert.equal(decodeRbnNodeCache("not-json", now), null);
  assert.equal(
    decodeRbnNodeCache(
      JSON.stringify({ version: 1, fetchedAt: now, nodes: [{ grid: 42 }] }),
      now,
    ),
    null,
  );
});

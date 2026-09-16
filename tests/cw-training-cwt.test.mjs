import assert from "node:assert/strict";
import test from "node:test";
import { parseCwtResult, readCwtResult } from "../src/lib/cw-training/cwt-result.ts";
import { parseQsoCount, readQsoCount, usesQsoCount } from "../src/lib/cw-training/qso-count.ts";

test("POTA and on-air counts preserve blank versus zero and reject invalid counts", () => {
  const data = new FormData();
  assert.equal(readQsoCount(data), undefined);
  data.set("qsoCount", "0");
  assert.equal(readQsoCount(data), 0);
  data.set("qsoCount", "23");
  assert.equal(readQsoCount(data), 23);
  data.set("qsoCount", "  ");
  assert.equal(readQsoCount(data), undefined);
  for (const value of [-1, 0.5, Infinity, NaN, 1000001, "23", null]) assert.throws(() => parseQsoCount(value));
  assert.equal(usesQsoCount("other:pota"), true);
  assert.equal(usesQsoCount("other:on-air"), true);
  for (const id of ["other:cwt", "other:general", "other:icr", "unknown"]) assert.equal(usesQsoCount(id), false);
});

test("CWT form preserves zero, omits blanks, and retains multiline observations", () => {
  const data = new FormData();
  assert.equal(readCwtResult(data), undefined);
  data.set("cwtQsoCount", "0");
  data.set("cwtheardExchanges", "  AL 1234\nBOB MA  ");
  data.set("cwtworkedCallsigns", " ");
  assert.deepEqual(readCwtResult(data), { qsoCount: 0, heardExchanges: "AL 1234\nBOB MA" });
  data.set("cwtQsoCount", "1.5");
  assert.throws(() => readCwtResult(data), /whole number/);
});

test("CWT validation rejects malformed or oversized data without coercion", () => {
  for (const bad of [null, [], "CWT", { qsoCount: "2" }, { qsoCount: -1 }, { qsoCount: 1.2 },
    { qsoCount: Infinity }, { qsoCount: 1000001 }, { score: 42 }, { comments: false },
    { workedNames: "A\0B" }, { heardCallsigns: "x".repeat(4001) }]) {
    assert.throws(() => parseCwtResult(bad));
  }
  assert.deepEqual(parseCwtResult({ comments: "" }), { comments: "" });
});

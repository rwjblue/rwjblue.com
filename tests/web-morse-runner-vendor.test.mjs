import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  checkBundle, makeBundle, replaceOnce, sha256, sourceFiles, sourceHashes,
  syntheticCalls, updateBundle, upstreamPath, validateRevision, vendorRoot, verifyApproval,
} from "../scripts/web-morse-runner/update.mjs";

const approval = JSON.parse(await readFile(new URL("../scripts/web-morse-runner/approved.json", import.meta.url), "utf8"));
const revision = approval.revision;
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async (path) =>
  [path, await readFile(join(vendorRoot, upstreamPath(path)), "utf8")])));

async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), "n1rwj-runner-vendor-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const fetchSources = (files = sources) => async (url, options) => {
  assert.match(url, new RegExp(`/fritzsche/WebMorseRunner/${revision}/[^/]+$`));
  assert.equal(options.redirect, "error");
  return new Response(files[new URL(url).pathname.split("/").at(-1)]);
};

test("vendor revisions require an explicit immutable full SHA", () => {
  assert.equal(validateRevision(revision), revision);
  for (const bad of [undefined, "", "main", "v0.19.1", revision.slice(0, 8), revision.toUpperCase(), `../${revision}`]) {
    assert.throws(() => validateRevision(bad), /explicit full/);
  }
});

test("every approved source has an exact checked-in hash", () => {
  assert.deepEqual(sourceHashes(sources), approval.sha256);
  assert.doesNotThrow(() => verifyApproval(revision, sources, approval));
  assert.throws(() => verifyApproval("a".repeat(40), sources, approval), /Unreviewed revision/);
  assert.throws(() => verifyApproval(revision, { ...sources, "view.js": sources["view.js"] + "\n" }, approval), /integrity.*view.js/);
  assert.throws(() => verifyApproval(revision, sources, { ...approval, sha256: {} }), /inventory/);
});

test("patch anchors must occur exactly once, and new imports require review", () => {
  assert.equal(replaceOnce("before TARGET after", "TARGET", "patched", "test"), "before patched after");
  assert.throws(() => replaceOnce("missing", "TARGET", "patched", "test"), /exactly one/);
  assert.throws(() => replaceOnce("TARGET TARGET", "TARGET", "patched", "test"), /exactly one/);
  assert.throws(() => makeBundle(revision, { ...sources, "view.js": sources["view.js"].replace("async startContest() {", "async startRun() {") }), /View/);
  assert.throws(() => makeBundle(revision, { ...sources, "main.js": 'import "https://example.com/new.js";' }), /Unreviewed module dependency/);
  assert.throws(() => makeBundle(revision, { ...sources, "main.js": 'import "./new-module.js";' }), /Unreviewed module dependency/);
});

test("raw upstream is untouched and all local changes have separate generated outputs", () => {
  const bundle = makeBundle(revision, sources);
  for (const path of sourceFiles) assert.equal(bundle[upstreamPath(path)], sources[path]);
  assert.equal(bundle["upstream/index.html"], undefined);
  assert.equal(bundle["upstream/index.html.txt"], sources["index.html"]);
  assert.match(bundle["runtime/view.js"], /addModule\(new URL\("\.\/contest-processor.js", import.meta.url\)\)/);
  assert.match(bundle["runtime/call.js"], /new URL\("\.\.\/data\/synthetic-calls.txt", import.meta.url\)/);
  assert.match(bundle["runtime/call.js"], /n1rwj_runner_synthetic_calls_v1/);
  assert.match(bundle["runtime/config.js"], /n1rwj_runner_config_v1/);
  assert.match(bundle["index.html"], /\.\/runtime\/style.css/);
  assert.match(bundle["index.html"], /\.\/integration\/theme.css/);
  assert.match(bundle["index.html"], /\.\/integration\/main.js/);
  assert.match(bundle["index.html"], /Synthetic practice calls; not real contacts/);
  assert.match(bundle["index.html"], /name="robots" content="noindex, nofollow"/);
  assert.match(bundle["index.html"], /<body data-pagefind-ignore>/);
  assert.equal(bundle.LICENSE, sources.LICENSE);
  assert.equal(Object.keys(bundle).some((path) => path.startsWith("integration/")), false);
  const metadata = JSON.parse(bundle["UPSTREAM.json"]);
  assert.equal(metadata.revision, revision);
  for (const [path, digest] of Object.entries(metadata.generatedSha256)) assert.equal(sha256(bundle[path]), digest);
});

test("synthetic calls are original, deterministic, distinct, and explicitly labeled", () => {
  const text = syntheticCalls();
  assert.equal(text, syntheticCalls());
  assert.match(text, /Not a callsign registry/);
  const calls = text.split("\n").filter((line) => line && !line.startsWith("#"));
  assert.equal(calls.length, 512);
  assert.equal(new Set(calls).size, 512);
  for (const call of calls) assert.match(call, /^[A-Z]{1,2}[0-9][A-Z]{3}$/);
  const bundle = makeBundle(revision, sources);
  assert.equal(bundle["data/synthetic-calls.txt"], text);
  assert.equal(Object.keys(bundle).some((path) => /Example_Calls|(?:^|\/)calls\.txt$/.test(path)), false);
});

test("checked-in vendor output verifies entirely offline", async () => {
  const output = await checkBundle(vendorRoot, approval);
  assert.ok(Object.keys(output).length > 50);
});

test("update is reproducible and preserves independently maintained integration files", async (t) => {
  const root = await temporary(t);
  await mkdir(join(root, "integration"));
  await writeFile(join(root, "integration/main.js"), "// locally owned adapter\n");
  const first = await updateBundle(root, revision, approval, fetchSources());
  const second = await updateBundle(root, revision, approval, fetchSources());
  assert.deepEqual(first, second);
  assert.equal(await readFile(join(root, "integration/main.js"), "utf8"), "// locally owned adapter\n");
  assert.deepEqual(await checkBundle(root, approval), first);
});

test("download integrity or compatibility failures cause no generated writes", async (t) => {
  const root = await temporary(t);
  const altered = { ...sources, "view.js": sources["view.js"] + "// bad download" };
  await assert.rejects(updateBundle(root, revision, approval, fetchSources(altered)), /integrity/);
  assert.deepEqual(await readdir(root), []);
  const incompatible = { ...sources, "view.js": sources["view.js"].replace("async startContest() {", "async startRun() {") };
  const changedApproval = { revision, sha256: sourceHashes(incompatible) };
  await assert.rejects(updateBundle(root, revision, changedApproval, fetchSources(incompatible)), /Incompatible upstream/);
  assert.deepEqual(await readdir(root), []);
});

for (const [name, change, pattern] of [
  ["modified runtime", async (root) => writeFile(join(root, "runtime/view.js"), "// manual modification"), /Generated vendor file changed/],
  ["modified raw source", async (root) => writeFile(join(root, "upstream/view.js"), "// manual modification"), /integrity/],
  ["unexpected files", async (root) => writeFile(join(root, "runtime/unexpected.js"), "// preserve me"), /inventory/],
  ["missing files", async (root) => rm(join(root, "runtime/view.js")), /inventory/],
]) {
  test(`update refuses ${name} before downloading or overwriting`, async (t) => {
    const root = await temporary(t);
    await updateBundle(root, revision, approval, fetchSources());
    await change(root);
    let fetched = false;
    await assert.rejects(updateBundle(root, revision, approval, async () => { fetched = true; throw new Error("should not fetch"); }), pattern);
    assert.equal(fetched, false);
  });
}

test("partial unmanaged output cannot be overwritten", async (t) => {
  const root = await temporary(t);
  await writeFile(join(root, "index.html"), "user content");
  await assert.rejects(updateBundle(root, revision, approval, fetchSources()), /Partial\/unmanaged/);
  assert.equal(await readFile(join(root, "index.html"), "utf8"), "user content");
});

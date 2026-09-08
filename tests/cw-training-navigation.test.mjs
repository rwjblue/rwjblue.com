import assert from "node:assert/strict";
import test from "node:test";
import { createTrainingNavigation } from "../src/lib/cw-training/navigation.ts";

function fakeBrowser(initialUrl = "https://example.invalid/radio/cw-training/", initialState = null) {
  const location = new URL(initialUrl);
  const listeners = new Map();
  const pushes = [];
  let entries = [{ url: location.href, state: initialState }];
  let index = 0;
  const dispatch = type => { for (const listener of listeners.get(type) ?? []) listener({ type }); };
  const browser = {
    location,
    history: {
      get state() { return entries[index].state; },
      pushState(state, title, url) {
        pushes.push({ state, title, url: String(url) });
        location.href = new URL(url, location.href).href;
        entries = [...entries.slice(0, index + 1), { url: location.href, state }];
        index++;
      },
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
  };
  return {
    browser, pushes, dispatch,
    get entryCount() { return entries.length; },
    traverse(delta) {
      const next = index + delta;
      if (next < 0 || next >= entries.length) return;
      const previousHash = location.hash;
      index = next;
      location.href = entries[index].url;
      dispatch("popstate");
      if (location.hash !== previousHash) dispatch("hashchange");
    },
    hash(value) { location.hash = value; dispatch("hashchange"); },
  };
}

test("initialization derives the view without writing history or calling render callbacks", () => {
  for (const [hash, expected] of [
    ["", "today"], ["#today", "today"], ["#focus", "focus"], ["#week", "week"], ["#materials", "materials"],
    ["#unknown", "today"], ["#Focus", "today"], ["#focus/extra", "today"], ["#%66ocus", "today"],
  ]) {
    const surface = fakeBrowser(`https://example.invalid/radio/cw-training/${hash}`);
    const changes = [];
    const navigation = createTrainingNavigation(surface.browser, view => changes.push(view));
    assert.equal(navigation.view, expected, hash || "no fragment");
    assert.equal(surface.entryCount, 1);
    assert.deepEqual(surface.pushes, []);
    assert.deepEqual(changes, []);
  }
});

test("valid transitions add one entry and update the view before notifying the caller", () => {
  const surface = fakeBrowser();
  const changes = [];
  const navigation = createTrainingNavigation(surface.browser, view => {
    assert.equal(navigation.view, view);
    assert.equal(surface.browser.location.hash, `#${view}`);
    changes.push(view);
  });
  for (const view of ["focus", "week", "materials", "today"]) navigation.navigate(view);
  assert.deepEqual(changes, ["focus", "week", "materials", "today"]);
  assert.equal(surface.entryCount, 5);
  assert.equal(surface.pushes.length, 4);
  assert.equal(navigation.view, "today");
});

test("navigation preserves pathname, query, and existing history state without adding practice data", () => {
  for (const state of [null, { existing: "host state", nested: { scroll: 123 } }, "existing-state", 42]) {
    const surface = fakeBrowser("https://example.invalid/radio/cw-training/?source=class&mode=review#week", state);
    const navigation = createTrainingNavigation(surface.browser, () => {});
    navigation.navigate("focus");
    assert.equal(surface.pushes[0].url, "https://example.invalid/radio/cw-training/?source=class&mode=review#focus");
    assert.equal(surface.pushes[0].state, state);
    assert.equal(surface.browser.history.state, state);
    assert.equal(surface.pushes[0].title, "");
    if (state && typeof state === "object") assert.deepEqual(state, { existing: "host state", nested: { scroll: 123 } });
  }
});

test("same-view navigation, invalid targets, and render feedback are no-ops", () => {
  const surface = fakeBrowser();
  const changes = [];
  const navigation = createTrainingNavigation(surface.browser, view => {
    changes.push(view);
    navigation.navigate(view);
  });
  for (const next of ["today", "", "Focus", "#focus", "focus/extra", "https://example.invalid/focus", "unknown"]) navigation.navigate(next);
  assert.deepEqual(changes, []);
  assert.deepEqual(surface.pushes, []);
  navigation.navigate("focus");
  navigation.navigate("focus");
  surface.dispatch("popstate");
  surface.dispatch("hashchange");
  assert.deepEqual(changes, ["focus"]);
  assert.equal(surface.pushes.length, 1);
});

test("Back and Forward traverse existing entries without writing or duplicate event callbacks", () => {
  const surface = fakeBrowser("https://example.invalid/radio/cw-training/?from=class");
  const changes = [];
  const navigation = createTrainingNavigation(surface.browser, view => changes.push(view));
  navigation.navigate("focus");
  navigation.navigate("week");
  navigation.navigate("materials");
  changes.length = 0;
  surface.traverse(-1);
  assert.equal(navigation.view, "week");
  surface.traverse(-1);
  assert.equal(navigation.view, "focus");
  surface.traverse(-1);
  assert.equal(navigation.view, "today");
  surface.traverse(1);
  surface.traverse(1);
  surface.traverse(1);
  assert.deepEqual(changes, ["week", "focus", "today", "focus", "week", "materials"]);
  assert.equal(surface.pushes.length, 3);
  assert.equal(surface.entryCount, 4);
  assert.equal(surface.browser.location.search, "?from=class");
});

test("direct hash changes and unknown hashes update view once, without canonicalizing history", () => {
  const surface = fakeBrowser("https://example.invalid/radio/cw-training/#focus");
  const changes = [];
  const navigation = createTrainingNavigation(surface.browser, view => changes.push(view));
  surface.hash("#materials");
  surface.dispatch("popstate");
  surface.dispatch("hashchange");
  assert.equal(navigation.view, "materials");
  surface.hash("#unknown");
  assert.equal(navigation.view, "today");
  assert.equal(surface.browser.location.hash, "#unknown", "unknown hashes are interpreted, not replaced");
  surface.hash("");
  surface.hash("#today");
  surface.hash("#week");
  assert.deepEqual(changes, ["materials", "today", "week"]);
  assert.equal(surface.pushes.length, 0);
  assert.equal(surface.entryCount, 1);
});

test("a reload at Focus restores only navigation and does not need a practice snapshot", () => {
  const surface = fakeBrowser("https://example.invalid/radio/cw-training/?source=class#focus", { host: "existing" });
  const navigation = createTrainingNavigation(surface.browser, () => assert.fail("initialization must not start work"));
  assert.equal(navigation.view, "focus");
  assert.deepEqual(surface.browser.history.state, { host: "existing" });
  assert.equal(surface.pushes.length, 0);
});

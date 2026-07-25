import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pagefindFiltersFor,
  parseSearchState,
  searchStateUrl,
} from "../src/lib/search-client.ts";
import { shouldHandleSearchShortcut } from "../src/lib/search-shortcut.ts";

test("search state parses and serializes repeatable content types and tags", () => {
  const state = parseSearchState(
    new URLSearchParams(
      "q=portable&type=Note&type=Project&tag=radio&focus=1",
    ),
  );
  assert.deepEqual(state, {
    query: "portable",
    types: ["Note", "Project"],
    tag: "radio",
  });

  const url = searchStateUrl(state, new URL("https://rwjblue.com/search/?old=1"));
  assert.equal(
    url.search,
    "?old=1&q=portable&type=Note&type=Project&tag=radio",
  );
});

test("Pagefind options use any for multiple types and combine the tag", () => {
  assert.deepEqual(
    pagefindFiltersFor({
      query: "portable",
      types: ["Note", "Project"],
      tag: "radio",
    }),
    {
      type: { any: ["Note", "Project"] },
      tag: "radio",
    },
  );
  assert.equal(
    pagefindFiltersFor({ query: "", types: [], tag: "" }),
    undefined,
  );
});

test("slash shortcut handles normal content without capturing editable controls", () => {
  assert.equal(
    shouldHandleSearchShortcut({ key: "/", target: { tagName: "BODY" } }),
    true,
  );
  assert.equal(
    shouldHandleSearchShortcut({ key: "/", target: { tagName: "INPUT" } }),
    false,
  );
  assert.equal(
    shouldHandleSearchShortcut({
      key: "/",
      ctrlKey: true,
      target: { tagName: "BODY" },
    }),
    false,
  );
  assert.equal(
    shouldHandleSearchShortcut({
      key: "/",
      target: { tagName: "DIV", isContentEditable: true },
    }),
    false,
  );
});

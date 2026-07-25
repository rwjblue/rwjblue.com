import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBacklinkIndex,
  extractInternalLinks,
  normalizeInternalPath,
} from "../src/lib/backlinks.ts";

test("canonical path normalization collapses fragments and equivalent forms", () => {
  assert.equal(
    normalizeInternalPath("/notes/example#details"),
    "/notes/example/",
  );
  assert.equal(
    normalizeInternalPath("https://rwjblue.com/notes/example/index.html?q=1"),
    "/notes/example/",
  );
  assert.equal(
    normalizeInternalPath("/radio/pota/us-0513"),
    "/radio/pota/US-0513/",
  );
});

test("link extraction ignores external URLs, assets, and generated pages", () => {
  const links = extractInternalLinks(`
[Note](/notes/example/#part)
[Again](/notes/example/)
[External](https://example.com/)
[Image](/images/example.png)
<a href="/projects/one/">Project</a>
[Share](/notes/example/share-image/)
`);

  assert.deepEqual(links, ["/notes/example/", "/projects/one/"]);
});

test("backlink collection excludes hidden sources, self links, and duplicates", () => {
  const index = buildBacklinkIndex([
    {
      href: "/notes/public/",
      title: "Public",
      label: "Note",
      discoverable: true,
      content:
        "[Park](/radio/pota/US-0513/#map) [Park again](/radio/pota/US-0513/)",
    },
    {
      href: "/notes/unlisted/",
      title: "Unlisted",
      label: "Note",
      discoverable: false,
      content: "[Park](/radio/pota/US-0513/)",
    },
    {
      href: "/projects/self/",
      title: "Self",
      label: "Project",
      discoverable: true,
      content: "[Self](/projects/self/)",
    },
  ]);

  assert.deepEqual(index.get("/radio/pota/US-0513/"), [
    { href: "/notes/public/", title: "Public", label: "Note" },
  ]);
  assert.equal(index.has("/projects/self/"), false);
});

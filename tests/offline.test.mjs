import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  buildOfflineFieldKit,
  CACHE_PREFIX,
  FIELD_KIT_ROUTES,
  MAX_RUNTIME_ENTRIES,
} from "../scripts/offline-field-kit.mjs";

const write = (root, pathname, contents) => {
  const relative = pathname.replace(/^\/+/, "");
  const destination = pathname.endsWith("/")
    ? join(root, relative, "index.html")
    : join(root, relative);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
};

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "rwjblue-field-kit-"));
  for (const route of FIELD_KIT_ROUTES) {
    write(
      root,
      route,
      '<link rel="stylesheet" href="/_astro/site.css"><script src="/_astro/app.js"></script>',
    );
  }
  write(root, "/_astro/site.css", "body { color: black; }");
  write(root, "/_astro/app.js", "console.log('field kit');");
  write(root, "/manifest.webmanifest", "{}");
  write(root, "/favicon.svg", "<svg></svg>");
  return root;
};

test("offline field kit discovers only local route dependencies", () => {
  const root = fixture();
  try {
    const fieldKit = buildOfflineFieldKit(root);
    assert.deepEqual(
      fieldKit.precache.filter((path) => path.startsWith("/_astro/")),
      ["/_astro/app.js", "/_astro/site.css"],
    );
    assert.ok(FIELD_KIT_ROUTES.every((route) => fieldKit.precache.includes(route)));
    assert.doesNotMatch(fieldKit.source, /pagefind/);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("cache versions are deterministic and change with selected content", () => {
  const root = fixture();
  try {
    const first = buildOfflineFieldKit(root);
    const second = buildOfflineFieldKit(root);
    assert.equal(first.version, second.version);

    write(root, FIELD_KIT_ROUTES[0], "<p>changed field kit</p>");
    const changed = buildOfflineFieldKit(root);
    assert.notEqual(first.version, changed.version);
    assert.match(first.source, new RegExp(`${CACHE_PREFIX}-core-${first.version}`));
    assert.match(first.source, /skipWaiting\(\)/);
    assert.match(first.source, /clients\.claim\(\)/);
    assert.match(first.source, new RegExp(`MAX_RUNTIME_ENTRIES = ${MAX_RUNTIME_ENTRIES}`));
  } finally {
    rmSync(root, { recursive: true });
  }
});

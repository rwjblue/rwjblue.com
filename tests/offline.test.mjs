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

test("offline shells include transitive shared modules but never API or remote imports", () => {
  const root = fixture();
  try {
    write(root, "/_astro/app.js", 'import "./shared.js"; import("./lazy.js"); import("https://example.com/external.js"); import("/api/private.js");');
    write(root, "/_astro/shared.js", 'export { value } from "./nested.js";');
    write(root, "/_astro/nested.js", 'import "./shared.js"; export const value = 1;');
    write(root, "/_astro/lazy.js", 'export const ready = true;');
    const first = buildOfflineFieldKit(root);
    for (const name of ["shared", "nested", "lazy"]) assert.ok(first.precache.includes(`/_astro/${name}.js`));
    assert.ok(!first.precache.some((path) => path.includes("private") || path.includes("external")));
    write(root, "/_astro/nested.js", 'export const value = 2;');
    assert.notEqual(first.version, buildOfflineFieldKit(root).version);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("optional sending capture and its decoder/audio graph stay out of automatic precache", () => {
  const root = fixture();
  try {
    write(root, "/_astro/app.js", 'import("./sending-panel.Ab12_cd.js"); import("./other-lazy.js");');
    write(root, "/_astro/sending-panel.Ab12_cd.js", 'import "./sending-decoder.js"; import("./morse-pro-player-waa.Xyz789.js");');
    write(root, "/_astro/sending-decoder.js", 'import "./morse-dictionary.js"; import "./shared.js";');
    write(root, "/_astro/morse-dictionary.js", 'export const dictionary = {};');
    write(root, "/_astro/morse-pro-player-waa.Xyz789.js", 'export const play = () => {};');
    write(root, "/_astro/other-lazy.js", 'import "./shared.js"; import("./offline-map.js");');
    write(root, "/_astro/shared.js", 'export const shared = true;');
    write(root, "/_astro/offline-map.js", 'export const ready = true;');
    const first = buildOfflineFieldKit(root);
    for (const name of ["app.js", "other-lazy.js", "shared.js", "offline-map.js"]) {
      assert.ok(first.precache.includes(`/_astro/${name}`), `${name} remains available to the ordinary offline field kit`);
    }
    for (const name of ["sending-panel.Ab12_cd.js", "sending-decoder.js", "morse-dictionary.js", "morse-pro-player-waa.Xyz789.js"]) {
      assert.ok(!first.precache.includes(`/_astro/${name}`), `${name} requires explicit capture opt-in`);
      assert.ok(!first.source.includes(name), `${name} is absent from the generated worker precache`);
    }
    write(root, "/_astro/morse-dictionary.js", 'export const dictionary = { changed: true };');
    assert.equal(first.version, buildOfflineFieldKit(root).version, "an excluded dependency does not change the core cache version");
    write(root, FIELD_KIT_ROUTES[0], '<script src="/_astro/app.js"></script><link rel="modulepreload" href="/_astro/sending-panel.Ab12_cd.js">');
    assert.ok(!buildOfflineFieldKit(root).precache.includes("/_astro/sending-panel.Ab12_cd.js"), "an HTML reference does not bypass the opt-in boundary");
  } finally {
    rmSync(root, { recursive: true });
  }
});

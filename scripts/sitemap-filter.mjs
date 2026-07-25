import { readdirSync, readFileSync } from "node:fs";

const UTILITY_PATHS = [
  /^\/search\/$/,
  /^\/rss\.xml$/,
  /\/share-image\/$/,
  /\/share\.png$/,
];

export function privateNotePaths(directory = "src/content/notes") {
  return new Set(
    readdirSync(directory)
      .filter((name) => name.endsWith(".md"))
      .filter((name) => {
        const source = readFileSync(`${directory}/${name}`, "utf8");
        return /^visibility:\s+(draft|unlisted)\s*$/m.test(source);
      })
      .map((name) => `/notes/${name.slice(0, -3)}/`),
  );
}

export function createSitemapFilter(directory) {
  const privatePaths = privateNotePaths(directory);

  return (page) => {
    const path = new URL(page).pathname;
    return (
      !privatePaths.has(path) &&
      !UTILITY_PATHS.some((pattern) => pattern.test(path))
    );
  };
}

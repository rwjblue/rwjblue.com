import { readdirSync, readFileSync } from "node:fs";
import { notePublicationState } from "./note-frontmatter.mjs";

const UTILITY_PATHS = [
  /^\/search\/$/,
  /^\/rss\.xml$/,
  /^\/publication-schedule\.json$/,
  /\/share-image\/$/,
  /\/share\.png$/,
];

export function privateNotePaths(
  directory = "src/content/notes",
  now = new Date(),
) {
  return new Set(
    readdirSync(directory)
      .filter((name) => name.endsWith(".md"))
      .filter((name) => {
        const source = readFileSync(`${directory}/${name}`, "utf8");
        return notePublicationState(source, now) !== "public";
      })
      .map((name) => `/notes/${name.slice(0, -3)}/`),
  );
}

export function createSitemapFilter(directory, now = new Date()) {
  const privatePaths = privateNotePaths(directory, now);

  return (page) => {
    const path = new URL(page).pathname;
    return (
      !privatePaths.has(path) &&
      !UTILITY_PATHS.some((pattern) => pattern.test(path))
    );
  };
}

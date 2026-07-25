#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notesDir = path.join(root, "src/content/notes");
const distDir = path.join(root, "dist");
const includeDrafts = process.env.INCLUDE_DRAFTS === "true";

const discoveryPaths = [
  "index.html",
  "radio/index.html",
  "rss.xml",
];
const generatedDataPaths = [
  path.join(root, "src/data/pota/parks.json"),
  path.join(root, "src/data/pota/ri-tracker.json"),
];

async function readNoteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await readNoteFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

function noteVisibility(markdown) {
  return (
    markdown.match(
      /^visibility:\s*(public|unlisted|draft)\s*$/m,
    )?.[1] ?? "public"
  );
}

function noteId(filePath) {
  return path
    .relative(notesDir, filePath)
    .replaceAll(path.sep, "/")
    .replace(/\.md$/, "");
}

async function readBuiltFile(relativePath) {
  const filePath = path.join(distDir, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`Expected build output ${relativePath}`);
  }

  return readFile(filePath, "utf8");
}

function assertIncludes(content, value, source) {
  if (!content.includes(value)) {
    throw new Error(`Expected ${source} to include ${value}`);
  }
}

function assertExcludes(content, value, source) {
  if (content.includes(value)) {
    throw new Error(`Expected ${source} to exclude ${value}`);
  }
}

const noteFiles = await readNoteFiles(notesDir);
const nonPublicNotes = [];

for (const filePath of noteFiles) {
  const markdown = await readFile(filePath, "utf8");
  const visibility = noteVisibility(markdown);

  if (visibility !== "public") {
    nonPublicNotes.push({ id: noteId(filePath), visibility });
  }
}

const discoveryFiles = new Map();

for (const relativePath of discoveryPaths) {
  discoveryFiles.set(relativePath, await readBuiltFile(relativePath));
}

const notesIndex = await readBuiltFile("notes/index.html");

for (const note of nonPublicNotes) {
  const href = `/notes/${note.id}/`;
  const routePath = `notes/${note.id}/index.html`;
  const routeExists = existsSync(path.join(distDir, routePath));
  const shouldRender =
    note.visibility === "unlisted" ||
    (note.visibility === "draft" && includeDrafts);

  if (routeExists !== shouldRender) {
    throw new Error(
      `Expected ${routePath} ${shouldRender ? "to exist" : "to be absent"}`,
    );
  }

  for (const [relativePath, content] of discoveryFiles) {
    assertExcludes(content, href, relativePath);
  }

  for (const dataPath of generatedDataPaths) {
    if (existsSync(dataPath)) {
      assertExcludes(await readFile(dataPath, "utf8"), href, dataPath);
    }
  }

  if (note.visibility === "draft" && includeDrafts) {
    assertIncludes(notesIndex, href, "notes/index.html");
  } else {
    assertExcludes(notesIndex, href, "notes/index.html");
  }

  if (shouldRender) {
    const page = await readBuiltFile(routePath);
    assertIncludes(
      page,
      '<meta name="robots" content="noindex, nofollow">',
      routePath,
    );
    assertIncludes(
      page,
      `note-visibility--${note.visibility}`,
      routePath,
    );
    assertExcludes(page, "data-pagefind-body", routePath);
  }
}

console.log(
  `Verified note visibility for ${nonPublicNotes.length} non-public note(s).`,
);

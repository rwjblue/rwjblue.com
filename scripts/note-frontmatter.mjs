export function extractFrontmatter(markdown) {
  return markdown.match(/^---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---/)?.groups
    ?.frontmatter ?? "";
}

export function readFrontmatterScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));

  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function notePublicationState(markdown, now = new Date()) {
  const frontmatter = extractFrontmatter(markdown);
  const visibility =
    readFrontmatterScalar(frontmatter, "visibility") || "public";

  if (visibility !== "public") {
    return visibility;
  }

  const publishAtValue = readFrontmatterScalar(frontmatter, "publishAt");
  if (!publishAtValue) {
    return "public";
  }

  const publishAt = new Date(publishAtValue);
  if (Number.isNaN(publishAt.valueOf())) {
    throw new Error(`Invalid publishAt timestamp: ${publishAtValue}`);
  }

  return publishAt.valueOf() > now.valueOf() ? "scheduled" : "public";
}

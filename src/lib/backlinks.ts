export interface BacklinkSource {
  href: string;
  title: string;
  label: "Note" | "Project";
  content: string;
  discoverable: boolean;
}

export interface Backlink {
  href: string;
  title: string;
  label: "Note" | "Project";
}

const ASSET_EXTENSION =
  /\.(?:avif|css|gif|ico|ics|jpe?g|js|json|map|pdf|png|svg|webp|xml|zip)$/i;

export function normalizeInternalPath(value: string): string | undefined {
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.startsWith("#") ||
    /^(?:data|javascript|mailto|tel):/i.test(candidate)
  ) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(candidate, "https://rwjblue.com/");
  } catch {
    return undefined;
  }

  if (url.origin !== "https://rwjblue.com") return undefined;

  let path = url.pathname.replace(/\/{2,}/g, "/");
  path = path.replace(/\/index\.html$/i, "/");
  if (ASSET_EXTENSION.test(path)) return undefined;
  if (/\/(?:share-image|share\.png)\/?$/i.test(path)) return undefined;

  path = path.replace(
    /^(\/radio\/pota\/)(us-\d+)(\/?)$/i,
    (_, prefix, reference) => `${prefix}${reference.toUpperCase()}/`,
  );
  if (!path.endsWith("/")) path += "/";
  return path;
}

export function extractInternalLinks(content: string): string[] {
  const candidates = [
    ...content.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g),
    ...content.matchAll(/\bhref=["']([^"']+)["']/g),
  ].map((match) => match[1]);

  return [
    ...new Set(
      candidates
        .map(normalizeInternalPath)
        .filter((path): path is string => Boolean(path)),
    ),
  ].sort();
}

export function buildBacklinkIndex(
  sources: BacklinkSource[],
): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();

  for (const source of sources.filter((entry) => entry.discoverable)) {
    const sourcePath = normalizeInternalPath(source.href);
    if (!sourcePath) continue;

    for (const destination of extractInternalLinks(source.content)) {
      if (destination === sourcePath) continue;
      const backlink = {
        href: sourcePath,
        title: source.title,
        label: source.label,
      };
      const existing = index.get(destination) ?? [];
      if (!existing.some((entry) => entry.href === backlink.href)) {
        existing.push(backlink);
        index.set(destination, existing);
      }
    }
  }

  for (const backlinks of index.values()) {
    backlinks.sort(
      (a, b) =>
        a.title.localeCompare(b.title) || a.href.localeCompare(b.href),
    );
  }

  return index;
}

let backlinkIndexPromise: Promise<Map<string, Backlink[]>> | undefined;

async function getBacklinkIndex() {
  backlinkIndexPromise ??= (async () => {
    const [{ getCollection }, { getPublicNotes }] = await Promise.all([
      import("astro:content"),
      import("./notes.ts"),
    ]);
    const [notes, projects] = await Promise.all([
      getPublicNotes(),
      getCollection("projects"),
    ]);
    return buildBacklinkIndex([
      ...notes.map((note) => ({
        href: `/notes/${note.id}/`,
        title: note.data.title,
        label: "Note" as const,
        content: note.body ?? "",
        discoverable: note.data.visibility === "public",
      })),
      ...projects.map((project) => ({
        href: `/projects/${project.id}/`,
        title: project.data.title,
        label: "Project" as const,
        content: project.body ?? "",
        discoverable: true,
      })),
    ]);
  })();

  return backlinkIndexPromise;
}

export async function getBacklinks(destination: string): Promise<Backlink[]> {
  const path = normalizeInternalPath(destination);
  if (!path) return [];
  return (await getBacklinkIndex()).get(path) ?? [];
}

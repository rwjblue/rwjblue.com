import type { NoteEntry } from "./notes.ts";
import type { TaggedItem } from "./tags.ts";

export interface SeriesSummary {
  slug: string;
  title: string;
  entries: NoteEntry[];
}

export interface SeriesContext {
  series: SeriesSummary;
  previous?: NoteEntry;
  next?: NoteEntry;
}

const compareSeriesEntries = (a: NoteEntry, b: NoteEntry) =>
  (a.data.series?.order ?? 0) - (b.data.series?.order ?? 0) ||
  a.id.localeCompare(b.id);

export function collectSeries(notes: NoteEntry[]): SeriesSummary[] {
  const grouped = new Map<string, SeriesSummary>();

  for (const note of notes) {
    if (note.data.visibility !== "public") continue;
    const metadata = note.data.series;
    if (!metadata) continue;
    const existing = grouped.get(metadata.slug);

    if (existing && existing.title !== metadata.title) {
      throw new Error(
        `Series "${metadata.slug}" has conflicting titles: "${existing.title}" and "${metadata.title}".`,
      );
    }

    const series = existing ?? {
      slug: metadata.slug,
      title: metadata.title,
      entries: [],
    };

    if (series.entries.some((entry) => entry.data.series?.order === metadata.order)) {
      throw new Error(
        `Series "${metadata.slug}" uses order ${metadata.order} more than once.`,
      );
    }

    series.entries.push(note);
    grouped.set(metadata.slug, series);
  }

  return [...grouped.values()]
    .map((series) => ({
      ...series,
      entries: series.entries.sort(compareSeriesEntries),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export const getPublicSeries = async () => {
  const { getPublicNotes } = await import("./notes.ts");
  return collectSeries(await getPublicNotes());
};

export function seriesContextForNote(
  note: NoteEntry,
  series: SeriesSummary[],
): SeriesContext | undefined {
  const metadata = note.data.series;
  if (!metadata) return undefined;
  const match = series.find((candidate) => candidate.slug === metadata.slug);
  const index = match?.entries.findIndex((entry) => entry.id === note.id) ?? -1;

  if (!match || index < 0) return undefined;
  return {
    series: match,
    previous: match.entries[index - 1],
    next: match.entries[index + 1],
  };
}

export function selectRelatedItems(
  current: Pick<TaggedItem, "type" | "href" | "tags">,
  items: TaggedItem[],
  limit = 4,
): TaggedItem[] {
  const currentTags = new Set(current.tags);

  const ranked = items
    .filter((item) => item.href !== current.href)
    .map((item) => ({
      item,
      sharedTags: item.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter(({ sharedTags }) => sharedTags > 0)
    .sort(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        b.item.date.valueOf() - a.item.date.valueOf() ||
        a.item.title.localeCompare(b.item.title) ||
        a.item.href.localeCompare(b.item.href),
    )
    .map(({ item }) => item);

  const selected = ranked.slice(0, limit);
  const otherType = current.type === "note" ? "project" : "note";
  if (
    selected.length === limit &&
    !selected.some((item) => item.type === otherType)
  ) {
    const diverseItem = ranked.find((item) => item.type === otherType);
    if (diverseItem) selected[selected.length - 1] = diverseItem;
  }

  return selected;
}

export async function getRelatedContent(
  type: TaggedItem["type"],
  id: string,
): Promise<TaggedItem[]> {
  const { getTaggedItems } = await import("./tags.ts");
  const items = await getTaggedItems();
  const href = `/${type === "note" ? "notes" : "projects"}/${id}/`;
  const current = items.find((item) => item.type === type && item.href === href);
  return current ? selectRelatedItems(current, items) : [];
}

import { getCollection } from "astro:content";
import riPotaTrackerData from "../data/pota/ri-tracker.json";
import roveToFlData from "../data/pota/rove-to-fl.json";
import { displayTags } from "./format";
import { getPublicNotes } from "./notes";
import { effectiveProjectUpdatedDate } from "./project-updates";

export interface TaggedItem {
  type: "note" | "project";
  label: "Note" | "Project";
  date: Date;
  title: string;
  summary: string;
  href: string;
  tags: string[];
}

export interface TagSummary {
  tag: string;
  count: number;
  notes: number;
  projects: number;
}

export const tagHref = (tag: string) =>
  `/tags/${encodeURIComponent(tag)}/`;

export const getTaggedItems = async (): Promise<TaggedItem[]> => {
  const [notes, projects] = await Promise.all([
    getPublicNotes(),
    getCollection("projects"),
  ]);

  return [
    ...notes.map((note) => ({
      type: "note" as const,
      label: "Note" as const,
      date: note.data.date,
      title: note.data.title,
      summary: note.data.summary,
      href: `/notes/${note.id}/`,
      tags: displayTags(note.data.tags),
    })),
    ...projects.map((project) => ({
      type: "project" as const,
      label: "Project" as const,
      date: effectiveProjectUpdatedDate(project, {
        riPotaTrackerData,
        roveToFlData,
      }),
      title: project.data.title,
      summary: project.data.summary,
      href: `/projects/${project.id}/`,
      tags: displayTags(project.data.tags),
    })),
  ];
};

export const summarizeTags = (items: TaggedItem[]): TagSummary[] => {
  const summaries = new Map<string, TagSummary>();

  for (const item of items) {
    for (const tag of new Set(item.tags)) {
      const summary = summaries.get(tag) ?? {
        tag,
        count: 0,
        notes: 0,
        projects: 0,
      };

      summary.count += 1;
      summary[item.type === "note" ? "notes" : "projects"] += 1;
      summaries.set(tag, summary);
    }
  }

  return [...summaries.values()].sort((a, b) =>
    a.tag.localeCompare(b.tag),
  );
};

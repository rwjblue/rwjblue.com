import {
  getCollection,
  type CollectionEntry,
} from "astro:content";
import { compareChronologicalItemsNewestFirst } from "./chronology";

export type NoteEntry = CollectionEntry<"notes">;
export type NoteVisibility = NoteEntry["data"]["visibility"];

export const draftPreviewsEnabled =
  import.meta.env.DEV || import.meta.env.INCLUDE_DRAFTS === "true";

export const isPublicNote = (note: NoteEntry): boolean =>
  note.data.visibility === "public";

export const isUnlistedNote = (note: NoteEntry): boolean =>
  note.data.visibility === "unlisted";

export const isDraftNote = (note: NoteEntry): boolean =>
  note.data.visibility === "draft";

export const compareNotesNewestFirst = (
  left: NoteEntry,
  right: NoteEntry,
) =>
  compareChronologicalItemsNewestFirst(
    {
      date: left.data.date,
      series: left.data.series,
      id: left.id,
    },
    {
      date: right.data.date,
      series: right.data.series,
      id: right.id,
    },
  );

export const getPublicNotes = () => getCollection("notes", isPublicNote);

export const getRenderableNotes = () =>
  getCollection(
    "notes",
    (note) => !isDraftNote(note) || draftPreviewsEnabled,
  );

export const getDraftNotes = async () => {
  if (!draftPreviewsEnabled) {
    return [];
  }

  return getCollection("notes", isDraftNote);
};

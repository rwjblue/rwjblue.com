import {
  getCollection,
  type CollectionEntry,
} from "astro:content";
import { compareChronologicalItemsNewestFirst } from "./chronology";
import {
  isPublishedNoteAt,
  isScheduledNoteAt,
} from "./note-publication";

declare const __PUBLICATION_CUTOFF__: string;

export type NoteEntry = CollectionEntry<"notes">;
export type NoteVisibility = NoteEntry["data"]["visibility"];

export const publicationCutoff = new Date(
  typeof __PUBLICATION_CUTOFF__ === "string"
    ? __PUBLICATION_CUTOFF__
    : new Date().toISOString(),
);

export const draftPreviewsEnabled =
  import.meta.env.DEV || import.meta.env.INCLUDE_DRAFTS === "true";

export const isPublicNote = (note: NoteEntry): boolean =>
  isPublishedNoteAt(note, publicationCutoff);

export const isScheduledNote = (note: NoteEntry): boolean =>
  isScheduledNoteAt(note, publicationCutoff);

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
    (note) =>
      draftPreviewsEnabled ||
      isUnlistedNote(note) ||
      isPublicNote(note),
  );

export const getDraftNotes = async () => {
  if (!draftPreviewsEnabled) {
    return [];
  }

  return getCollection("notes", isDraftNote);
};

export const getScheduledNotes = async () => {
  if (!draftPreviewsEnabled) {
    return [];
  }

  return getCollection("notes", isScheduledNote);
};

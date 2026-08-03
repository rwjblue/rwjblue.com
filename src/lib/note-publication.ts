export type NotePublicationVisibility = "public" | "unlisted" | "draft";

export interface NotePublicationData {
  visibility: NotePublicationVisibility;
  publishAt?: Date;
}

export interface NoteWithPublicationData {
  data: NotePublicationData;
}

export interface PublicationSchedule {
  version: 1;
  generatedAt: string;
  nextPublishAt: string | null;
}

export const PUBLICATION_SCHEDULE_PATH = "/publication-schedule.json";

export const isScheduledNoteAt = (
  note: NoteWithPublicationData,
  now: Date,
): boolean =>
  note.data.visibility === "public" &&
  Boolean(note.data.publishAt && note.data.publishAt.valueOf() > now.valueOf());

export const isPublishedNoteAt = (
  note: NoteWithPublicationData,
  now: Date,
): boolean =>
  note.data.visibility === "public" && !isScheduledNoteAt(note, now);

export const notePublicationDate = <
  Note extends NoteWithPublicationData & { data: { date: Date } },
>(
  note: Note,
): Date => note.data.publishAt ?? note.data.date;

export function nextScheduledPublicationAt(
  notes: NoteWithPublicationData[],
  now: Date,
): Date | null {
  const timestamps = notes
    .filter((note) => isScheduledNoteAt(note, now))
    .map((note) => note.data.publishAt!.valueOf());

  return timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
}

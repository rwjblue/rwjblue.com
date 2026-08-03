import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import {
  nextScheduledPublicationAt,
  type PublicationSchedule,
} from "../lib/note-publication";
import { publicationCutoff } from "../lib/notes";

export const GET: APIRoute = async () => {
  const notes = await getCollection("notes");
  const nextPublishAt = nextScheduledPublicationAt(notes, publicationCutoff);
  const schedule: PublicationSchedule = {
    version: 1,
    generatedAt: publicationCutoff.toISOString(),
    nextPublishAt: nextPublishAt?.toISOString() ?? null,
  };

  return new Response(`${JSON.stringify(schedule)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};

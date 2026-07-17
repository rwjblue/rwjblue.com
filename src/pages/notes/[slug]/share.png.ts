import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { renderNoteShareImage } from "../../../lib/note-share-image";

export const getStaticPaths = (async () => {
  const notes = await getCollection("notes");

  return notes
    .filter(
      (note) =>
        !note.data.shareImage &&
        !note.data.contactMap &&
        !note.data.boundaryMap,
    )
    .map((note) => ({
      params: { slug: note.id },
      props: { note },
    }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const image = await renderNoteShareImage(props.note);

  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

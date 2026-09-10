import type { APIRoute, GetStaticPaths } from "astro";
import { renderParkPhoto, riParkPhotoAssets } from "../../../lib/pota/ri-park-images";

export const getStaticPaths: GetStaticPaths = () => riParkPhotoAssets.map((asset) => ({
  params: { filename: asset.filename },
  props: { asset },
}));

export const GET: APIRoute = async ({ props }) => new Response(
  await renderParkPhoto(props.asset),
  { headers: { "Content-Type": "image/webp" } },
);

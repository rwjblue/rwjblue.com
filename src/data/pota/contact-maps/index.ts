import blackHutContactMap from "./2026-05-27-black-hut-wildlife-management-area-pota.json";

export const CONTACT_MAPS = {
  "2026-05-27-black-hut-wildlife-management-area-pota": blackHutContactMap,
} as const;

export function contactMapForNote(noteId: string) {
  return CONTACT_MAPS[noteId as keyof typeof CONTACT_MAPS];
}

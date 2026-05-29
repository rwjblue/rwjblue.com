import blackHutContactMap from "./2026-05-27-black-hut-wildlife-management-area-pota.json";
import durfeeHillContactMap from "./2026-05-29-durfee-hill-wildlife-management-area-pota.json";

export const CONTACT_MAPS = {
  "2026-05-27-black-hut-wildlife-management-area-pota": blackHutContactMap,
  "2026-05-29-durfee-hill-wildlife-management-area-pota": durfeeHillContactMap,
} as const;

export function contactMapForNote(noteId: string) {
  return CONTACT_MAPS[noteId as keyof typeof CONTACT_MAPS];
}

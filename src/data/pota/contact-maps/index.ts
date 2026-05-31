import blackHutContactMap from "./2026-05-27-black-hut-wildlife-management-area-pota.json";
import eastBayRoveContactMap from "./2026-05-30-east-bay-pota-rove.json";
import durfeeHillContactMap from "./2026-05-29-durfee-hill-wildlife-management-area-pota.json";

export const CONTACT_MAPS = {
  "2026-05-27-black-hut-wildlife-management-area-pota": blackHutContactMap,
  "2026-05-29-durfee-hill-wildlife-management-area-pota": durfeeHillContactMap,
  "2026-05-30-east-bay-pota-rove": eastBayRoveContactMap,
} as const;

export function contactMapForNote(noteId: string) {
  return CONTACT_MAPS[noteId as keyof typeof CONTACT_MAPS];
}

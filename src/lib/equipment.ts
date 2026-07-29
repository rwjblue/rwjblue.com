import { getCollection, type CollectionEntry } from "astro:content";

export type EquipmentEntry = CollectionEntry<"equipment">;
export type EquipmentCategory = EquipmentEntry["data"]["category"];

export interface EquipmentCategoryDefinition {
  id: EquipmentCategory;
  label: string;
  description: string;
}

export const EQUIPMENT_CATEGORIES: EquipmentCategoryDefinition[] = [
  {
    id: "radios",
    label: "Radios",
    description: "Home-station and portable transceivers.",
  },
  {
    id: "antennas",
    label: "Antennas",
    description: "The main radiating systems used at home and in the field.",
  },
  {
    id: "keys",
    label: "CW keys",
    description: "Desk and portable paddles used for CW operating.",
  },
  {
    id: "power",
    label: "Power",
    description: "Power supplies and batteries that materially shape a setup.",
  },
  {
    id: "supports",
    label: "Supports",
    description: "Reusable masts and mounting systems for field antennas.",
  },
  {
    id: "test-equipment",
    label: "Test equipment",
    description: "Tools used to measure, troubleshoot, and repeat station work.",
  },
];

const categoryOrder = new Map(
  EQUIPMENT_CATEGORIES.map((category, index) => [category.id, index]),
);

export function compareEquipment(
  left: EquipmentEntry,
  right: EquipmentEntry,
): number {
  return (
    (categoryOrder.get(left.data.category) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right.data.category) ?? Number.MAX_SAFE_INTEGER) ||
    left.data.sortOrder - right.data.sortOrder ||
    left.data.name.localeCompare(right.data.name)
  );
}

export async function getEquipment(): Promise<EquipmentEntry[]> {
  return (await getCollection("equipment")).sort(compareEquipment);
}

export function equipmentByCategory(
  entries: EquipmentEntry[],
): Array<EquipmentCategoryDefinition & { entries: EquipmentEntry[] }> {
  return EQUIPMENT_CATEGORIES.map((category) => ({
    ...category,
    entries: entries.filter((entry) => entry.data.category === category.id),
  })).filter((category) => category.entries.length > 0);
}

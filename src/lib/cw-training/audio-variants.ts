import catalog from "../../data/cw-training/audio-variants.json" with { type: "json" };
import type { TrainingCourse, TrainingResource, TrainingTask } from "./types.ts";

export type AudioSpeedPreference = "assigned" | "next";
export interface AudioVariant extends TrainingResource {
  format: "audio";
  speedWpm: number;
}

const groupsByUrl = new Map<string, AudioVariant[]>();
for (const group of catalog.groups as { id: string; variants: AudioVariant[] }[]) {
  for (const variant of group.variants) groupsByUrl.set(variant.url, group.variants);
}

/** Only an exact verified URL identifies a group, never a similar filename. */
export function audioVariants(resource: Pick<TrainingResource, "url"> | undefined): AudioVariant[] {
  return (resource && groupsByUrl.get(resource.url) || []).map((variant) => ({ ...variant }));
}

export function selectAudioVariant(
  resource: TrainingResource | undefined,
  assignedWpm: number | undefined,
  preference: AudioSpeedPreference,
  overrideWpm?: number,
): (TrainingResource & { speedWpm?: number }) | undefined {
  if (!resource || resource.format !== "audio" || resource.unresolved) return resource;
  const variants = audioVariants(resource);
  if (!variants.length || !Number.isFinite(assignedWpm) || assignedWpm! <= 0) return resource;
  const selected = overrideWpm !== undefined
    ? variants.find((variant) => variant.speedWpm === overrideWpm && overrideWpm >= assignedWpm!)
    : preference === "next"
      ? variants.find((variant) => variant.speedWpm > assignedWpm!)
      : variants.find((variant) => variant.url === resource.url);
  if (!selected) return resource;
  return selected.url === resource.url
    ? { ...resource, speedWpm: selected.speedWpm, ...(selected.durationSeconds ? { durationSeconds: selected.durationSeconds } : {}) }
    : selected;
}

/** Projection only: assignment identity, prescribed speed, and source stay intact. */
export function courseWithAudioVariants(
  course: TrainingCourse,
  preference: AudioSpeedPreference,
  overrides: Readonly<Record<string, number>> = {},
): TrainingCourse {
  const resources = new Map(course.resources.map((resource) => [resource.id, resource]));
  const assignedResources = new Map(resources);
  const assignments = course.assignments.map((assignment) => ({
    ...assignment,
    tasks: assignment.tasks.map((task) => {
      if (task.kind !== "audio") return task;
      const assigned = assignedResources.get(task.resourceId ?? "");
      const selected = selectAudioVariant(assigned, task.speedWpm, preference, overrides[task.id]);
      if (!assigned || !selected) return task;
      resources.set(selected.id, selected);
      return selected.id === assigned.id ? task : { ...task, resourceId: selected.id };
    }),
  }));
  return { ...course, assignments, resources: [...resources.values()] };
}

/** Append to a new record; never derive old practice speed from today's preference. */
export function audioRecordingNote(task: TrainingTask, resource: TrainingResource | undefined): string {
  if (task.kind !== "audio") return "";
  const actual = audioVariants(resource).find((variant) => variant.url === resource?.url);
  const title = actual?.title ?? resource?.title ?? task.title;
  const assigned = Number.isFinite(task.speedWpm) && task.speedWpm! > 0 ? `${task.speedWpm} WPM` : "speed not specified";
  return `Audio recording: ${title}${actual ? ` (${actual.speedWpm} WPM)` : ""}; assigned ${assigned}. Source: ${resource?.url ?? task.sourceUrl}`;
}

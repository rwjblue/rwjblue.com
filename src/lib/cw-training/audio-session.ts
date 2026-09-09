import { audioRecordingNote, audioVariants } from "./audio-variants.ts";
import type { ActiveBlock, AudioRecordingUsage } from "./storage.ts";
import type { TrainingResource } from "./types.ts";
import type { TrainingAudioResult } from "./report-types.ts";

/** The counters on ActiveBlock are cumulative across every recording in it. */
function currentUsage(active: ActiveBlock): AudioRecordingUsage | undefined {
  if (!active.resource) return undefined;
  const archived = (active.audioHistory ?? []).reduce((total, usage) => ({
    activeSeconds: total.activeSeconds + usage.activeSeconds,
    recallSeconds: total.recallSeconds + usage.recallSeconds,
    completedPasses: total.completedPasses + usage.completedPasses,
  }), { activeSeconds: 0, recallSeconds: 0, completedPasses: 0 });
  return {
    resource: { ...active.resource },
    activeSeconds: Math.max(0, active.activeSeconds - archived.activeSeconds),
    recallSeconds: Math.max(0, (active.recallSeconds ?? 0) - archived.recallSeconds),
    completedPasses: Math.max(0, active.completedPasses - archived.completedPasses),
    bookmarks: [...active.bookmarks],
  };
}

/** Repeated visits to one recording do not create an unbounded segment list. */
function mergeUsage(history: readonly AudioRecordingUsage[], current: AudioRecordingUsage | undefined): AudioRecordingUsage[] {
  const byUrl = new Map<string, AudioRecordingUsage>();
  for (const usage of current ? [...history, current] : history) {
    const previous = byUrl.get(usage.resource.url);
    byUrl.set(usage.resource.url, {
      resource: { ...(previous?.resource ?? usage.resource) },
      activeSeconds: (previous?.activeSeconds ?? 0) + usage.activeSeconds,
      recallSeconds: (previous?.recallSeconds ?? 0) + usage.recallSeconds,
      completedPasses: (previous?.completedPasses ?? 0) + usage.completedPasses,
      bookmarks: [...(previous?.bookmarks ?? []), ...usage.bookmarks],
    });
  }
  return [...byUrl.values()];
}

/** Preserve practiced recordings and their verified speeds, including partial and mixed-speed listening. */
export function audioAttemptResults(active: ActiveBlock): TrainingAudioResult[] | undefined {
  if (active.task.kind !== "audio") return undefined;
  const results = mergeUsage(active.audioHistory ?? [], currentUsage(active))
    .filter(usage => usage.resource.format === "audio" && !usage.resource.unresolved
      && (usage.activeSeconds > 0 || usage.completedPasses > 0))
    .map(usage => {
      const recording = audioVariants(usage.resource).find(variant => variant.url === usage.resource.url);
      return {
        url: usage.resource.url,
        title: recording?.title ?? usage.resource.title,
        ...(recording ? { speedWpm: recording.speedWpm } : {}),
        activeSeconds: usage.activeSeconds,
        completedPasses: usage.completedPasses,
      };
    });
  return results.length ? results : undefined;
}

/**
 * Call after settling the player's elapsed time. A new recording starts at its
 * beginning: partial coverage of different files must never combine into a pass.
 */
export function switchAudioRecording(active: ActiveBlock, resource: TrainingResource): ActiveBlock {
  if (active.task.kind !== "audio" || active.resource?.format !== "audio" || active.resource.unresolved
    || resource.format !== "audio" || resource.unresolved || resource.url === active.resource.url
    || !Number.isFinite(active.task.speedWpm) || active.task.speedWpm! <= 0) return active;
  const selected = audioVariants(active.resource).find(variant => variant.url === resource.url
    && variant.speedWpm >= active.task.speedWpm!);
  if (!selected) return active;
  return {
    ...active,
    resource: selected,
    audioHistory: mergeUsage(active.audioHistory ?? [], currentUsage(active)),
    position: 0,
    coverage: [],
    bookmarks: [],
  };
}

/** Legacy blocks keep their original note; mixed-speed blocks include their own marks. */
export function audioSessionNote(active: ActiveBlock): string {
  if (active.audioHistory === undefined || active.task.kind !== "audio") {
    return audioRecordingNote(active.task, active.resource);
  }
  const seconds = (value: number) => Number(value.toFixed(1)).toString();
  const timestamp = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  return mergeUsage(active.audioHistory, currentUsage(active)).map(usage => {
    const marks = usage.bookmarks.filter(value => Number.isFinite(value) && value >= 0);
    const marked = marks.length ? ` Difficult marks: ${marks.slice(0, 8).map(timestamp).join(", ")}${marks.length > 8 ? ` (+${marks.length - 8} more)` : ""}.` : "";
    return `${audioRecordingNote(active.task, usage.resource)}. Practice: ${seconds(usage.activeSeconds)} seconds (includes ${seconds(usage.recallSeconds)} seconds recall); ${usage.completedPasses} completed pass${usage.completedPasses === 1 ? "" : "es"}.${marked}`;
  }).join("\n");
}

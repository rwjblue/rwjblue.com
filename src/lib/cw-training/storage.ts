import type {
  TrainingSnapshot,
  TrainingSync,
  TrainingTask,
  TrainingResource,
} from "./types";
import type { PracticeMode } from "./plan";
import type { RunnerRunState } from "./runner-bridge";
import type { SendingDraft, SendingTake } from "./sending-session";

export interface AudioRecordingUsage {
  resource: TrainingResource;
  /** Practice time includes recallSeconds; it is not listening time alone. */
  activeSeconds: number;
  recallSeconds: number;
  completedPasses: number;
  bookmarks: number[];
}

export interface ActiveBlock {
  id: string;
  assignmentId: string;
  task: TrainingTask;
  resource?: TrainingResource;
  /** Archived recording usage only, grouped by URL. Current usage is total minus this history. */
  audioHistory?: AudioRecordingUsage[];
  startedAt: string;
  targetMinutes: number;
  activeSeconds: number;
  /** Included in activeSeconds; only explicitly timed, paused-audio recall. */
  recallSeconds?: number;
  scratchpad?: string;
  completedPasses: number;
  previousPasses: number;
  targetPasses: number;
  position: number;
  coverage: [number, number][];
  bookmarks: number[];
  context: "practice" | "class";
  review?: boolean;
  /** One uninterrupted embedded contest; elapsed time comes only from its engine. */
  runner?: RunnerRunState;
  runnerRevision?: string;
  /** Optional device-local sending capture; never a source of practice credit. */
  sending?: SendingDraft;
  sendingTakes?: SendingTake[];
}

export interface TrainingDeviceState {
  snapshot?: TrainingSnapshot;
  pending: TrainingSync;
  active?: ActiveBlock;
  reading: Record<string, { line: number; size: number }>;
  dismissed: string[];
  practiceMode?: PracticeMode;
  /** Device-local choices; each active block keeps its own recording snapshot. */
  audioSpeedPreference?: "assigned" | "next";
  audioSpeedOverrides?: Record<string, number>;
  /** Last ten saved takes on this device; only text summaries sync to the account. */
  sendingRecordings?: { attemptId: string; take: SendingTake }[];
}

const databaseName = "n1rwj-cw-training";
const emptyState = (): TrainingDeviceState => ({
  pending: {},
  reading: {},
  dismissed: [],
});

/** One record and a serialized write queue keep timer checkpoints in order. */
export class TrainingStorage {
  private database?: IDBDatabase;
  private writes: Promise<void> = Promise.resolve();
  available = true;

  async load(): Promise<TrainingDeviceState> {
    try {
      this.database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("state");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("Close another training tab to enable storage."));
      });
      const value = await new Promise<TrainingDeviceState | undefined>(
        (resolve, reject) => {
          const request = this.database!.transaction("state")
            .objectStore("state")
            .get("device");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      return value ? { ...emptyState(), ...value } : emptyState();
    } catch {
      this.available = false;
      return emptyState();
    }
  }

  save(state: TrainingDeviceState): Promise<void> {
    const copy = structuredClone(state);
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        if (!this.database) return;
        await new Promise<void>((resolve, reject) => {
          const transaction = this.database!.transaction("state", "readwrite");
          transaction.objectStore("state").put(copy, "device");
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        }).catch(() => {
          this.available = false;
        });
      });
    return this.writes;
  }

  async clear(): Promise<void> {
    await this.writes.catch(() => {});
    if (!this.database) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = this.database!.transaction("state", "readwrite");
      transaction.objectStore("state").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

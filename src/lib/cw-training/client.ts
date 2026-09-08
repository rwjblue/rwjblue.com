import { dateInTimezone, getTrainingPlan, taskProgress } from "./plan";
import type { PlannedTask } from "./plan";
import { listeningGuidance } from "./guidance";
import { audioVariants, courseWithAudioVariants, selectAudioVariant } from "./audio-variants";
import { audioSessionNote, switchAudioRecording } from "./audio-session";
import { createTrainingNavigation, type TrainingView } from "./navigation";
import { isMorseRunner, morseRunnerSetup, MORSE_RUNNER_GUIDE_URL, WEB_MORSE_RUNNER_URL, MORSE_RUNNER_RESULTS_PROMPT } from "./morse-runner";
import { practiceTimeSummary, timedPracticeDelta } from "./practice-time";
import { DEFAULT_OTHER_PRACTICE_ID, OTHER_PRACTICE_ACTIVITIES, OTHER_PRACTICE_ASSIGNMENT_ID, otherPracticeActivity } from "./other-practice";
import { createRunnerRun, reduceRunnerEvent, runnerConfigureCommand, runnerResultNote, runnerSettings, runnerStopCommand } from "./runner-bridge";
import { restartRunnerBlock, runnerAssignmentProgress, runnerMetadata } from "./runner-session";
import { practiceHistoryForDate, renderPracticeHistory } from "./history";
import runnerVersion from "../../../public/vendor/web-morse-runner/UPSTREAM.json";
import { TrainingStorage } from "./storage";
import type { ActiveBlock, TrainingDeviceState } from "./storage";
import type {
  Difficulty,
  MaterialUsage,
  TrainingAttempt,
  TrainingMaterial,
  TrainingSnapshot,
  TrainingSync,
  TrainingTask,
  TrainingResource,
} from "./types";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const safeUrl = (value?: string) => {
  if (!value) return "";
  try {
    const url = new URL(value, location.origin);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
};
const validUserUrl = (value: string) =>
  /^https?:\/\//i.test(value) && !!safeUrl(value);
const link = (url: string | undefined, label: string, className = "") =>
  safeUrl(url)
    ? `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noreferrer" class="${className}">${escapeHtml(label)}</a>`
    : "";
const runnerGuideLink = (task: TrainingTask) => isMorseRunner(task)
  ? `<p>${link(MORSE_RUNNER_GUIDE_URL, "CWops Morse Runner CE guide (PDF)")}</p>` : "";
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const usageNames: Record<MaterialUsage, string> = {
  preparation: "Prepare before class",
  class: "Use during class",
  reference: "Reference",
  unknown: "Not sure yet",
};
const DEFAULT_BLOCK_MINUTES = 15;
const unique = <T extends { id: string }>(first: T[], second: T[]) => [
  ...new Map([...first, ...second].map((item) => [item.id, item])).values(),
];

export async function initTraining() {
  const root = document.querySelector<HTMLElement>("#cw-training");
  if (!root) return;
  if (navigator.locks) {
    const ownsDevice = await new Promise<boolean>((resolve) => {
      void navigator.locks.request(
        "n1rwj-cw-training-writer",
        { ifAvailable: true },
        async (lock) => {
          resolve(!!lock);
          if (lock) await new Promise<void>(() => {});
        },
      );
    });
    if (!ownsDevice) {
      const message = root.querySelector<HTMLElement>("#training-message")!;
      message.hidden = false;
      message.textContent =
        "Training is already open in another tab. Continue there, or close that tab and reload this page, so saved practice cannot be overwritten.";
      root.querySelector<HTMLElement>("#training-sync-state")!.textContent =
        "Already open in another tab";
      return;
    }
  }
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const audio = $<HTMLAudioElement>("training-audio");
  const storage = new TrainingStorage();
  let state: TrainingDeviceState = await storage.load();
  let view: TrainingView = "today";
  let running = false;
  let recalling = false;
  let todayTime: { date: string; savedSeconds: number; goal: number; savedIds: Set<string> } | undefined;
  let lastClock = performance.now();
  let lastAudioPosition = 0;
  let lastAudioClock = performance.now();
  let seeking = false;
  let audioReady = false;
  let audioGeneration = 0;
  let mountedBlock: string | undefined;
  let runnerFrame: HTMLIFrameElement | undefined;
  let runnerTimeout: ReturnType<typeof setTimeout> | undefined;
  let runnerFinishPending = false;
  let syncing = false;
  let authorized = true;
  let connectionKnown = false;
  let readingMaterial: TrainingMaterial | undefined;
  let importedFilename: string | undefined;
  let lastSaved = 0;
  let disposed = false;
  const snapshot = () => state.snapshot!;
  const audioMatchesActive = () => state.active?.task.kind === "audio" &&
    !!state.active.resource?.url && audio.currentSrc === safeUrl(state.active.resource.url);
  const audioPreference = () => state.audioSpeedPreference === "next" ? "next" as const : "assigned" as const;
  const practiceCourse = () => courseWithAudioVariants(snapshot().course, audioPreference(), state.audioSpeedOverrides);
  const plan = () =>
    getTrainingPlan(
      practiceCourse(),
      snapshot().attempts,
      new Date(),
      null,
      "anything",
      snapshot().preferences.carriedTasks,
    );
  const formatMeeting = (date: string, long = false) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: snapshot().course.timezone,
      weekday: long ? "long" : "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(date));
  const notice = (message: string, auth = false) => {
    $("training-message").hidden = !message;
    $("training-message").innerHTML =
      `${escapeHtml(message)}${auth ? ' <a href="/api/cw-training/login">Sign in to sync</a>' : ""}`;
  };
  const status = () => {
    const pending =
      (state.pending.attempts?.length ?? 0) +
      (state.pending.materials?.length ?? 0) +
      Number(!!state.pending.preferences);
    $("training-sync-state").textContent = !storage.available
      ? "Device storage unavailable"
      : syncing
        ? "Syncing"
        : pending
          ? `${pending} update${pending === 1 ? "" : "s"} saved on this device`
          : !navigator.onLine
            ? "Offline · saved on this device"
            : !connectionKnown
              ? "Connection not confirmed"
              : authorized
                ? state.active ? "History synced · current block on this device" : "Saved and synced"
                : "Sign in to sync";
  };
  const persist = async () => {
    if (disposed) return;
    await storage.save(state);
    if (!storage.available)
      notice(
        "This browser cannot save training data locally. Keep this page open until your practice syncs, or export your data before leaving.",
      );
    status();
    $("training-scratchpad-status").textContent = storage.available
      ? "Autosaved on this device. Finish and save the block to sync notes with history."
      : "Device storage unavailable. Keep this page open and finish and save the block to sync your notes.";
  };
  const mergeSnapshot = (remote: TrainingSnapshot) => {
    if (state.snapshot && state.snapshot.userId !== remote.userId)
      throw new Error(
        "This device has another account's training data. Export and clear this device before signing in with a different account.",
      );
    state.snapshot = {
      ...remote,
      attempts: unique(remote.attempts, state.pending.attempts ?? []),
      materials: unique(remote.materials, state.pending.materials ?? []),
      preferences:
        state.pending.preferences &&
        state.pending.preferences.updatedAt > remote.preferences.updatedAt
          ? state.pending.preferences
          : remote.preferences,
    };
  };
  const request = async (path: string, body?: TrainingSync) => {
    let response: Response;
    try {
      response = await fetch(`/api/cw-training/${path}`, {
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        ...(body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {}),
      });
    } catch {
      connectionKnown = false;
      throw new Error(
        "Could not connect to training sync. If you are online, renew your sign-in and try again. Your local practice is safe.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      authorized = false;
      throw new Error(
        "Your sign-in needs renewing. Your local practice is safe.",
      );
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(
        response.status === 503
          ? "Your training service is being prepared. Try again shortly."
          : `Sync could not finish (${response.status}). ${typeof detail.error === "string" ? detail.error : "Your local practice is safe."}`,
      );
    }
    authorized = true;
    connectionKnown = true;
    return response.json();
  };
  async function sync() {
    if (syncing || !state.snapshot || !navigator.onLine || disposed) return;
    syncing = true;
    status();
    try {
      while (
        (state.pending.materials?.length ?? 0) ||
        (state.pending.attempts?.length ?? 0) ||
        state.pending.preferences
      ) {
        // Import materials first so attempts can reference an acknowledged resource.
        const batch: TrainingSync = state.pending.materials?.length
          ? { materials: state.pending.materials.slice(0, 1) }
          : {
              // Full scratchpads can expand sixfold when JSON-escaped. Keep
              // offline batches below the API's 1 MiB request limit.
              attempts: state.pending.attempts?.slice(0, 10),
              preferences: state.pending.preferences,
            };
        const remote = await request("sync", batch);
        if (disposed) return;
        const ids = new Set(batch.attempts?.map((attempt) => attempt.id));
        const materialIds = new Set(
          batch.materials?.map((material) => material.id),
        );
        state.pending.attempts = state.pending.attempts?.filter(
          (attempt) => !ids.has(attempt.id),
        );
        state.pending.materials = state.pending.materials?.filter(
          (material) => !materialIds.has(material.id),
        );
        if (
          batch.preferences?.updatedAt === state.pending.preferences?.updatedAt
        )
          delete state.pending.preferences;
        if (remote.course) mergeSnapshot(remote);
        await persist();
      }
      notice("");
    } catch (error) {
      notice(
        error instanceof Error
          ? error.message
          : "Sync is unavailable. Your local practice is safe.",
        !authorized || (!connectionKnown && navigator.onLine),
      );
    } finally {
      syncing = false;
      if (!disposed) {
        status();
        render();
      }
    }
  }
  const currentMaterials = () =>
    snapshot().materials.filter(
      (item) =>
        !snapshot().materials.some((newer) => newer.supersedesId === item.id),
    );
  const materialTask = (material: TrainingMaterial): TrainingTask => ({
    id: material.id,
    kind: "sending",
    title: material.title,
    instructions: material.text || "Follow the instructor's linked material.",
    sourceUrl: material.url || "",
    minutes: DEFAULT_BLOCK_MINUTES,
  });
  const materialComplete = (material: TrainingMaterial) =>
    snapshot().attempts.some(
      (attempt) =>
        attempt.taskId === material.id &&
        attempt.completed &&
        attempt.context === "practice",
    );
  const findTask = (taskId: string) => {
    for (const assignment of snapshot().course.assignments) {
      const task = assignment.tasks.find((item) => item.id === taskId);
      if (task) return { assignment, task };
    }
    return undefined;
  };
  const assignmentLabel = (assignment: PlannedTask["assignment"]) =>
    `Session ${assignment.session} · Day ${assignment.day} · ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${assignment.date}T12:00:00Z`))}`;
  const assignedResource = (task: TrainingTask) => {
    const original = findTask(task.id)?.task ?? task;
    return snapshot().course.resources.find((resource) => resource.id === original.resourceId);
  };
  const selectedRecording = (task: TrainingTask) => selectAudioVariant(assignedResource(task), task.speedWpm, audioPreference(), state.audioSpeedOverrides?.[task.id]);
  const recordingLabel = (task: TrainingTask, resource?: TrainingResource) => {
    if (task.kind !== "audio") return "";
    const actual = audioVariants(resource).find((variant) => variant.url === resource?.url);
    return actual
      ? `Practicing ${actual.speedWpm} WPM${task.speedWpm ? ` · assigned ${task.speedWpm} WPM` : ""}`
      : resource?.title ?? task.title;
  };
  const speedChoice = (task: TrainingTask, inFocus = false) => {
    if (task.kind !== "audio") return "";
    const resource = assignedResource(task);
    if (resource?.unresolved || !task.speedWpm) return "";
    const choices = audioVariants(resource).filter((variant) => variant.speedWpm >= task.speedWpm!);
    if (choices.length < 2) return "";
    const defaultVariant = selectAudioVariant(resource, task.speedWpm, audioPreference());
    const defaultSpeed = choices.find((variant) => variant.url === defaultVariant?.url)?.speedWpm ?? task.speedWpm;
    const override = choices.some((variant) => variant.speedWpm === state.audioSpeedOverrides?.[task.id]) ? state.audioSpeedOverrides?.[task.id] : undefined;
    if (state.active?.task.id === task.id) {
      const selected = choices.find((variant) => variant.url === state.active?.resource?.url)?.speedWpm;
      if (selected === undefined) return "";
      return `<label class="training-speed-choice">${inFocus ? "Recording speed" : `Current ${state.active.review ? "review" : "block"} speed for ${escapeHtml(task.title)}`}<select data-active-audio-speed="${escapeHtml(task.id)}"${inFocus ? ' aria-describedby="training-focus-speed-help"' : ""}>${choices.map((variant) => `<option value="${variant.speedWpm}"${variant.speedWpm === selected ? " selected" : ""}>${variant.speedWpm} WPM${variant.speedWpm === task.speedWpm ? " (assigned)" : " (stretch)"}${variant.durationSeconds ? ` · ${time(variant.durationSeconds)} per pass` : ""}</option>`).join("")}</select></label>`;
    }
    return `<label class="training-speed-choice">Recording speed for ${escapeHtml(task.title)}<select data-audio-speed="${escapeHtml(task.id)}"><option value=""${override === undefined ? " selected" : ""}>Use default (${defaultSpeed} WPM)</option>${choices.map((variant) => `<option value="${variant.speedWpm}"${override === variant.speedWpm ? " selected" : ""}>${variant.speedWpm} WPM${variant.speedWpm === task.speedWpm ? " (assigned)" : " (stretch)"}${variant.durationSeconds ? ` · ${time(variant.durationSeconds)} per pass` : ""}</option>`).join("")}</select></label>`;
  };
  const progressMarkup = (task: TrainingTask, review = false) => {
    const active = state.active?.task.id === task.id && !!state.active.review === review ? state.active : undefined;
    if (active)
      return `<span class="training-progress-badge">Current ${review ? "review" : "block"}</span><p>${time(active.activeSeconds)} in this block · saved on this device${active.task.kind === "audio" ? ` · ${active.completedPasses} passes this block` : ""}</p>${active.runner ? `<p>${escapeHtml(runnerProgressText(active))}</p>` : ""}`;
    if (review) return "";
    const progress = taskProgress(task, snapshot().attempts);
    if (isMorseRunner(task) && task.minutes) {
      const remaining = Math.max(0, task.minutes * 60 - progress.activeSeconds);
      return `<span class="training-progress-badge">${progress.complete ? "Assignment satisfied" : progress.started ? "Started" : "Cumulative practice"}</span><p class="training-saved-progress">${time(progress.activeSeconds)} / ${time(task.minutes * 60)} recorded${remaining ? ` · ${time(remaining)} remaining` : ""}. Separate runs add up.</p>`;
    }
    if (!progress.started || progress.complete) return "";
    const passes = task.kind === "audio"
      ? `${progress.completedPasses}${task.minimumPasses ? ` of ${task.minimumPasses} required` : ""} pass${progress.completedPasses === 1 && !task.minimumPasses ? "" : "es"} saved · `
      : "";
    return `<span class="training-progress-badge">Started</span><p class="training-saved-progress">${passes}${time(progress.activeSeconds)} practiced</p>`;
  };
  function runnerEnded(active = state.active): boolean {
    return !!active?.runner && ["completed", "stopped", "error"].includes(active.runner.status);
  }
  function runnerProgressText(active: ActiveBlock): string {
    if (active.context === "class") return "Class use is separate from independent practice.";
    if (active.review) return "Optional review adds to today's practice time, not required assignment time.";
    const progress = runnerAssignmentProgress(active, snapshot().attempts);
    return `${time(progress.savedSeconds)} previously recorded + ${time(progress.currentSeconds)} this run · ${time(progress.totalSeconds)} / ${time(progress.requiredSeconds)} assigned.${progress.complete ? " Assignment time reached; save this run to record it." : ` ${time(Math.max(0, progress.requiredSeconds - progress.totalSeconds))} remaining. Separate runs add up.`}`;
  }
  const blockDescription = (item: PlannedTask) => {
    const active = state.active?.task.id === item.task.id ? state.active : undefined;
    if (active?.task.kind === "audio" && active.resource?.durationSeconds)
      return `${recordingLabel(active.task, active.resource)} · ${time(active.resource.durationSeconds)} per pass · current ${active.review ? "review" : "block"}`;
    return item.task.kind === "audio" && Number.isFinite(item.resource?.durationSeconds) && (item.resource?.durationSeconds ?? 0) > 0
      ? `${recordingLabel(item.task, item.resource)} · ${time(item.resource!.durationSeconds!)} per pass · ${item.passesThisBlock ?? 1} pass${item.passesThisBlock === 1 ? "" : "es"} planned`
      : isMorseRunner(item.task)
        ? `${item.suggestedMinutes}-minute run. ${item.extra ? "Each run keeps its own results." : "Shorter runs count toward the cumulative assignment time."}`
        : item.task.kind === "simulator" ? `${item.suggestedMinutes}-minute uninterrupted run` : "Practice at your own pace; save the time you use.";
  };
  const buttons = (taskId: string, missed = false, unavailable = false, carried = false) => {
    const current = state.active?.task.id === taskId && !state.active.review;
    const task = findTask(taskId)?.task;
    const progress = task ? taskProgress(task, snapshot().attempts) : undefined;
    const started = progress?.started && !progress.complete;
    const label = current ? runnerEnded() ? "View results" : "Return to block"
      : task && isMorseRunner(task) && started ? "Start another run"
        : started ? "Continue practice" : missed ? "Practice now" : "Practice";
    return `<div class="training-actions">${missed ? `<button type="button" data-carry="${escapeHtml(taskId)}">Add to today</button>` : ""}<button type="button" ${current ? 'data-action="resume"' : `data-start="${escapeHtml(taskId)}"`} ${unavailable && !current ? 'disabled title="This live activity needs an eligible event window"' : ""}>${label}</button><button type="button" data-manual="${escapeHtml(taskId)}">Done elsewhere</button>${missed ? `<button type="button" data-miss="${escapeHtml(taskId)}">Dismiss reminder</button>` : ""}${carried ? `<button type="button" data-uncarry="${escapeHtml(taskId)}">Remove from today</button>` : ""}</div>`;
  };
  const taskRow = (item: PlannedTask, missed = false) =>
    `<div class="training-task${!item.extra && item.started ? " training-task-started" : ""}"><div><strong>${escapeHtml(item.task.title)}</strong>${progressMarkup(item.task, !!item.extra)}<p>${item.carried ? "Added from " : ""}${escapeHtml(assignmentLabel(item.assignment))}${item.task.speedWpm ? ` · ${item.task.speedWpm} WPM` : ""}${item.extra ? " · Optional review" : item.remainingPasses !== undefined ? ` · ${item.remainingPasses} pass${item.remainingPasses === 1 ? "" : "es"} remaining` : ""}</p><p>${escapeHtml(blockDescription(item))}</p>${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}${
      item.windows?.length
        ? `<p>Eligible CWT windows: ${item.windows
            .slice(0, 3)
            .map((window) =>
              escapeHtml(formatMeeting(window.start.toISOString())),
            )
            .join("; ")}</p>`
        : ""
    }${speedChoice(item.task)}${runnerGuideLink(item.task)}</div>${item.extra ? `<button type="button" data-review="${escapeHtml(item.task.id)}">Extra review</button>` : buttons(item.task.id, missed, item.task.kind === "live" && !item.availableNow, item.carried)}</div>`;

  const navigation = createTrainingNavigation(window, (next) => {
    if (disposed) return;
    const leavingPractice = view === "focus" && next !== "focus" && !!state.active;
    if (leavingPractice) {
      // Settle the last observed audio/timer interval before hiding practice.
      // A queued end-of-pass event must not restart audio after navigation.
      runnerFinishPending = false;
      trackAudioProgress();
      finishAudioPass(false);
      if (state.active?.runner?.status === "running") stopRunner();
      stopTimer();
      audio.pause();
      void persist();
    }
    root.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((dialog) => dialog.close());
    applyView(next);
    // Current-block cards must reflect the latest engine time and terminal state.
    if (state.snapshot) render();
    if (leavingPractice) notice(state.active?.runner
      ? "Your run is saved on this device. Its practiced time counts toward the assignment; view results and save it to history."
      : "Your block is saved and paused. Choose Return to block when ready.");
    root.querySelector<HTMLButtonElement>(`.training-tabs [data-view="${next}"]`)?.focus({ preventScroll: true });
  });
  view = navigation.view;
  function setView(next: string) {
    navigation.navigate(next);
  }
  function applyView(next: TrainingView) {
    view = next;
    for (const name of ["today", "focus", "week", "materials"])
      $(`training-${name}`).hidden = name !== view;
    root!
      .querySelectorAll<HTMLButtonElement>(".training-tabs [data-view]")
      .forEach((button) => {
        if (button.dataset.view === view)
          button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
  }
  function render() {
    if (!state.snapshot) return;
    // Speed selectors are rendered in several views. Keep keyboard focus on
    // the same exercise in the same section when its recording is changed.
    const focused = document.activeElement;
    const speedAttribute = focused?.hasAttribute("data-active-audio-speed") ? "data-active-audio-speed"
      : focused?.hasAttribute("data-audio-speed") ? "data-audio-speed" : undefined;
    const focusedSection = speedAttribute ? focused?.parentElement?.closest<HTMLElement>("[id]") : undefined;
    const focusedTask = speedAttribute ? focused?.getAttribute(speedAttribute) : undefined;
    // Keep the user's place in Week when speed choices or sync rerender it.
    const weekDetails = [...$("training-meetings").querySelectorAll<HTMLDetailsElement>("details")];
    const expandedWeekDetails = new Set(weekDetails.flatMap((detail, index) => detail.open ? [index] : []));
    $("training-app").hidden = false;
    $("training-auth").hidden = true;
    const course = practiceCourse();
    const current = getTrainingPlan(course, snapshot().attempts, new Date(), null, "anything", snapshot().preferences.carriedTasks);
    const assignment = current.assignment;
    $<HTMLSelectElement>("training-audio-preference").value = audioPreference();
    const meeting =
      current.phase === "class"
        ? current.meeting
        : (current.nextMeeting ?? current.meeting);
    $("training-course-title").textContent = course.title;
    $("training-position").textContent = assignment
      ? `Session ${assignment.session} · Day ${assignment.day}`
      : current.phase === "complete"
        ? "Course complete"
        : "Your practice rhythm";
    $("training-day-title").textContent =
      current.phase === "class"
        ? "Time for class"
        : current.phase === "rest"
          ? "Room to rest or review"
          : current.phase === "complete"
            ? "Keep your CW moving"
            : "Today's practice";
    $("training-class-time").textContent = meeting
      ? `${current.phase === "class" ? "Class now" : "Next class"}: ${formatMeeting(meeting.startsAt)} · 1 hour`
      : "Your training history stays here.";
    todayTime = {
      date: dateInTimezone(new Date(), course.timezone),
      savedSeconds: current.practicedMinutes * 60,
      goal: current.dailyGoalMinutes,
      savedIds: new Set(snapshot().attempts.map((attempt) => attempt.id)),
    };
    $<HTMLProgressElement>("training-progress").max =
      current.dailyGoalMinutes || course.dailyGoalMinutes;
    updateTodayTime();
    const session = meeting?.session ?? assignment?.session;
    const materials = currentMaterials().filter(
      (item) => item.session === session,
    );
    const preparation = materials.filter(
      (material) =>
        material.usage === "preparation" && !materialComplete(material),
    );
    const added = [...current.queue, ...current.blocked].filter((item) => item.carried);
    const todayQueue = current.queue.filter((item) => !item.carried && item.assignment.date === current.date);
    const todayBlocked = current.blocked.filter((item) => !item.carried && item.assignment.date === current.date);
    const earlierQueue = current.queue.filter((item) => !item.carried && item.assignment.date < current.date);
    const earlierBlocked = current.blocked.filter((item) => !item.carried && item.assignment.date < current.date);
    const earlierRemaining = earlierQueue.length + earlierBlocked.length;
    const todayRemaining = todayQueue.length + todayBlocked.length;
    const remaining = todayRemaining + added.length + earlierRemaining + preparation.length;
    $("training-coverage").textContent = remaining
      ? `${todayRemaining} scheduled exercise${todayRemaining === 1 ? "" : "s"} remaining${added.length ? ` · ${added.length} added to today` : ""}${earlierRemaining ? ` · ${earlierRemaining} earlier unfinished` : ""}${preparation.length ? ` · ${preparation.length} instructor preparation` : ""}.`
      : current.phase === "practice"
        ? "Today's assignments are complete. Keep practicing if you like."
        : current.phase === "class"
          ? "Class time does not count toward your independent practice hour."
          : "Extra practice is optional. Review a familiar exercise for as long as it is useful.";
    const next = current.next;
    const activeAssignment = state.active ? findTask(state.active.task.id)?.assignment : undefined;
    $("training-next").innerHTML = state.active
      ? `<p class="eyebrow">Current block${activeAssignment ? ` · ${escapeHtml(assignmentLabel(activeAssignment))}` : ""}</p><h3>${escapeHtml(state.active.task.title)}</h3><p>${time(state.active.activeSeconds)} practiced. ${activeAssignment && activeAssignment.date < current.date ? "This is earlier preparation, not today's assignment. " : ""}${state.active.runner ? "Saved on this device; save the run to add its results to history. Each new run starts a fresh score." : "Resume where you stopped, or record this partial block to choose another activity."}</p>${state.active.runner ? `<p>${escapeHtml(runnerProgressText(state.active))}</p>` : ""}<div class="training-actions"><button type="button" class="primary" data-action="resume">${runnerEnded() ? "View results" : state.active.runner ? "Return to runner" : "Resume your block"}</button><button type="button" data-action="finish">${state.active.runner ? "Save run & notes" : "Record block and switch"}</button></div>`
      : next
        ? `<p class="eyebrow">${next.extra ? "Extra practice" : next.carried ? "Added to today" : next.assignment.date === current.date ? "Suggested for today" : "Earlier preparation"} · ${escapeHtml(next.task.kind)}${next.task.speedWpm ? ` · ${next.task.speedWpm} WPM` : ""}</p><h3>${escapeHtml(next.task.title)}</h3>${progressMarkup(next.task, !!next.extra)}<p>${escapeHtml(assignmentLabel(next.assignment))}</p><p>${escapeHtml(blockDescription(next))}</p>${next.reason ? `<p>${escapeHtml(next.reason)}</p>` : ""}${next.extra ? '<p class="training-small">This optional block adds practice minutes without changing required assignment progress.</p>' : next.carried ? '<p class="training-small">You added this exercise to today. Progress still belongs to its original assignment.</p>' : next.assignment.date < current.date ? '<p class="training-small">The available exercises for today are complete. This earlier preparation is here if you want it.</p>' : ""}<button type="button" class="primary" ${next.extra ? "data-review" : "data-start"}="${escapeHtml(next.task.id)}">${next.started && !next.extra ? "Continue" : "Start"} ${next.task.kind === "audio" ? "listening" : "practice"}</button>`
        : `<p class="eyebrow">${current.phase === "class" ? "Class materials are ready below" : "A little breathing room"}</p><h3>${remaining ? "Plan your next practice window" : "Your next action is yours."}</h3><p>${remaining ? "The remaining exercises need an eligible event window or a resource check. Review the details below." : current.phase === "rest" ? "Rest today, review an earlier exercise, or prepare with your instructor's material." : "Review the week, open class materials, or log practice completed elsewhere."}</p><div class="training-actions"><button type="button" data-view="week">View the course</button>${current.phase === "class" && snapshot().preferences.joinUrl ? link(snapshot().preferences.joinUrl, "Join class", "training-button primary") : ""}</div>`;
    if (!state.active && current.phase !== "class" && preparation.length && (!next || next.extra || next.task.optional))
      $("training-next").innerHTML =
        `<p class="eyebrow">Instructor preparation · Session ${preparation[0].session}</p><h3>${escapeHtml(preparation[0].title)}</h3><p>This additional preparation is due before class. Its exact duration depends on the instructor's instructions.</p><button type="button" class="primary" data-practice-material="${preparation[0].id}">Start preparation</button>`;
    if (!state.active && next && isMorseRunner(next.task)) {
      const startButton = $("training-next").querySelector<HTMLButtonElement>("button[data-start], button[data-review]");
      if (startButton) startButton.textContent = `${next.started && !next.extra ? "Start another" : "Start a"} ${next.suggestedMinutes}-minute run`;
    }
    if (state.active) {
      $("training-next").querySelector(".training-actions")?.insertAdjacentHTML("beforebegin", speedChoice(state.active.task));
    } else if (next) {
      const startButton = $("training-next").querySelector("button[data-start], button[data-review]");
      startButton?.insertAdjacentHTML("beforebegin", speedChoice(next.task));
    }
    $("training-queue").innerHTML = todayQueue.length
      ? todayQueue.map((item) => taskRow(item)).join("")
      : `<p class="training-small">${todayRemaining ? "The remaining assignments need a resource check or live event. See below." : current.phase === "practice" ? "Today's assignments are complete. Extra practice is ready below." : "No required practice is scheduled right now."}</p>`;
    $("training-carried-panel").hidden = !added.length;
    $("training-carried").innerHTML = added.map((item) => taskRow(item)).join("");
    const blockedWasOpen = $("training-blocked").querySelector("details")?.open;
    $("training-blocked").innerHTML = todayBlocked.length
      ? `<details class="training-panel"${blockedWasOpen ? " open" : ""}><summary>Needs a resource or live event (${todayBlocked.length})</summary><div class="training-panel-body">${todayBlocked.map((item) => taskRow(item)).join("")}</div></details>`
      : "";
    $("training-earlier-panel").hidden = !earlierRemaining;
    $("training-earlier-label").textContent = `Earlier unfinished preparation (${earlierRemaining})`;
    $("training-earlier").innerHTML = [...earlierQueue, ...earlierBlocked].map((item) => taskRow(item, true)).join("");
    $("training-regular-practice").innerHTML = [
      current.runnerReview && { item: current.runnerReview, title: "Morse Runner", description: "Practice calls and exchanges. Adjust speed, duration, and conditions before Run." },
      current.lcwoReview && { item: current.lcwoReview, title: "LCWO", description: "Practice instant character recognition. Keep your current course settings handy in Focus." },
    ].filter((entry) => !!entry).map(({ item, title, description }) => {
      const active = state.active?.task.id === item.task.id && !!state.active.review;
      return `<div class="training-practice-card"><h4>${title}</h4><p class="training-small">${description}</p><button type="button" ${active ? 'data-action="resume"' : `data-review="${escapeHtml(item.task.id)}"`}>${active ? runnerEnded() ? "View results" : `Return to ${title}` : `Practice ${title}`}</button></div>`;
    }).join("");
    $("training-extra-panel").hidden = !current.extras.length;
    $("training-extra").innerHTML = current.extras.slice(0, 3).map((item) => taskRow(item)).join("");
    const missed = current.missed.filter(
      (item) => !state.dismissed.includes(item.task.id),
    );
    $("training-missed-panel").hidden = !missed.length;
    $("training-missed-label").textContent =
      `Unfinished work from previous classes (${missed.length})`;
    $("training-missed").innerHTML =
      '<p class="training-small">Your schedule has moved on. Add to today puts an exercise in today\'s list without starting it. Practice now starts a block immediately. Dismiss reminder only hides this reminder; it does not mark the exercise complete. You do not need to dismiss everything.</p>' +
      missed.map((item) => taskRow(item, true)).join("");
    $("training-assignment-label").textContent = assignment
      ? `Session ${assignment.session}, day ${assignment.day}`
      : "Course overview";
    $("training-assignment-instructions").textContent =
      assignment?.instructions ??
      "Choose a class in Week to read its daily assignments.";
    const source = $<HTMLAnchorElement>("training-assignment-source");
    source.href = safeUrl(assignment?.sourceUrl ?? course.sourceUrl);
    $("training-course-instructions").textContent = course.instructions;
    $<HTMLAnchorElement>("training-course-source").href = safeUrl(
      course.sourceUrl,
    );
    $<HTMLSelectElement>("training-calendar-duration").value = String(snapshot().preferences.blockMinutes);
    if (document.activeElement !== $("training-reminder-time"))
      $<HTMLInputElement>("training-reminder-time").value =
        snapshot().preferences.reminderTime;
    if (document.activeElement !== $("training-join-url"))
      $<HTMLInputElement>("training-join-url").value =
        snapshot().preferences.joinUrl ?? "";
    $("training-preparation").innerHTML = materials.length
      ? `<div class="training-section"><h3>For your next class</h3>${materials.map((material) => `<div class="training-task"><div><strong>${escapeHtml(material.title)}</strong><p>${usageNames[material.usage]}${materialComplete(material) ? " · Preparation recorded" : ""}</p></div><div class="training-actions"><button type="button" data-material="${material.id}">Open material</button>${material.usage === "preparation" && !materialComplete(material) ? `<button type="button" data-practice-material="${material.id}">Start preparation</button>` : ""}</div></div>`).join("")}</div>`
      : "";
    $("training-meetings").innerHTML = course.meetings
      .map(
        (item) =>
          `<details class="training-meeting"><summary>Session ${item.session}<span>${escapeHtml(formatMeeting(item.startsAt))} · 1 hour</span></summary>${course.assignments
            .filter((day) => day.session === item.session)
            .map(
              (day) =>
                `<details><summary>Day ${day.day} · ${escapeHtml(day.date)}</summary><div class="training-original">${escapeHtml(day.instructions)}</div>${link(day.sourceUrl, "Original assignment")}${day.tasks
                  .map((task) => {
                    const progress = taskProgress(task, snapshot().attempts);
                    const live = current.liveUpcoming.find(
                      (item) => item.task.id === task.id,
                    );
                    return `<div class="training-task"><div><strong class="${progress.complete ? "training-completed" : ""}">${progress.complete ? "Completed · " : ""}${escapeHtml(task.title)}</strong>${progressMarkup(task)}${runnerGuideLink(task)}<details><summary>Instructions</summary><div class="training-original">${escapeHtml(task.instructions)}</div>${task.settings ? `<div class="training-original">${escapeHtml(task.settings)}</div>` : ""}${link(task.sourceUrl, "Official source")}</details>${speedChoice(task)}</div>${buttons(task.id, false, task.kind === "live" && !live?.availableNow)}</div>`;
                  })
                  .join("")}</details>`,
            )
            .join("")}</details>`,
      )
      .join("");
    $("training-meetings").querySelectorAll<HTMLDetailsElement>("details").forEach((detail, index) => {
      if (expandedWeekDetails.has(index)) detail.open = true;
    });
    const upcoming = current.liveUpcoming ?? [];
    if (upcoming.length)
      $("training-meetings").insertAdjacentHTML(
        "afterbegin",
        `<div class="training-notice"><h3>Upcoming on-air work</h3><p>Plan around a live operating window before the class deadline.</p>${link("/radio/cw-practice/", "CWT times and exchange guidance")}${upcoming.map((item) => taskRow(item)).join("")}</div>`,
      );
    const historyOptions = {
      course: snapshot().course,
      materials: snapshot().materials,
      pendingIds: new Set((state.pending.attempts ?? []).map((attempt) => attempt.id)),
    };
    const todayHistory = practiceHistoryForDate(snapshot().attempts, current.date, snapshot().course.timezone);
    const savedMinutes = todayHistory.reduce((sum, attempt) => sum + Math.max(0, attempt.activeSeconds), 0) / 60;
    $("training-today-history-summary").textContent = todayHistory.length
      ? `${todayHistory.length} session${todayHistory.length === 1 ? "" : "s"} · ${Number(savedMinutes.toFixed(1))} min saved`
      : "No saved sessions yet";
    for (const [id, attempts, includeDate] of [
      ["training-today-history", todayHistory, false],
      ["training-history", [...snapshot().attempts].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 100), true],
    ] as const) {
      const container = $(id);
      const expandedIds = new Set([...container.querySelectorAll<HTMLDetailsElement>("details[data-history-id][open]")].map((detail) => detail.dataset.historyId!));
      container.innerHTML = renderPracticeHistory(attempts, { ...historyOptions, expandedIds, includeDate });
    }
    $("training-material-list").innerHTML =
      currentMaterials()
        .sort((a, b) => a.session - b.session)
        .map(
          (material) =>
            `<div class="training-task"><div><strong>${escapeHtml(material.title)}</strong><p>Session ${material.session} · ${usageNames[material.usage]}${material.filename ? ` · ${escapeHtml(material.filename)}` : ""}</p></div><div class="training-actions"><button type="button" data-material="${material.id}">Open</button><button type="button" data-revise-material="${material.id}">Add revision</button></div></div>`,
        )
        .join("") ||
      '<div class="training-card"><h3>A place for the next email.</h3><p>Paste instructions, import a text file, or save a link. Keep unclassified material as “Not sure yet” until its purpose is clear.</p></div>';
    renderActive();
    applyView(view);
    status();
    if (focusedSection && speedAttribute && focusedTask && !focused?.isConnected) {
      focusedSection.querySelector<HTMLSelectElement>(`[${speedAttribute}="${CSS.escape(focusedTask)}"]`)?.focus({ preventScroll: true });
    }
  }

  function renderActive() {
    const active = state.active;
    $("training-focus-empty").hidden = !!active;
    $("training-focus-content").hidden = !active;
    if (!active) {
      unmountRunner();
      running = false;
      recalling = false;
      mountedBlock = undefined;
      audioGeneration++;
      audioReady = false;
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    $("training-focus-kind").textContent =
      `${active.review ? "Extra review · " : ""}${active.task.kind}${active.task.speedWpm ? ` · ${active.task.speedWpm} WPM` : ""}${active.context === "class" ? " · Class use (not practice minutes)" : ""}`;
    $("training-focus-title").textContent = active.task.title;
    $("training-recording-label").textContent = recordingLabel(active.task, active.resource);
    const focusSpeedChoice = speedChoice(active.task, true);
    $("training-focus-speed").innerHTML = focusSpeedChoice;
    $("training-focus-speed-help").hidden = !focusSpeedChoice;
    $("training-focus-objective").textContent = active.review
      ? "Optional reinforcement using the original exercise below. These minutes count, but required assignment progress stays unchanged."
      : active.task.alternative
      ? `Alternative allowed by the curriculum: ${active.task.alternative}`
      : "Follow the exercise instructions below. This block autosaves on this device until you finish and save it.";
    $("training-focus-target").textContent =
      `${active.task.kind === "simulator" ? `${active.targetMinutes}-minute run` : "At your own pace"}${active.task.objectiveCount ? ` · Objective: ${active.task.objectiveCount}` : ""}`;
    if (active.task.kind === "audio" && active.resource?.durationSeconds) {
      $("training-focus-target").textContent = `${active.targetPasses}-pass block · ${time(active.resource.durationSeconds)} per pass`;
      $("training-focus-kind").textContent = `${active.review ? "Extra review · " : ""}Audio · ${recordingLabel(active.task, active.resource)}${active.context === "class" ? " · Class use (not practice minutes)" : ""}`;
    }
    $("training-focus-instructions").textContent = active.task.instructions;
    $("training-focus-settings").textContent = active.task.settings ?? "";
    const runner = morseRunnerSetup(active.task);
    $("training-runner-guidance").hidden = !runner;
    if (runner) {
      $("training-runner-run").textContent = runner.run;
      $("training-runner-mode").textContent = runner.mode;
      $("training-runner-conditions").textContent = runner.conditions;
    }
    const source = $<HTMLAnchorElement>("training-focus-source");
    source.hidden = !safeUrl(active.task.sourceUrl);
    source.href = safeUrl(active.task.sourceUrl);
    const isAudio =
      active.task.kind === "audio" &&
      !!active.resource?.url &&
      !active.resource.unresolved;
    $("training-audio-box").hidden = !isAudio;
    $("training-timer-box").hidden = isAudio || !!active.runner;
    $("training-runner-embedded").hidden = !active.runner;
    $("training-runner-external-help").hidden = !!active.runner;
    if (active.runner) renderRunner();
    const guidance = listeningGuidance(active.task);
    $("training-listening-guidance").hidden = !guidance;
    $("training-scratchpad-panel").hidden = !guidance;
    if (guidance) {
      $("training-listening-approach").textContent = `${guidance.title}: ${guidance.approach}`;
      $("training-listening-passes").textContent =
        `This ${active.review ? "review " : ""}block targets ${active.targetPasses} whole pass${active.targetPasses === 1 ? "" : "es"}. You may pause and resume; skipping audio does not complete a pass. Follow the original instructions and your instructor's directions.`;
      $("training-scratchpad-prompt").textContent = guidance.scratchpadPrompt;
    }
    $("training-focus-resource").innerHTML = runner
      ? `${active.runner ? '<p class="training-small">If the embedded runner is unavailable, save this block as partial, practice externally, then use Done elsewhere to record that separate run.</p>' : ""}${link(WEB_MORSE_RUNNER_URL, "Open standalone Web Morse Runner", "training-button")}`
      : active.resource?.unresolved
      ? `<p class="training-notice">${escapeHtml(active.resource.unresolved)} Read the source or ask your instructor before choosing a substitute.</p>`
      : `${link(active.resource?.url || (active.task.kind !== "audio" ? active.task.sourceUrl : undefined), isAudio ? "Open official audio separately" : "Open practice resource", "training-button")}${active.task.kind === "live" ? ` ${link("/radio/cw-practice/", "CWT schedule and exchanges", "training-button")}` : ""}`;
    if (active.task.kind === "icr")
      $("training-focus-resource").insertAdjacentHTML(
        "afterbegin",
        `<p>${link("https://lcwo.net/", "Open LCWO", "training-button primary")} ${link("https://morsecode.world/international/trainer/character.html", "Open ICR trainer", "training-button")} ${link("https://morsecode.world/international/trainer/words.html", "Word trainer", "training-button")}</p><p class="training-small">Use CW Academy material, 25 WPM character speed, and ${active.task.speedWpm ?? 10} WPM effective speed. Follow the original guidelines below for word length and progression.</p>`,
      );
    if (mountedBlock !== active.id) {
      audioGeneration++;
      audioReady = false;
      seeking = false;
      lastAudioPosition = 0;
      lastAudioClock = performance.now();
      mountedBlock = active.id;
      $<HTMLTextAreaElement>("training-scratchpad").value = active.scratchpad ?? "";
      $<HTMLDetailsElement>("training-scratchpad-panel").open = true;
      $("training-audio-state").textContent = "Paused. Tap play to listen, or start recall to time focused thinking and notes.";
      if (isAudio) {
        audio.defaultPlaybackRate = 1;
        audio.playbackRate = 1;
        audio.src = safeUrl(active.resource!.url);
        audio.load();
      } else {
        audio.removeAttribute("src");
        audio.load();
      }
      const material = snapshot().materials.find(
        (item) => item.id === active.task.id,
      );
      const text = material?.text || active.resource?.text;
      $("training-focus-text").hidden = !text;
      $("training-sending-text").textContent = text ?? "";
      const reading = state.reading[active.task.id];
      $("training-sending-text").style.fontSize = `${reading?.size ?? 26}px`;
      $<HTMLInputElement>("training-focus-font").value = String(
        reading?.size ?? 26,
      );
      requestAnimationFrame(() => {
        $("training-sending-text").scrollTop = reading?.line ?? 0;
      });
      if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined")
        navigator.mediaSession.metadata = new MediaMetadata({
          title: active.task.kind === "audio" ? active.resource?.title ?? active.task.title : active.task.title,
          artist: "CW Academy practice",
          album: snapshot().course.title,
        });
    }
    updateClock();
  }
  function unmountRunner() {
    clearTimeout(runnerTimeout);
    runnerTimeout = undefined;
    runnerFrame?.remove();
    runnerFrame = undefined;
    runnerFinishPending = false;
  }
  function restartRunner() {
    if (!state.active) return;
    let restarted;
    try {
      restarted = restartRunnerBlock(state.active, crypto.randomUUID(), new Date().toISOString(), runnerVersion.revision, snapshot().attempts);
    } catch {
      notice("Could not start a new run. Nothing was cleared. Use Finish block to review and save this run first.");
      return;
    }
    if (!restarted) return;
    // A fresh frame/run identity rejects late messages from the stopped engine.
    unmountRunner();
    state.active = restarted.active;
    running = false;
    recalling = false;
    // Queue the old attempt and the new block in the same device checkpoint.
    if (restarted.attempt) void record(restarted.attempt);
    else void persist();
    render();
    notice(restarted.attempt
      ? "Previous run saved to history. Your new run has a fresh timer and score. Adjust settings and click Run when ready."
      : "Fresh run ready to set up. Adjust settings and click Run when ready.");
    $("training-runner-status").focus();
  }
  function renderRunner() {
    const active = state.active;
    const run = active?.runner;
    if (!active || !run) return;
    const messages = {
      loading: "Loading the pinned runner and assignment settings...",
      ready: "Ready. Adjust the settings, enter your station Call, and choose a comfortable Pitch. Click Run inside the simulator to start; setup time does not count.",
      running: "Run in progress. You can change WPM while practicing. Actual engine time is recorded automatically. Keep this page visible; leaving Focus, switching apps, or stopping ends this run as partial.",
      completed: "Run complete. Results are saved on this device. Save and start a new run below, or Finish block to add notes and save to history.",
      stopped: "Run stopped. Its practiced time still counts. Results are saved on this device. Save and start a new run below, or Finish block to add notes and save to history.",
      error: "The run could not continue. Its last confirmed time is preserved as partial. Start a new run below, or Finish block to save and stop here.",
    };
    const actualWpm = run.speedHistory?.at(-1)?.wpm ?? run.settings.wpm;
    $("training-focus-kind").textContent = `${active.review ? "Extra review" : "Simulator"} · ${actualWpm} WPM${!active.review && active.task.speedWpm ? ` · assigned ${active.task.speedWpm} WPM` : ""}${active.context === "class" ? " · Class use (not practice minutes)" : ""}`;
    $("training-focus-target").textContent = `${run.settings.durationSeconds / 60}-minute run${!active.review && active.task.minutes ? ` · assigned ${active.task.minutes} minutes total` : ""}`;
    $("training-runner-status").textContent = messages[run.status];
    const ended = ["completed", "stopped", "error"].includes(run.status);
    $("training-runner-restart-actions").hidden = !ended;
    $("training-runner-restart").textContent = run.elapsedSeconds >= 1 || run.summary?.qsoCount || active.scratchpad
      ? "Save & start new run" : "Start new run";
    $("training-runner-result").hidden = !ended;
    $("training-runner-result").textContent = runnerResultNote(run) ?? "";
    if (!runnerFrame && run.status === "loading") {
      const frame = document.createElement("iframe");
      frame.title = "Web Morse Runner practice simulator";
      frame.className = "training-runner-frame";
      frame.allow = "autoplay";
      frame.addEventListener("load", () => {
        if (runnerFrame !== frame || state.active?.runner?.runId !== run.runId) return;
        frame.contentWindow?.postMessage(runnerConfigureCommand(run), location.origin);
      });
      runnerFrame = frame;
      frame.src = "/vendor/web-morse-runner/";
      $("training-runner-frame-host").append(frame);
      runnerTimeout = setTimeout(() => failRunner(run.runId), 20000);
    }
    if (run.status === "error") {
      runnerFrame?.remove();
      runnerFrame = undefined;
    }
  }
  function failRunner(runId: string) {
    const active = state.active;
    if (!active?.runner || active.runner.runId !== runId || ["completed", "stopped", "error"].includes(active.runner.status)) return;
    active.runner = { ...active.runner, status: "error", errorCode: "interrupted" };
    active.activeSeconds = active.runner.elapsedSeconds;
    clearTimeout(runnerTimeout);
    renderRunner();
    updateClock();
    void persist();
    if (runnerFinishPending) { runnerFinishPending = false; finish(); }
  }
  function stopRunner() {
    const run = state.active?.runner;
    if (!run || ["completed", "stopped", "error"].includes(run.status)) return;
    if (run.status === "loading") { failRunner(run.runId); return; }
    runnerFrame?.contentWindow?.postMessage(runnerStopCommand(run), location.origin);
    clearTimeout(runnerTimeout);
    runnerTimeout = setTimeout(() => failRunner(run.runId), 2000);
  }
  window.addEventListener("message", (event) => {
    const active = state.active;
    if (disposed || !active?.runner || !runnerFrame || event.source !== runnerFrame.contentWindow || event.origin !== location.origin) return;
    const previous = active.runner;
    const next = reduceRunnerEvent(previous, event.data);
    if (next === previous) return;
    active.runner = next;
    active.activeSeconds = next.elapsedSeconds;
    if (next.status === "running") active.targetMinutes = next.settings.durationSeconds / 60;
    if (next.status !== "loading" && next.status !== "running") clearTimeout(runnerTimeout);
    // A ready frame must not start a hidden/previous-day block, even if its
    // click and the parent's visibility event crossed in the message queue.
    if (next.status === "running" && (document.hidden || view !== "focus" || !allowActiveDate())) stopRunner();
    const changed = next.status !== previous.status || next.speedHistory !== previous.speedHistory;
    if (changed) {
      if (view === "focus") renderRunner();
      else render();
    }
    updateClock();
    if (changed || Date.now() - lastSaved > 5000) {
      lastSaved = Date.now();
      void persist();
    }
    if (runnerFinishPending && ["completed", "stopped", "error"].includes(next.status)) {
      runnerFinishPending = false;
      finish();
    }
  });
  function updateTodayTime() {
    if (!todayTime || !state.snapshot) return;
    const totals = practiceTimeSummary(todayTime.savedSeconds, state.active,
      todayTime.date, snapshot().course.timezone, todayTime.savedIds);
    $("training-minutes").textContent = todayTime.goal
      ? `${Math.round(totals.totalSeconds / 60)} / ${todayTime.goal} min`
      : `${Math.round(totals.totalSeconds / 60)} min · optional practice`;
    const currentPractice = state.active?.context === "practice" &&
      dateInTimezone(state.active.startedAt, snapshot().course.timezone) === todayTime.date &&
      !todayTime.savedIds.has(state.active.id);
    $("training-time-breakdown").textContent = currentPractice
      ? `${time(totals.savedSeconds)} saved + ${time(totals.currentSeconds)} current block (on this device). Finish and save to add it to history.`
      : `${time(totals.savedSeconds)} saved practice today.${state.active?.context === "class" ? " Class time is separate." : ""}`;
    const progress = $<HTMLProgressElement>("training-progress");
    progress.value = Math.min(totals.totalSeconds / 60, progress.max);
  }
  function updateClock() {
    updateTodayTime();
    if (!state.active) return;
    $("training-timer").textContent = time(state.active.activeSeconds);
    $("training-timer-toggle").textContent = running
      ? "Pause timer"
      : "Resume timer";
    const active = state.active;
    if (active.runner) $("training-runner-progress").textContent = runnerProgressText(active);
    $("training-recall-toggle").textContent = recalling ? "Pause recall" : "Start recall";
    $("training-recall-toggle").setAttribute("aria-pressed", String(recalling));
    $("training-recall-time").textContent = `${time(active.recallSeconds ?? 0)} recall included in active practice${recalling ? " · timing now" : ""}`;
    $("training-pass-count").textContent =
      `${active.completedPasses} of ${active.targetPasses} passes this block complete${active.previousPasses ? ` · ${active.previousPasses} recorded earlier` : ""}`;
    $("training-bookmarks").innerHTML = active.bookmarks
      .map(
        (mark, index) =>
          `<button type="button" data-seek="${mark}" aria-label="Replay difficult mark ${index + 1} at ${time(mark)}">${time(mark)}</button>`,
      )
      .join("");
  }
  function settleTimer(audioPlaying = !audio.paused) {
    const now = performance.now();
    const elapsed = (now - lastClock) / 1000;
    lastClock = now;
    if (!state.active || state.active.runner) return;
    const delta = timedPracticeDelta(elapsed, {
      running, visible: !document.hidden, kind: state.active.task.kind,
      recalling, audioPlaying,
    });
    state.active.activeSeconds += delta.activeSeconds;
    if (delta.recallSeconds)
      state.active.recallSeconds = (state.active.recallSeconds ?? 0) + delta.recallSeconds;
    if (delta.interrupted) {
      running = false;
      recalling = false;
      if (state.active.task.kind === "audio")
        $("training-audio-state").textContent = "Recall paused after an interruption. Resume listening or start recall when ready.";
      notice("The timer paused after an interruption. Confirm any additional practice minutes when finishing.");
    }
  }
  function stopTimer(audioPlaying = !audio.paused) {
    const wasRecalling = recalling;
    settleTimer(audioPlaying);
    running = false;
    recalling = false;
    if (wasRecalling)
      $("training-audio-state").textContent = "Paused. Resume listening or start recall when ready.";
    updateClock();
  }
  function pause() {
    stopRunner();
    stopTimer();
    audio.pause();
    void persist();
    updateClock();
  }
  async function play(): Promise<void> {
    if (!allowActiveDate()) return;
    stopTimer();
    const generation = audioGeneration;
    const blockId = state.active?.id;
    try {
      await audio.play();
      if (generation !== audioGeneration || state.active?.id !== blockId || audio.paused) return;
      $("training-audio-state").textContent =
        "Listening. Pause whenever you need a break.";
    } catch {
      if (generation !== audioGeneration || state.active?.id !== blockId) return;
      $("training-audio-state").textContent =
        "Tap the player's play button to continue. If audio is unavailable, use the official source link.";
    }
  }
  function start(item: PlannedTask) {
    if (state.active) {
      setView("focus");
      notice(
        "Finish or save the current block before starting another exercise.",
      );
      return;
    }
    if (item.resource?.unresolved) {
      notice(item.resource.unresolved);
      return;
    }
    if (item.task.kind === "live" && !item.availableNow) {
      notice(
        item.reason ??
          "This activity needs an eligible on-air event window. Check the upcoming schedule, or record practice already completed elsewhere.",
      );
      return;
    }
    const targetMinutes = Math.max(
      item.suggestedMinutes,
      item.task.kind === "simulator" && !isMorseRunner(item.task) && !item.extra ? (item.task.minutes ?? 15) : 0,
    );
    running = false;
    recalling = false;
    state.active = {
      id: crypto.randomUUID(),
      assignmentId: item.assignment.id,
      task: findTask(item.task.id)?.task ?? item.task,
      resource: item.resource,
      startedAt: new Date().toISOString(),
      targetMinutes,
      activeSeconds: 0,
      completedPasses: 0,
      previousPasses: item.completedPasses,
      targetPasses:
        item.passesThisBlock ?? Math.max(1, item.remainingPasses ?? 1),
      position: 0,
      coverage: [],
      bookmarks: [],
      context: "practice",
      ...(item.extra ? { review: true } : {}),
    };
    const settings = runnerSettings(state.active.task);
    if (settings) {
      settings.durationSeconds = targetMinutes * 60;
      state.active.runner = createRunnerRun(state.active.id, settings);
      state.active.runnerRevision = runnerVersion.revision;
    }
    render();
    setView("focus");
    void persist();
    if (item.task.kind === "audio" && item.resource?.url) void play();
    else if (!state.active.runner) {
      running = true;
      lastClock = performance.now();
      updateClock();
    }
  }
  function startTask(taskId: string) {
    const current = plan();
    const planned = [
      ...current.queue,
      ...current.blocked,
      ...current.missed,
      ...(current.liveUpcoming ?? []),
    ].find((item) => item.task.id === taskId);
    if (planned) {
      start(planned);
      return;
    }
    const found = findTask(taskId);
    if (!found) return;
    const resource = found.task.kind === "audio" ? selectedRecording(found.task) : assignedResource(found.task);
    const progress = taskProgress(found.task, snapshot().attempts);
    start({
      ...found,
      resource,
      completedPasses: progress.completedPasses,
      remainingPasses: found.task.minimumPasses
        ? Math.max(0, found.task.minimumPasses - progress.completedPasses)
        : undefined,
      suggestedMinutes:
        isMorseRunner(found.task)
          ? progress.complete ? (DEFAULT_BLOCK_MINUTES)
            : Math.min(DEFAULT_BLOCK_MINUTES, Math.max(1, Math.ceil(((found.task.minutes ?? 15) * 60 - progress.activeSeconds) / 60)))
          : found.task.kind === "simulator"
          ? (found.task.minutes ?? 15)
          : found.task.kind === "audio" && resource?.durationSeconds
          ? Math.ceil(resource.durationSeconds / 60)
          : (DEFAULT_BLOCK_MINUTES),
      passesThisBlock: found.task.kind === "audio" ? 1 : undefined,
      ...(isMorseRunner(found.task) && progress.complete ? { extra: true } : {}),
      interrupted: progress.interrupted,
    });
  }
  function startMaterial(material: TrainingMaterial, classUse = false) {
    if (state.active) {
      setView("focus");
      notice(
        "Your current block is saved. Finish it before starting another exercise.",
      );
      return;
    }
    recalling = false;
    running = false;
    state.active = {
      id: crypto.randomUUID(),
      assignmentId: `material:${material.id}`,
      task: materialTask(material),
      startedAt: new Date().toISOString(),
      targetMinutes: DEFAULT_BLOCK_MINUTES,
      activeSeconds: 0,
      completedPasses: 0,
      previousPasses: 0,
      targetPasses: 0,
      position: 0,
      coverage: [],
      bookmarks: [],
      context: classUse ? "class" : "practice",
    };
    render();
    setView("focus");
    running = true;
    lastClock = performance.now();
    void persist();
  }
  async function record(attempt: TrainingAttempt) {
    snapshot().attempts = unique(snapshot().attempts, [attempt]);
    state.pending.attempts = unique(state.pending.attempts ?? [], [attempt]);
    await persist();
    render();
    void sync();
  }
  function finish() {
    if (!state.active) return;
    if (state.active.runner && ["loading", "ready", "running"].includes(state.active.runner.status)) {
      runnerFinishPending = true;
      stopRunner();
      return;
    }
    pause();
    $<HTMLFormElement>("training-finish-form").reset();
    $<HTMLInputElement>("training-finish-minutes").value = (
      Math.round(state.active.activeSeconds / 6) / 10
    ).toString();
    const active = state.active;
    $("training-finish-back").textContent = active.runner ? "Back to results" : "Keep practicing";
    $<HTMLInputElement>("training-finish-minutes").readOnly = !!active.runner;
    const recording = active.runner ? runnerMetadata(active) : audioSessionNote(active);
    $("training-finish-recording").hidden = !recording;
    $("training-finish-recording").textContent = recording ? `Saved automatically with this entry: ${recording}` : "";
    const marks = !active.audioHistory && active.bookmarks.length ? `Difficult audio marks: ${active.bookmarks.map(time).join(", ")}` : "";
    $<HTMLTextAreaElement>("training-finish-note").maxLength = Math.max(0, 4000 - recording.length - marks.length - 50);
    $("training-finish-recall-label").hidden = active.task.kind !== "audio";
    $<HTMLInputElement>("training-finish-recall").value = String(Math.round((active.recallSeconds ?? 0) / 6) / 10);
    $("training-finish-scratchpad").hidden = !active.scratchpad;
    $<HTMLTextAreaElement>("training-finish-note").placeholder = isMorseRunner(active.task) ? MORSE_RUNNER_RESULTS_PROMPT : "";
    $("training-finish-title").textContent =
      active.context === "class" ? "Record class use" : active.review ? "Record extra review" : "Finish this block";
    $("training-finish-complete-label").textContent = active.review
      ? "I completed this review block"
      : "I completed this exercise's requirements";
    const complete = $<HTMLInputElement>("training-finish-complete");
    const minimumPasses = active.review ? active.targetPasses : active.task.minimumPasses;
    const passReady =
      !minimumPasses ||
      active.previousPasses + active.completedPasses >=
        minimumPasses;
    complete.disabled = active.task.kind === "audio" && !passReady;
    complete.checked =
      active.task.kind === "audio"
        ? !!minimumPasses && passReady
        : active.activeSeconds >=
          (active.task.minutes ?? active.targetMinutes) * 60;
    if (active.runner) {
      const ready = active.review ? active.runner.status === "completed" : runnerAssignmentProgress(active, snapshot().attempts).complete;
      // Assignment satisfaction is derived from cumulative time, not a manual checkbox.
      complete.disabled = !active.review || !ready;
      complete.checked = ready;
      if (!active.review) $("training-finish-complete-label").textContent = ready
        ? "Assignment time satisfied when this run is saved"
        : "Assignment time still remaining (short runs count)";
    }
    $("training-finish-help").textContent = active.review
      ? `Extra practice time is saved separately from required coverage.${active.task.kind === "audio" ? ` ${active.completedPasses} fully played passes this block; partial listening still counts as time.` : " Confirm any minutes practiced away from this page."}`
      : active.task.kind === "audio"
        ? `${active.completedPasses} fully played pass${active.completedPasses === 1 ? "" : "es"} this block. ${!passReady ? "More assigned passes remain; this partial block is still useful." : "Confirm completion when you have met the listening objective."}`
        : "Correct the time if you practiced while away from this page. Mark complete only when you met the assigned objective.";
    if (active.runner) $("training-finish-help").textContent = active.review
      ? "Review time and actual settings are saved automatically. A shorter review is fine; it never completes a required assignment."
      : `${runnerProgressText(active)} Engine time, settings, and this run's score are recorded when you save. Separate runs keep separate results.`;
    $<HTMLDialogElement>("training-finish-dialog").showModal();
  }

  function activeDateMatches(): boolean {
    return !state.active || !state.snapshot ||
      dateInTimezone(state.active.startedAt, snapshot().course.timezone) ===
      dateInTimezone(new Date(), snapshot().course.timezone);
  }
  function allowActiveDate(): boolean {
    if (activeDateMatches()) return true;
    running = false;
    recalling = false;
    audio.pause();
    notice(
      "This saved block belongs to an earlier practice day. Record its practiced minutes first, then start a new block so today's time is credited correctly.",
    );
    if (!$<HTMLDialogElement>("training-finish-dialog").open) finish();
    return false;
  }

  audio.addEventListener("loadedmetadata", () => {
    if (!state.active || !audioMatchesActive() || audio.readyState < 1) return;
    audio.currentTime = Math.min(
      state.active.position,
      Math.max(0, audio.duration - 0.1),
    );
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    audioReady = true;
  });
  audio.addEventListener("play", () => {
    if (!audioMatchesActive() || audio.paused) return;
    // The native control has flipped paused already, but playback has just started.
    stopTimer(false);
    if (!allowActiveDate()) return;
    void persist();
  });
  audio.addEventListener("playing", () => {
    if (!audioMatchesActive() || audio.paused) return;
    if (!allowActiveDate()) return;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    $("training-audio-state").textContent =
      "Listening. Your position is saved.";
  });
  audio.addEventListener("seeking", () => {
    if (!audioReady || !audioMatchesActive()) return;
    seeking = true;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
  });
  audio.addEventListener("seeked", () => {
    if (!audioReady || !audioMatchesActive()) return;
    seeking = false;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    if (state.active) {
      state.active.position = audio.currentTime;
      void persist();
    }
  });
  audio.addEventListener("waiting", () => {
    if (!audioMatchesActive()) return;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    $("training-audio-state").textContent =
      "Buffering. Waiting time is not counted.";
  });
  audio.addEventListener("pause", () => {
    if (state.active && audioReady && audioMatchesActive()) {
      state.active.position = audio.currentTime;
      if (!audio.ended)
        $("training-audio-state").textContent = recalling
          ? "Audio paused. Recall timer is running. Pause recall when you take a break."
          : "Paused. Break time does not count; start recall to time focused thinking or notes.";
      void persist();
    }
  });
  audio.addEventListener("ratechange", () => {
    if (audio.playbackRate === 1) return;
    audio.playbackRate = 1;
    $("training-audio-state").textContent = "Playback stays at 1x so the recorded WPM stays accurate. Use Recording speed above to choose another official recording when available.";
  });
  audio.addEventListener("error", () => {
    if (!audio.error || state.active?.task.kind !== "audio" || audio.src !== safeUrl(state.active.resource?.url)) return;
    $("training-audio-state").textContent =
      "The official recording could not load. Check your connection or use the source link. Your current progress is saved.";
  });
  function trackAudioProgress() {
    const active = state.active;
    if (!active || !audioReady || !audioMatchesActive()) return;
    // Loading/configuring a paused prior-day block is not new practice.
    if (audio.paused && !activeDateMatches()) return;
    if (!allowActiveDate()) return;
    const position = audio.currentTime;
    const clock = performance.now();
    const advance = position - lastAudioPosition;
    const elapsed = (clock - lastAudioClock) / 1000;
    if (
      !seeking &&
      !audio.seeking &&
      advance > 0 &&
      advance <= elapsed + 0.75
    ) {
      active.activeSeconds += Math.min(advance, elapsed + 0.1);
      const ranges = [
        ...active.coverage,
        [lastAudioPosition, position] as [number, number],
      ].sort((a, b) => a[0] - b[0]);
      active.coverage = ranges.reduce<[number, number][]>((merged, range) => {
        const previous = merged.at(-1);
        if (previous && range[0] <= previous[1] + 0.1)
          previous[1] = Math.max(previous[1], range[1]);
        else merged.push([...range]);
        return merged;
      }, []);
    }
    active.position = position;
    lastAudioPosition = position;
    lastAudioClock = clock;
    updateClock();
    if (Date.now() - lastSaved > 3000) {
      lastSaved = Date.now();
      void persist();
    }
  }
  audio.addEventListener("timeupdate", trackAudioProgress);
  function finishAudioPass(continuePlayback = true) {
    const active = state.active;
    if (!active || !audioReady || !audioMatchesActive() || !audio.ended || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const covered = active.coverage.reduce(
      (total, range) => total + range[1] - range[0],
      0,
    );
    const wholePass =
      Number.isFinite(audio.duration) &&
      covered >= Math.max(0, audio.duration - 1);
    if (wholePass) active.completedPasses++;
    active.position = 0;
    active.coverage = [];
    audio.currentTime = 0;
    lastAudioPosition = 0;
    lastAudioClock = performance.now();
    updateClock();
    void persist();
    if (!continuePlayback || view !== "focus") return;
    if (!wholePass) {
      $("training-audio-state").textContent =
        "Some of this pass was skipped. Listening time is saved, but the full pass is still incomplete. Tap play for another pass.";
      return;
    }
    if (active.completedPasses >= active.targetPasses) {
      $("training-audio-state").textContent =
        "This block's passes are complete. Finish the block, or play again for extra review.";
      return;
    }
    if ($<HTMLInputElement>("training-recall-pause").checked)
      $("training-audio-state").textContent =
        "Take a moment to recall what you heard. Start recall to time it, or tap play for the next pass.";
    else void play();
  }
  audio.addEventListener("ended", () => finishAudioPass());
  if ("mediaSession" in navigator) {
    for (const [action, handler] of Object.entries({
      play: (): void => {
        void play();
      },
      pause: (): void => {
        pause();
      },
      seekbackward: (): void => {
        audio.currentTime = Math.max(0, audio.currentTime - 8);
      },
      seekforward: (): void => {
        if (Number.isFinite(audio.duration))
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 8);
      },
    })) {
      try {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          handler,
        );
      } catch {
        /* The browser may implement only some transport actions. */
      }
    }
  }

  function updateManualActivity() {
    const taskId = $<HTMLSelectElement>("training-manual-task").value;
    const other = otherPracticeActivity(taskId);
    const task = findTask(taskId)?.task;
    const cumulativeRunner = !!task && isMorseRunner(task);
    const passes = $<HTMLInputElement>("training-manual-passes");
    const complete = $<HTMLInputElement>("training-manual-complete");
    $("training-manual-passes-field").hidden = !!other || cumulativeRunner;
    $("training-manual-complete-field").hidden = !!other || cumulativeRunner;
    passes.disabled = !!other || cumulativeRunner;
    complete.disabled = !!other || cumulativeRunner;
    if (other || cumulativeRunner) {
      passes.value = "0";
      complete.checked = false;
    }
    $("training-manual-help").textContent = other
      ? "Counts toward your daily practice time, not curriculum completion."
      : cumulativeRunner ? "Log this run's actual minutes and results. Saved runs add up; the assignment is satisfied automatically when its total practice time is reached."
        : "Log time for this assignment. Mark requirements completed only if you met its instructions.";
    $<HTMLTextAreaElement>("training-manual-note").placeholder = other?.notePlaceholder ?? (task && isMorseRunner(task) ? MORSE_RUNNER_RESULTS_PROMPT : "");
  }
  $("training-manual-task").addEventListener("change", updateManualActivity);
  function manual(taskId?: string) {
    $<HTMLFormElement>("training-manual-form").reset();
    $<HTMLSelectElement>("training-manual-task").innerHTML =
      `<optgroup label="Other practice">${OTHER_PRACTICE_ACTIVITIES.map((activity) => `<option value="${activity.id}">${escapeHtml(activity.title)}</option>`).join("")}</optgroup>` +
      snapshot()
        .course.assignments.map(
          (assignment) =>
            `<optgroup label="Session ${assignment.session}, day ${assignment.day}">${assignment.tasks.map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.title)}</option>`).join("")}</optgroup>`,
        )
        .join("") +
      `<optgroup label="Instructor preparation">${currentMaterials()
        .filter((material) => material.usage === "preparation")
        .map(
          (material) =>
            `<option value="${material.id}">${escapeHtml(material.title)}</option>`,
        )
        .join("")}</optgroup>`;
    $<HTMLSelectElement>("training-manual-task").value = taskId ?? DEFAULT_OTHER_PRACTICE_ID;
    updateManualActivity();
    $<HTMLDialogElement>("training-manual-dialog").showModal();
  }
  function addMaterial(revision?: TrainingMaterial) {
    const form = $<HTMLFormElement>("training-material-form");
    form.reset();
    importedFilename = undefined;
    delete form.dataset.supersedes;
    $<HTMLSelectElement>("training-material-session").innerHTML = snapshot()
      .course.meetings.map(
        (meeting) =>
          `<option value="${meeting.session}">Session ${meeting.session} · ${escapeHtml(formatMeeting(meeting.startsAt))}</option>`,
      )
      .join("");
    $<HTMLSelectElement>("training-material-session").value = String(
      revision?.session ??
        plan().nextMeeting?.session ??
        plan().meeting?.session ??
        1,
    );
    if (revision) {
      form.dataset.supersedes = revision.id;
      (form.elements.namedItem("title") as HTMLInputElement).value =
        revision.title;
      (form.elements.namedItem("usage") as HTMLSelectElement).value =
        revision.usage;
      (form.elements.namedItem("text") as HTMLTextAreaElement).value =
        revision.text;
      (form.elements.namedItem("url") as HTMLInputElement).value =
        revision.url ?? "";
    }
    $<HTMLDialogElement>("training-material-dialog").showModal();
  }
  function openMaterial(id: string) {
    const material = snapshot().materials.find((item) => item.id === id);
    if (!material) return;
    readingMaterial = material;
    $("training-reading-title").textContent = material.title;
    $("training-reading-usage").textContent =
      `Session ${material.session} · ${usageNames[material.usage]}`;
    $("training-reading-text").textContent =
      material.text || "No text supplied. Open the resource link below.";
    $("training-reading-link").innerHTML = link(
      material.url,
      "Open supplied resource",
      "training-button",
    );
    const reading = state.reading[id] ?? { size: 26, line: 0 };
    $("training-reading-text").style.fontSize = `${reading.size}px`;
    $<HTMLInputElement>("training-reading-size").value = String(reading.size);
    root!.querySelector<HTMLButtonElement>(
      '[data-action="practice-material"]',
    )!.textContent =
      material.usage === "class" ? "Use in class" : "Practice this material";
    $<HTMLDialogElement>("training-reading-dialog").showModal();
    $("training-reading-text").scrollTop = reading.line;
  }

  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action], [data-view], [data-start], [data-review], [data-manual], [data-miss], [data-carry], [data-uncarry], [data-material], [data-revise-material], [data-practice-material], [data-close], [data-seek]",
    );
    if (!button) return;
    if (button.hasAttribute("data-close")) {
      button.closest("dialog")?.close();
      return;
    }
    if (!state.snapshot) return;
    if (button.dataset.review) {
      const current = plan();
      const item = [current.runnerReview, current.lcwoReview, ...current.extras].find((item) => item?.task.id === button.dataset.review);
      if (item) start(item);
      return;
    }
    if (button.dataset.carry || button.dataset.uncarry) {
      const taskId = button.dataset.carry ?? button.dataset.uncarry!;
      const found = findTask(taskId);
      const date = dateInTimezone(new Date(), snapshot().course.timezone);
      if (!found || found.assignment.date > date) return;
      if (button.dataset.carry && taskProgress(found.task, snapshot().attempts).complete) {
        notice("That exercise is already complete. Choose extra review for more practice.");
        return;
      }
      const carriedTasks = (snapshot().preferences.carriedTasks ?? []).filter((item) => item.date === date && item.taskId !== taskId);
      if (button.dataset.carry) {
        if (carriedTasks.length >= 100) { notice("Today's added list is full. Remove an item before adding another."); return; }
        carriedTasks.push({ taskId, date });
        state.dismissed = state.dismissed.filter((id) => id !== taskId);
      }
      snapshot().preferences = { ...snapshot().preferences, carriedTasks, updatedAt: new Date().toISOString() };
      state.pending.preferences = snapshot().preferences;
      render();
      void persist();
      void sync();
      notice(button.dataset.carry
        ? `${found.task.title} added to today's list. No timer started. Choose Practice there when ready; progress stays with ${assignmentLabel(found.assignment)}.`
        : `${found.task.title} removed from today's added list. Its original assignment and practice history are unchanged.`);
      if (button.dataset.carry) $("training-carried-panel").scrollIntoView({ block: "nearest" });
      return;
    }
    if (button.dataset.view) {
      setView(button.dataset.view);
      return;
    }
    if (button.dataset.start) {
      startTask(button.dataset.start);
      return;
    }
    if (button.dataset.manual) {
      manual(button.dataset.manual);
      return;
    }
    if (button.dataset.material) {
      openMaterial(button.dataset.material);
      return;
    }
    if (button.dataset.reviseMaterial) {
      addMaterial(
        snapshot().materials.find(
          (material) => material.id === button.dataset.reviseMaterial,
        ),
      );
      return;
    }
    if (button.dataset.practiceMaterial) {
      const material = snapshot().materials.find(
        (item) => item.id === button.dataset.practiceMaterial,
      );
      if (material) startMaterial(material);
      return;
    }
    if (button.dataset.seek) {
      audio.currentTime = Number(button.dataset.seek);
      void play();
      return;
    }
    if (button.dataset.miss) {
      const found = findTask(button.dataset.miss);
      if (!found) return;
      state.dismissed.push(found.task.id);
      const now = new Date().toISOString();
      void record({
        id: crypto.randomUUID(),
        assignmentId: found.assignment.id,
        taskId: found.task.id,
        startedAt: now,
        endedAt: now,
        activeSeconds: 0,
        completed: false,
        note: "[Left missed]",
        context: "practice",
      });
      return;
    }
    switch (button.dataset.action) {
      case "resume":
        if (!allowActiveDate()) break;
        setView("focus");
        notice(
          state.active?.runner ? "This run is saved on this device. Review the results and save to history, or start it if it has not begun. A finished run cannot resume; each new run has its own score." : "Your saved block is paused. Resume the player or timer when ready.",
        );
        break;
      case "toggle-timer":
        if (state.active?.runner) break;
        if (!allowActiveDate()) break;
        if (running) stopTimer();
        else {
          running = true;
          lastClock = performance.now();
        }
        updateClock();
        void persist();
        break;
      case "toggle-recall":
        if (!state.active || state.active.task.kind !== "audio" || !allowActiveDate()) break;
        if (recalling) {
          stopTimer();
          $("training-audio-state").textContent = "Paused. Resume listening or start recall when ready.";
        } else {
          audio.pause();
          recalling = true;
          running = true;
          lastClock = performance.now();
          $("training-audio-state").textContent = "Audio paused. Recall timer is running. Pause recall when you take a break.";
        }
        updateClock();
        void persist();
        break;
      case "listen":
        void play();
        break;
      case "replay":
        audio.currentTime = Math.max(0, audio.currentTime - 8);
        void play();
        break;
      case "bookmark":
        if (state.active) {
          state.active.bookmarks.push(Math.round(audio.currentTime));
          updateClock();
          void persist();
        }
        break;
      case "finish":
        finish();
        break;
      case "restart-runner":
        restartRunner();
        break;
      case "pause-block":
        pause();
        setView("today");
        render();
        notice(
          state.active?.runner ? "This runner block is saved on this device. Return to Focus to save and start a new run, or Finish block to add notes and stop here." : "Your block is saved and paused. Return when you have a few minutes.",
        );
        break;
      case "manual":
        manual();
        break;
      case "add-material":
        addMaterial();
        break;
      case "practice-material":
        if (readingMaterial) {
          $<HTMLDialogElement>("training-reading-dialog").close();
          startMaterial(readingMaterial, readingMaterial.usage === "class");
        }
        break;
      case "sync":
        void sync();
        break;
      case "calendar-create": {
        $("training-calendar-status").textContent =
          "Creating your private subscription link...";
        void request("calendar-token", {})
          .then((result: { url: string }) => {
            $<HTMLInputElement>("training-calendar-url").value = result.url;
            $("training-calendar-result").hidden = false;
            $("training-calendar-status").textContent =
              "Add this URL as a calendar subscription. Any previous link has been replaced.";
          })
          .catch((error: Error) => {
            $("training-calendar-status").textContent = error.message;
          });
        break;
      }
      case "calendar-copy": {
        const value = $<HTMLInputElement>("training-calendar-url").value;
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            $("training-calendar-status").textContent = "Calendar link copied.";
          })
          .catch(() => {
            $<HTMLInputElement>("training-calendar-url").select();
            $("training-calendar-status").textContent =
              "Select and copy the link above.";
          });
        break;
      }
      case "calendar-revoke": {
        void fetch("/api/cw-training/calendar-token", {
          method: "DELETE",
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
        })
          .then((response) => {
            if (!response.ok)
              throw new Error(
                "Could not revoke the link. Renew your sign-in and try again.",
              );
            $("training-calendar-result").hidden = true;
            $<HTMLInputElement>("training-calendar-url").value = "";
            $("training-calendar-status").textContent =
              "The calendar link is revoked. Its previous subscription can no longer fetch events.";
          })
          .catch((error: Error) => {
            $("training-calendar-status").textContent = error.message;
          });
        break;
      }
      case "save-preferences": {
        const joinUrl = $<HTMLInputElement>("training-join-url").value.trim();
        if (joinUrl && !validUserUrl(joinUrl)) {
          notice(
            "Use a complete http or https class link without embedded credentials.",
          );
          break;
        }
        const reminderTime = $<HTMLInputElement>(
          "training-reminder-time",
        ).value;
        if (!/^\d{2}:\d{2}$/.test(reminderTime)) {
          notice("Choose a valid reminder time.");
          break;
        }
        snapshot().preferences = {
          ...snapshot().preferences,
          blockMinutes: Number($<HTMLSelectElement>("training-calendar-duration").value) as 10 | 15,
          reminderTime,
          joinUrl: joinUrl || undefined,
          updatedAt: new Date().toISOString(),
        };
        state.pending.preferences = snapshot().preferences;
        void persist();
        render();
        void sync();
        break;
      }
      case "export": {
        const blob = new Blob(
          [
            JSON.stringify(
              { exportedAt: new Date().toISOString(), ...state },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `cw-training-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
      case "clear": {
        if (
          !confirm(
            "Clear all training data stored on this device, including any unsynced practice and active block? Synced history remains in your account. Export first if you need a copy.",
          )
        )
          break;
        pause();
        disposed = true;
        void storage.clear().then(() => {
          state = { pending: {}, reading: {}, dismissed: [] };
          audio.removeAttribute("src");
          audio.load();
          $("training-app").hidden = true;
          $("training-auth").hidden = false;
          notice(
            "Training data was cleared from this device. Sign in again to load your synced history.",
          );
        });
        break;
      }
    }
  });
  $<HTMLSelectElement>("training-audio-preference").addEventListener("change", (event) => {
    state.audioSpeedPreference = (event.currentTarget as HTMLSelectElement).value === "next" ? "next" : "assigned";
    render();
    void persist();
    if (state.active) notice("The new default applies to future blocks. Your current recording and its progress are unchanged.");
  });
  root.addEventListener("change", (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement && select.dataset.activeAudioSpeed) {
      const active = state.active;
      if (!active || active.task.id !== select.dataset.activeAudioSpeed) return;
      const resource = audioVariants(active.resource).find((variant) => variant.speedWpm === Number(select.value) && variant.speedWpm >= (active.task.speedWpm ?? Infinity));
      if (!resource || resource.url === active.resource?.url) return;
      // Settle the old recording before resetting its media element. Whole
      // passes survive; partial coverage must never cross recording boundaries.
      trackAudioProgress();
      // load() cancels queued ended events. Credit a just-finished whole pass
      // first; rewinding here also makes any later ended event a no-op.
      finishAudioPass(false);
      pause();
      audioReady = false;
      state.active = switchAudioRecording(active, resource);
      state.audioSpeedOverrides = { ...state.audioSpeedOverrides, [active.task.id]: resource.speedWpm };
      mountedBlock = undefined;
      render();
      $(`training-${view}`).querySelector<HTMLSelectElement>(`[data-active-audio-speed="${CSS.escape(active.task.id)}"]`)?.focus({ preventScroll: true });
      const message = `Changed to ${resource.speedWpm} WPM. ${view === "focus" ? "Tap play" : "Return to your block and tap play"} to start this pass from the beginning. Your time, completed passes, and scratchpad are kept.`;
      $("training-audio-state").textContent = message;
      notice(message);
      void persist();
      return;
    }
    if (!(select instanceof HTMLSelectElement) || !select.dataset.audioSpeed) return;
    const task = findTask(select.dataset.audioSpeed)?.task;
    if (!task || task.kind !== "audio" || !task.speedWpm) return;
    const overrides = { ...state.audioSpeedOverrides };
    if (!select.value) delete overrides[task.id];
    else {
      const wpm = Number(select.value);
      if (!audioVariants(assignedResource(task)).some((variant) => variant.speedWpm === wpm && wpm >= task.speedWpm!)) return;
      overrides[task.id] = wpm;
    }
    state.audioSpeedOverrides = overrides;
    render();
    void persist();
  });
  $<HTMLTextAreaElement>("training-scratchpad").addEventListener("input", (event) => {
    if (!state.active) return;
    state.active.scratchpad = (event.currentTarget as HTMLTextAreaElement).value;
    $("training-scratchpad-status").textContent = "Saving on this device...";
    void persist();
  });
  $<HTMLFormElement>("training-finish-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const active = state.active;
      if (!active) return;
      const data = new FormData(event.currentTarget as HTMLFormElement);
      if (String(data.get("note") || "").includes("\0")) {
        $("training-finish-help").textContent =
          "Remove null characters from the note before saving.";
        return;
      }
      const activeSeconds = active.runner ? Math.floor(active.runner.elapsedSeconds) : Math.round(Number(data.get("minutes")) * 60);
      if (
        !Number.isFinite(activeSeconds) ||
        activeSeconds < 0 ||
        activeSeconds > 14400
      )
        return;
      const recallSeconds = active.task.kind === "audio"
        ? Math.round(Number(data.get("recall")) * 60) : 0;
      if (!Number.isFinite(recallSeconds) || recallSeconds < 0 || recallSeconds > activeSeconds) {
        $("training-finish-help").textContent = "Recall minutes are included in the total. Enter recall time between zero and your total practice time.";
        return;
      }
      if (active.scratchpad && (active.scratchpad.length > 10000 || active.scratchpad.includes("\0"))) {
        $("training-finish-help").textContent = "Keep the scratchpad under 10,000 characters and remove null characters before saving.";
        return;
      }
      let completed = data.get("complete") === "on";
      if (active.runner) completed = active.review
        ? completed && active.runner.status === "completed"
        : runnerAssignmentProgress(active, snapshot().attempts).complete;
      else if (isMorseRunner(active.task) && !active.review && active.context === "practice")
        completed = taskProgress(active.task, snapshot().attempts.filter((attempt) => attempt.id !== active.id)).activeSeconds + activeSeconds >= (active.task.minutes ?? 15) * 60;
      const minimumPasses = active.review ? active.targetPasses : active.task.minimumPasses;
      if (
        active.task.kind === "audio" &&
        minimumPasses &&
        active.previousPasses + active.completedPasses <
          minimumPasses
      )
        completed = false;
      if (
        active.task.kind === "simulator" &&
        !isMorseRunner(active.task) &&
        !active.review &&
        activeSeconds < (active.task.minutes ?? 15) * 60 &&
        completed
      ) {
        $("training-finish-help").textContent =
          `This assigned run requires ${active.task.minutes ?? 15} minutes. Record it as partial or correct the practiced duration.`;
        return;
      }
      const endedAt = new Date();
      const note = [
        active.runner ? runnerMetadata(active) : audioSessionNote(active),
        String(data.get("note") || ""),
        !active.audioHistory && active.bookmarks.length
          ? `Difficult audio marks: ${active.bookmarks.map(time).join(", ")}`
          : "",
        Math.abs(activeSeconds - active.activeSeconds) > 6
          ? "Practice duration confirmed manually."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      if (note.length > 4000) {
        $("training-finish-help").textContent = "This note and its automatic practice details exceed 4,000 characters. Shorten your note before saving; nothing has been discarded.";
        return;
      }
      const attempt: TrainingAttempt = {
        id: active.id,
        assignmentId: active.assignmentId,
        taskId: active.task.id,
        startedAt: new Date(
          Math.min(
            new Date(active.startedAt).getTime(),
            endedAt.getTime() - activeSeconds * 1000,
          ),
        ).toISOString(),
        endedAt: endedAt.toISOString(),
        activeSeconds,
        completed,
        ...(active.task.kind === "audio"
          ? { completedPasses: active.completedPasses, recallSeconds }
          : {}),
        ...(active.scratchpad !== undefined ? { scratchpad: active.scratchpad } : {}),
        ...(data.get("difficulty")
          ? { difficulty: data.get("difficulty") as Difficulty }
          : {}),
        ...(note ? { note } : {}),
        context: active.context,
        ...(active.review ? { review: true } : {}),
      };
      state.active = undefined;
      audio.pause();
      running = false;
      recalling = false;
      $<HTMLDialogElement>("training-finish-dialog").close();
      setView("today");
      void record(attempt);
    },
  );
  $<HTMLFormElement>("training-manual-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const taskId = String(data.get("task"));
      if (String(data.get("note") || "").includes("\0")) {
        notice("Remove null characters from the note before saving.");
        return;
      }
      const found = findTask(taskId);
      const material = snapshot().materials.find((item) => item.id === taskId);
      const other = otherPracticeActivity(taskId);
      if (!found && !material && !other) return;
      const activeSeconds = Math.round(Number(data.get("minutes")) * 60);
      const passes = other ? 0 : Number(data.get("passes"));
      if (
        !Number.isFinite(activeSeconds) ||
        activeSeconds < 0 ||
        activeSeconds > 14400 ||
        !Number.isInteger(passes) ||
        passes < 0 ||
        passes > 100
      )
        return;
      const endedAt = new Date();
      const complete = found && isMorseRunner(found.task)
        ? taskProgress(found.task, snapshot().attempts).activeSeconds + activeSeconds >= (found.task.minutes ?? 15) * 60
        : !other && data.get("complete") === "on";
      if (
        complete &&
        found?.task.kind === "simulator" &&
        !isMorseRunner(found.task) &&
        activeSeconds < (found.task.minutes ?? 15) * 60
      ) {
        notice(
          "A completed simulator run must include the full assigned duration. Save a partial run with Requirements completed unchecked.",
        );
        return;
      }
      void record({
        id: crypto.randomUUID(),
        assignmentId: other ? OTHER_PRACTICE_ASSIGNMENT_ID : found?.assignment.id ?? `material:${material!.id}`,
        taskId,
        startedAt: new Date(
          endedAt.getTime() - activeSeconds * 1000,
        ).toISOString(),
        endedAt: endedAt.toISOString(),
        activeSeconds,
        completed: complete,
        ...(other ? { review: true } : {}),
        ...(passes ? { completedPasses: passes } : {}),
        note: `[Practiced elsewhere] ${String(data.get("note") || "")}`.slice(
          0,
          4000,
        ),
        context: "practice",
      });
      $<HTMLDialogElement>("training-manual-dialog").close();
    },
  );
  $<HTMLInputElement>("training-material-file").addEventListener(
    "change",
    async (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 100000) {
        notice(
          "Please import a text file under 100 KB. Larger or non-text material can be saved as a private link.",
        );
        return;
      }
      $<HTMLTextAreaElement>("training-material-text").value =
        await file.text();
      importedFilename = file.name;
      const title = $<HTMLFormElement>(
        "training-material-form",
      ).elements.namedItem("title") as HTMLInputElement;
      if (!title.value) title.value = file.name;
    },
  );
  $<HTMLFormElement>("training-material-form").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const data = new FormData(form);
      const text = String(data.get("text") || "");
      const url = String(data.get("url") || "").trim();
      const title = String(data.get("title") || "").trim();
      if (
        (!text.trim() && !url) ||
        (url && !validUserUrl(url)) ||
        text.includes("\0") ||
        title.includes("\0") ||
        !title ||
        (importedFilename?.length ?? 0) > 255
      ) {
        notice(
          "Add a title and plain text without null characters, or a complete http or https resource link without embedded credentials. File names must be under 256 characters.",
        );
        return;
      }
      const material: TrainingMaterial = {
        id: crypto.randomUUID(),
        session: Number(data.get("session")),
        title,
        text,
        usage: data.get("usage") as MaterialUsage,
        createdAt: new Date().toISOString(),
        ...(url ? { url } : {}),
        ...(importedFilename ? { filename: importedFilename } : {}),
        ...(form.dataset.supersedes
          ? { supersedesId: form.dataset.supersedes }
          : {}),
      };
      snapshot().materials = unique(snapshot().materials, [material]);
      state.pending.materials = unique(state.pending.materials ?? [], [
        material,
      ]);
      void persist();
      render();
      setView("materials");
      void sync();
      $<HTMLDialogElement>("training-material-dialog").close();
    },
  );
  for (const [sizeId, textId, currentId] of [
    [
      "training-reading-size",
      "training-reading-text",
      () => readingMaterial?.id,
    ],
    [
      "training-focus-font",
      "training-sending-text",
      () => state.active?.task.id,
    ],
  ] as const) {
    $<HTMLInputElement>(sizeId).addEventListener("input", () => {
      const id = currentId();
      if (!id) return;
      const size = Number($<HTMLInputElement>(sizeId).value);
      $(textId).style.fontSize = `${size}px`;
      state.reading[id] = { size, line: $(textId).scrollTop };
      void persist();
    });
    $(textId).addEventListener("scroll", () => {
      const id = currentId();
      if (!id) return;
      state.reading[id] = {
        size: Number($<HTMLInputElement>(sizeId).value),
        line: $(textId).scrollTop,
      };
      void persist();
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.active?.runner?.status === "running") stopRunner();
    if (document.hidden && running) {
      stopTimer();
      notice(
        "The timer paused while you switched apps. If you continued practicing, confirm those minutes when finishing.",
      );
    }
    if (document.hidden) void persist();
  });
  window.addEventListener("pagehide", () => {
    trackAudioProgress();
    finishAudioPass(false);
    stopRunner();
    stopTimer();
    audio.pause();
    void persist();
  });
  window.addEventListener("online", () => {
    status();
    void sync();
  });
  window.addEventListener("offline", status);
  setInterval(() => {
    if (disposed) return;
    if (todayTime && state.snapshot && todayTime.date !== dateInTimezone(new Date(), snapshot().course.timezone)) render();
    if (running && state.active) {
      if (!allowActiveDate()) return;
      settleTimer();
      updateClock();
      if (Date.now() - lastSaved > 5000) {
        lastSaved = Date.now();
        void persist();
      }
    }
  }, 1000);
  if (state.snapshot) {
    const run = state.active?.runner;
    if (run) {
      // Upstream has no contest restore. Never convert a reload into a new
      // contest carrying over the old engine timer or score.
      if (["loading", "ready"].includes(run.status) && run.elapsedSeconds === 0) {
        state.active!.runner = createRunnerRun(run.runId, run.settings);
        state.active!.runnerRevision = runnerVersion.revision;
      }
      else if (run.status === "running") state.active!.runner = { ...run, status: "error", errorCode: "interrupted" };
    }
    render();
    if (state.active)
      notice(state.active.runner ? "Your runner block is saved. Open Focus to review it, save and start a new run, or finish for now." : "Your interrupted block is saved and paused. Resume when ready.");
  }
  try {
    mergeSnapshot(await request("bootstrap"));
    await persist();
    render();
    void sync();
  } catch (error) {
    notice(
      error instanceof Error
        ? error.message
        : "Unable to load your plan. Your saved device data remains available.",
      !authorized || (!connectionKnown && navigator.onLine),
    );
    if (!state.snapshot) $("training-auth").hidden = false;
    status();
  }
}

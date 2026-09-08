import { availableBlockMinutes, dateInTimezone, getTrainingPlan, matchesPracticeMode, taskProgress } from "./plan";
import type { BlockMinutes, PlannedTask, PracticeMode } from "./plan";
import { listeningGuidance } from "./guidance";
import { audioVariants, audioRecordingNote, courseWithAudioVariants, selectAudioVariant } from "./audio-variants";
import { isMorseRunner, morseRunnerSetup, MORSE_RUNNER_GUIDE_URL, WEB_MORSE_RUNNER_URL, MORSE_RUNNER_RESULTS_PROMPT } from "./morse-runner";
import { practiceTimeSummary, timedPracticeDelta } from "./practice-time";
import { createRunnerRun, reduceRunnerEvent, runnerConfigureCommand, runnerResultNote, runnerSettings, runnerStopCommand } from "./runner-bridge";
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
const modeHelp: Record<PracticeMode, string> = {
  anything: "A suggestion, not a required order. Choose any exercise below.",
  listen: "Phone and headphones: focused listening and head copy. Other assignments stay pending.",
  send: "At your key: warm up before other sending. Listening and computer work stay pending.",
  computer: "Typing-based trainers and simulator practice. Other assignments stay pending.",
};
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
  let view = "today";
  let temporaryMinutes: BlockMinutes | undefined;
  let running = false;
  let recalling = false;
  let todayTime: { date: string; savedSeconds: number; goal: number; savedIds: Set<string> } | undefined;
  let lastClock = performance.now();
  let lastAudioPosition = 0;
  let lastAudioClock = performance.now();
  let seeking = false;
  let audioReady = false;
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
  const audioPreference = () => state.audioSpeedPreference === "next" ? "next" as const : "assigned" as const;
  const practiceCourse = () => courseWithAudioVariants(snapshot().course, audioPreference(), state.audioSpeedOverrides);
  const practiceMode = (): PracticeMode =>
    state.practiceMode && Object.hasOwn(modeHelp, state.practiceMode)
      ? state.practiceMode
      : "anything";
  const plan = () =>
    getTrainingPlan(
      practiceCourse(),
      snapshot().attempts,
      new Date(),
      temporaryMinutes ?? snapshot().preferences.blockMinutes,
      practiceMode(),
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
    minutes: temporaryMinutes ?? snapshot().preferences.blockMinutes,
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
  const speedChoice = (task: TrainingTask) => {
    if (task.kind !== "audio") return "";
    const resource = assignedResource(task);
    if (resource?.unresolved || !task.speedWpm) return "";
    const choices = audioVariants(resource).filter((variant) => variant.speedWpm >= task.speedWpm!);
    if (choices.length < 2) return "";
    const defaultVariant = selectAudioVariant(resource, task.speedWpm, audioPreference());
    const defaultSpeed = choices.find((variant) => variant.url === defaultVariant?.url)?.speedWpm ?? task.speedWpm;
    const override = choices.some((variant) => variant.speedWpm === state.audioSpeedOverrides?.[task.id]) ? state.audioSpeedOverrides?.[task.id] : undefined;
    return `<label class="training-speed-choice">Recording speed for ${escapeHtml(task.title)}<select data-audio-speed="${escapeHtml(task.id)}"${state.active ? " disabled" : ""}><option value=""${override === undefined ? " selected" : ""}>Use default (${defaultSpeed} WPM)</option>${choices.map((variant) => `<option value="${variant.speedWpm}"${override === variant.speedWpm ? " selected" : ""}>${variant.speedWpm} WPM${variant.speedWpm === task.speedWpm ? " (assigned)" : " (stretch)"}${variant.durationSeconds ? ` · ${time(variant.durationSeconds)} per pass` : ""}</option>`).join("")}</select></label>`;
  };
  const progressMarkup = (task: TrainingTask, review = false) => {
    const active = state.active?.task.id === task.id && !!state.active.review === review ? state.active : undefined;
    if (active)
      return `<span class="training-progress-badge">Current ${review ? "review" : "block"}</span><p>${time(active.activeSeconds)} in this block · saved on this device${active.task.kind === "audio" ? ` · ${active.completedPasses} passes this block` : ""}</p>`;
    if (review) return "";
    const progress = taskProgress(task, snapshot().attempts);
    if (!progress.started || progress.complete) return "";
    const passes = task.kind === "audio"
      ? `${progress.completedPasses}${task.minimumPasses ? ` of ${task.minimumPasses} required` : ""} pass${progress.completedPasses === 1 && !task.minimumPasses ? "" : "es"} saved · `
      : "";
    return `<span class="training-progress-badge">Started</span><p class="training-saved-progress">${passes}${time(progress.activeSeconds)} practiced</p>`;
  };
  const blockDescription = (item: PlannedTask) =>
    item.task.kind === "audio" && Number.isFinite(item.resource?.durationSeconds) && (item.resource?.durationSeconds ?? 0) > 0
      ? `${recordingLabel(item.task, item.resource)} · ${time(item.resource!.durationSeconds!)} per pass · ${item.passesThisBlock ?? 1} pass${item.passesThisBlock === 1 ? "" : "es"} this block (about ${item.suggestedMinutes} min)`
      : `${item.suggestedMinutes}-minute ${item.task.kind === "simulator" ? "uninterrupted run" : "practice block"}`;
  const buttons = (taskId: string, missed = false, unavailable = false) => {
    const current = state.active?.task.id === taskId && !state.active.review;
    const task = findTask(taskId)?.task;
    const progress = task ? taskProgress(task, snapshot().attempts) : undefined;
    const started = progress?.started && !progress.complete;
    return `<div class="training-actions"><button type="button" ${current ? 'data-action="resume"' : `data-start="${escapeHtml(taskId)}"`} ${unavailable && !current ? 'disabled title="This live activity needs an eligible event window"' : ""}>${current ? "Return to block" : started ? "Continue practice" : missed ? "Carry this item" : "Practice"}</button><button type="button" data-manual="${escapeHtml(taskId)}">Done elsewhere</button>${missed ? `<button type="button" data-miss="${escapeHtml(taskId)}">Leave missed</button>` : ""}</div>`;
  };
  const taskRow = (item: PlannedTask, missed = false) =>
    `<div class="training-task${!item.extra && item.started ? " training-task-started" : ""}"><div><strong>${escapeHtml(item.task.title)}</strong>${progressMarkup(item.task, !!item.extra)}<p>${escapeHtml(assignmentLabel(item.assignment))}${item.task.speedWpm ? ` · ${item.task.speedWpm} WPM` : ""}${item.extra ? " · Optional review" : item.remainingPasses !== undefined ? ` · ${item.remainingPasses} pass${item.remainingPasses === 1 ? "" : "es"} remaining` : ""}</p><p>${escapeHtml(blockDescription(item))}</p>${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}${
      item.windows?.length
        ? `<p>Eligible CWT windows: ${item.windows
            .slice(0, 3)
            .map((window) =>
              escapeHtml(formatMeeting(window.start.toISOString())),
            )
            .join("; ")}</p>`
        : ""
    }${speedChoice(item.task)}${runnerGuideLink(item.task)}</div>${item.extra ? `<button type="button" data-review="${escapeHtml(item.task.id)}">Extra review</button>` : buttons(item.task.id, missed, item.task.kind === "live" && !item.availableNow)}</div>`;

  function setView(next: string) {
    if (next !== "focus" && state.active?.runner?.status === "running") stopRunner();
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
    // Keep the user's place in Week when speed choices or sync rerender it.
    const weekDetails = [...$("training-meetings").querySelectorAll<HTMLDetailsElement>("details")];
    const expandedWeekDetails = new Set(weekDetails.flatMap((detail, index) => detail.open ? [index] : []));
    $("training-app").hidden = false;
    $("training-auth").hidden = true;
    const course = practiceCourse();
    const mode = practiceMode();
    const now = new Date();
    const choices = availableBlockMinutes(course, snapshot().attempts, now, mode);
    const previousMinutes = temporaryMinutes ?? snapshot().preferences.blockMinutes;
    const selectedMinutes = choices.includes(previousMinutes)
      ? previousMinutes
      : choices.find((minutes) => minutes > previousMinutes && getTrainingPlan(course, snapshot().attempts, now, minutes, mode).next)
        ?? choices.find((minutes) => minutes > previousMinutes) ?? 15;
    const adjustedTime = selectedMinutes !== previousMinutes;
    if (adjustedTime) temporaryMinutes = selectedMinutes;
    const current = getTrainingPlan(course, snapshot().attempts, now, selectedMinutes, mode);
    const assignment = current.assignment;
    root!.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
    $("training-mode-help").textContent = modeHelp[mode];
    $<HTMLSelectElement>("training-audio-preference").value = audioPreference();
    $<HTMLSelectElement>("training-block-now").innerHTML = choices.map((minutes) => `<option value="${minutes}">${minutes} minutes</option>`).join("");
    $<HTMLSelectElement>("training-block-now").value = String(selectedMinutes);
    $("training-time-help").textContent = `${adjustedTime ? `No ${previousMinutes}-minute option fits this activity now; showing ${selectedMinutes} minutes. ` : ""}Audio fits when one whole pass fits. Other repeats can wait for another block. Short choices appear only when suitable practice is available.`;
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
    const todayQueue = current.queue.filter((item) => item.assignment.date === current.date);
    const todayBlocked = current.blocked.filter((item) => item.assignment.date === current.date);
    const earlierQueue = current.queue.filter((item) => item.assignment.date < current.date);
    const earlierBlocked = current.blocked.filter((item) => item.assignment.date < current.date);
    const earlierRemaining = earlierQueue.length + earlierBlocked.length;
    const todayRemaining = todayQueue.length + todayBlocked.length;
    const remaining = todayRemaining + earlierRemaining + preparation.length;
    $("training-coverage").textContent = remaining
      ? `${todayRemaining} exercise${todayRemaining === 1 ? "" : "s"} remaining for today${earlierRemaining ? ` · ${earlierRemaining} earlier unfinished` : ""}${preparation.length ? ` · ${preparation.length} instructor preparation` : ""}. Your schedule advances by date; you do not need to skip older work to move on.`
      : current.phase === "practice"
        ? "Your required queue is complete. Keep practicing if you like: 60 minutes is a goal, not a limit."
        : current.phase === "class"
          ? "Class time does not count toward your independent practice hour."
          : "Extra practice is optional. Review a familiar exercise for as long as it is useful.";
    $("training-resume").hidden = !state.active;
    const next = current.next;
    const activeAssignment = state.active ? findTask(state.active.task.id)?.assignment : undefined;
    $("training-next").innerHTML = state.active
      ? `<p class="eyebrow">Current block${activeAssignment ? ` · ${escapeHtml(assignmentLabel(activeAssignment))}` : ""}</p><h3>${escapeHtml(state.active.task.title)}</h3><p>${time(state.active.activeSeconds)} practiced. ${activeAssignment && activeAssignment.date < current.date ? "This is earlier preparation, not today's assignment. " : ""}Resume where you stopped, or record this partial block to choose another activity.</p><div class="training-actions"><button type="button" class="primary" data-action="resume">Resume your block</button><button type="button" data-action="finish">Record block and switch</button></div>`
      : next
        ? `<p class="eyebrow">${next.extra ? "Extra practice" : next.assignment.date === current.date ? "Suggested for today" : "Earlier preparation"} · ${escapeHtml(next.task.kind)}${next.task.speedWpm ? ` · ${next.task.speedWpm} WPM` : ""}</p><h3>${escapeHtml(next.task.title)}</h3>${progressMarkup(next.task, !!next.extra)}<p>${escapeHtml(assignmentLabel(next.assignment))}</p><p>${escapeHtml(blockDescription(next))}</p>${next.reason ? `<p>${escapeHtml(next.reason)}</p>` : ""}${next.extra ? '<p class="training-small">This optional block adds practice minutes without changing required assignment progress.</p>' : next.assignment.date < current.date ? '<p class="training-small">No unfinished exercise for today fits this activity and time choice. This earlier preparation is available if you want it.</p>' : ""}<button type="button" class="primary" ${next.extra ? "data-review" : "data-start"}="${escapeHtml(next.task.id)}">${next.started && !next.extra ? "Continue" : "Start"} ${next.suggestedMinutes} minutes</button>`
        : `<p class="eyebrow">${current.phase === "class" ? "Class materials are ready below" : "A little breathing room"}</p><h3>${remaining ? "Plan your next practice window" : "Your next action is yours."}</h3><p>${remaining ? "The remaining exercises need a longer block, an eligible event window, or a resource check. Review the details below." : current.phase === "rest" ? "Rest today, review an earlier exercise, or prepare with your instructor's material." : "Review the week, open class materials, or log practice completed elsewhere."}</p><div class="training-actions"><button type="button" data-view="week">View the course</button>${current.phase === "class" && snapshot().preferences.joinUrl ? link(snapshot().preferences.joinUrl, "Join class", "training-button primary") : ""}</div>`;
    if (!state.active && mode === "anything" && current.phase !== "class" && preparation.length && (!next || next.task.optional))
      $("training-next").innerHTML =
        `<p class="eyebrow">Instructor preparation · Session ${preparation[0].session}</p><h3>${escapeHtml(preparation[0].title)}</h3><p>This additional preparation is due before class. Its exact duration depends on the instructor's instructions.</p><button type="button" class="primary" data-practice-material="${preparation[0].id}">Start preparation</button>`;
    if (!state.active && next) {
      const startButton = $("training-next").querySelector("button[data-start], button[data-review]");
      startButton?.insertAdjacentHTML("beforebegin", speedChoice(next.task));
    }
    const available = todayQueue.filter((item) => matchesPracticeMode(item.task, mode));
    const deferred = todayQueue.filter((item) => !matchesPracticeMode(item.task, mode));
    $("training-queue").innerHTML = available.length
      ? available.map((item) => taskRow(item)).join("")
      : `<p class="training-small">${todayRemaining ? "Today's unfinished exercises need a different activity or more time. See below; earlier preparation is separate." : current.phase === "practice" ? "Today's required exercises are complete. Earlier preparation and extra review are available below." : "No required practice is scheduled right now. Earlier work and extra review remain available."}</p>`;
    $("training-deferred").innerHTML = deferred.length
      ? `<details class="training-section"><summary>Today: other activities (${deferred.length})</summary><p class="training-small">These stay pending while you practice something that fits right now.</p>${deferred.map((item) => taskRow(item)).join("")}</details>`
      : "";
    $("training-blocked").innerHTML = todayBlocked.length
      ? `<details class="training-section"><summary>Today: more time or a resource check (${todayBlocked.length})</summary>${todayBlocked.map((item) => taskRow(item)).join("")}</details>`
      : "";
    $("training-earlier-panel").hidden = !earlierRemaining;
    $("training-earlier-label").textContent = `Earlier unfinished preparation (${earlierRemaining})`;
    const earlierAvailable = earlierQueue.filter((item) => matchesPracticeMode(item.task, mode));
    const earlierDeferred = earlierQueue.filter((item) => !matchesPracticeMode(item.task, mode));
    $("training-earlier").innerHTML =
      (earlierAvailable.length ? earlierAvailable.map((item) => taskRow(item)).join("") : '<p class="training-small">No earlier exercise fits this activity and time choice.</p>') +
      (earlierDeferred.length ? `<details><summary>Earlier: other activities (${earlierDeferred.length})</summary>${earlierDeferred.map((item) => taskRow(item)).join("")}</details>` : "") +
      (earlierBlocked.length ? `<details><summary>Earlier: more time or a resource check (${earlierBlocked.length})</summary>${earlierBlocked.map((item) => taskRow(item)).join("")}</details>` : "");
    $("training-extra-panel").hidden = !current.extras.length;
    $("training-extra").innerHTML = current.extras.slice(0, 3).map((item) => taskRow(item)).join("");
    const missed = current.missed.filter(
      (item) => !state.dismissed.includes(item.task.id),
    );
    $("training-missed-panel").hidden = !missed.length;
    $("training-missed-label").textContent =
      `Unfinished work from the last class (${missed.length})`;
    $("training-missed").innerHTML =
      '<p class="training-small">Your schedule has moved on. Choose useful work to carry forward; no need to mark every item skipped. Leave missed only dismisses its reminder, not its history.</p>' +
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
    $<HTMLSelectElement>("training-block-preference").value = String(
      snapshot().preferences.blockMinutes,
    );
    if (document.activeElement !== $("training-reminder-time"))
      $<HTMLInputElement>("training-reminder-time").value =
        snapshot().preferences.reminderTime;
    if (document.activeElement !== $("training-join-url"))
      $<HTMLInputElement>("training-join-url").value =
        snapshot().preferences.joinUrl ?? "";
    $("training-preparation").innerHTML = materials.length
      ? `<div class="training-section"><h3>For your next class</h3>${materials.map((material) => `<div class="training-task"><div><strong>${escapeHtml(material.title)}</strong><p>${usageNames[material.usage]}${materialComplete(material) ? " · Preparation recorded" : ""}</p></div><div class="training-actions"><button type="button" data-material="${material.id}">Open material</button>${material.usage === "preparation" && !materialComplete(material) ? `<button type="button" data-practice-material="${material.id}">Start preparation</button>` : ""}</div></div>`).join("")}</div>`
      : '<p class="training-small">Expecting an instructor email? Add its text or link to Materials when it arrives.</p>';
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
                    return `<div class="training-task"><div><strong class="${progress.complete ? "training-completed" : ""}">${progress.complete ? "Completed · " : ""}${escapeHtml(task.title)}</strong>${progressMarkup(task)}${runnerGuideLink(task)}<details><summary>Instructions</summary><div class="training-original">${escapeHtml(task.instructions)}</div>${task.settings ? `<div class="training-original">${escapeHtml(task.settings)}</div>` : ""}${link(task.sourceUrl, "Official source")}</details></div>${buttons(task.id, false, task.kind === "live" && !live?.availableNow)}</div>`;
                  })
                  .join("")}</details>`,
            )
            .join("")}</details>`,
      )
      .join("");
    $("training-meetings").querySelectorAll<HTMLButtonElement>("button[data-start]").forEach((button) => {
      const task = findTask(button.dataset.start!)?.task;
      if (task) button.closest(".training-task")?.querySelector("div")?.insertAdjacentHTML("beforeend", speedChoice(task));
    });
    $("training-meetings").querySelectorAll<HTMLDetailsElement>("details").forEach((detail, index) => {
      if (expandedWeekDetails.has(index)) detail.open = true;
    });
    const upcoming = current.liveUpcoming ?? [];
    if (upcoming.length)
      $("training-meetings").insertAdjacentHTML(
        "afterbegin",
        `<div class="training-notice"><h3>Upcoming on-air work</h3><p>Plan around a live operating window before the class deadline.</p>${link("/radio/cw-practice/", "CWT times and exchange guidance")}${upcoming.map((item) => taskRow(item)).join("")}</div>`,
      );
    $("training-history").innerHTML =
      [...snapshot().attempts]
        .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
        .slice(0, 100)
        .map(
          (attempt) =>
            `<div class="training-task"><div><strong>${escapeHtml(findTask(attempt.taskId)?.task.title ?? snapshot().materials.find((item) => item.id === attempt.taskId)?.title ?? "Practice")}</strong><p>${escapeHtml(formatMeeting(attempt.endedAt))} · ${Math.round((attempt.activeSeconds / 60) * 10) / 10} min · ${attempt.context === "class" ? "Class use" : attempt.review ? "Extra review" : attempt.completed ? "Completed" : "Partial / review"}${attempt.completedPasses ? ` · ${attempt.completedPasses} passes` : ""}${attempt.recallSeconds ? ` · includes ${time(attempt.recallSeconds)} recall` : ""}</p>${attempt.scratchpad ? `<details><summary>Recall &amp; notes</summary><div class="training-history-notes">${escapeHtml(attempt.scratchpad)}</div></details>` : ""}${attempt.note ? `<p>${escapeHtml(attempt.note)}</p>` : ""}</div></div>`,
        )
        .join("") ||
      '<p class="training-small">Your first practice block will appear here.</p>';
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
    setView(view);
    status();
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
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    $("training-focus-kind").textContent =
      `${active.review ? "Extra review · " : ""}${active.task.kind}${active.task.speedWpm ? ` · ${active.task.speedWpm} WPM` : ""}${active.context === "class" ? " · Class use (not practice minutes)" : ""}`;
    $("training-focus-title").textContent = active.task.title;
    $("training-recording-label").textContent = recordingLabel(active.task, active.resource);
    $("training-focus-objective").textContent = active.review
      ? "Optional reinforcement using the original exercise below. These minutes count, but required assignment progress stays unchanged."
      : active.task.alternative
      ? `Alternative allowed by the curriculum: ${active.task.alternative}`
      : "Follow the exercise instructions below. This block autosaves on this device until you finish and save it.";
    $("training-focus-target").textContent =
      `${active.targetMinutes}-minute block${active.task.objectiveCount ? ` · Objective: ${active.task.objectiveCount}` : ""}`;
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
        `<p>${link("https://morsecode.world/international/trainer/character.html", "Open ICR trainer", "training-button primary")} ${link("https://morsecode.world/international/trainer/words.html", "Word trainer", "training-button")}</p><p class="training-small">Use CW Academy material, 25 WPM character speed, and ${active.task.speedWpm ?? 10} WPM effective speed. Follow the original guidelines below for word length and progression.</p>`,
      );
    if (mountedBlock !== active.id) {
      audioReady = false;
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
  function runnerMetadata(active: ActiveBlock): string {
    if (!active.runner) return "";
    return `${runnerResultNote(active.runner) ?? "Web Morse Runner: not started; no practice credited."} Upstream ${active.runnerRevision ?? "revision not recorded"}. Synthetic practice calls (not on-air contacts).`;
  }
  function renderRunner() {
    const run = state.active?.runner;
    if (!run) return;
    const messages = {
      loading: "Loading the pinned runner and assignment settings...",
      ready: "Ready. Enter your station Call, choose a comfortable Pitch, then click Run inside the simulator. Setup time does not count.",
      running: "Run in progress. Actual engine time is recorded automatically. Keep this page visible; leaving Focus, switching apps, or stopping ends this run as partial.",
      completed: "Assigned run complete. Review the transcript, then Finish block to save your time and results.",
      stopped: "Run stopped. Its practiced time and results are preserved, but a partial run does not complete the assignment. Finish and save before starting a new run.",
      error: "The run could not continue. Its last confirmed time is preserved as partial; it cannot resume after interruption. Finish and save, then start a new block or use the standalone runner.",
    };
    $("training-runner-status").textContent = messages[run.status];
    $("training-runner-result").hidden = !["completed", "stopped", "error"].includes(run.status);
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
    if (next.status !== "loading" && next.status !== "running") clearTimeout(runnerTimeout);
    // A ready frame must not start a hidden/previous-day block, even if its
    // click and the parent's visibility event crossed in the message queue.
    if (next.status === "running" && (document.hidden || view !== "focus" || !allowActiveDate())) stopRunner();
    if (next.status !== previous.status) renderRunner();
    updateClock();
    if (next.status !== previous.status || Date.now() - lastSaved > 5000) {
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
    try {
      await audio.play();
      $("training-audio-state").textContent =
        "Listening. Pause whenever you need a break.";
    } catch {
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
      item.task.kind === "simulator" ? (item.task.minutes ?? 15) : 0,
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
        found.task.kind === "simulator"
          ? (found.task.minutes ?? 15)
          : found.task.kind === "audio" && resource?.durationSeconds
          ? Math.ceil(resource.durationSeconds / 60)
          : (temporaryMinutes ?? snapshot().preferences.blockMinutes),
      passesThisBlock: found.task.kind === "audio" ? 1 : undefined,
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
      targetMinutes: temporaryMinutes ?? snapshot().preferences.blockMinutes,
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
    const recording = active.runner ? runnerMetadata(active) : audioRecordingNote(active.task, active.resource);
    $("training-finish-recording").hidden = !recording;
    $("training-finish-recording").textContent = recording ? `Saved automatically with this entry: ${recording}` : "";
    const marks = active.bookmarks.length ? `Difficult audio marks: ${active.bookmarks.map(time).join(", ")}` : "";
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
      complete.disabled = active.runner.status !== "completed";
      complete.checked = active.runner.status === "completed";
    }
    $("training-finish-help").textContent = active.review
      ? `Extra practice time is saved separately from required coverage.${active.task.kind === "audio" ? ` ${active.completedPasses} fully played passes this block; partial listening still counts as time.` : " Confirm any minutes practiced away from this page."}`
      : active.task.kind === "audio"
        ? `${active.completedPasses} fully played pass${active.completedPasses === 1 ? "" : "es"} this block. ${!passReady ? "More assigned passes remain; this partial block is still useful." : "Confirm completion when you have met the listening objective."}`
        : "Correct the time if you practiced while away from this page. Mark complete only when you met the assigned objective.";
    if (active.runner) $("training-finish-help").textContent = "Engine time and results are saved automatically. Only a complete uninterrupted assigned run can finish this exercise; partial practice still counts toward your daily time. Save before starting another run.";
    $<HTMLDialogElement>("training-finish-dialog").showModal();
  }

  function allowActiveDate(): boolean {
    if (!state.active || !state.snapshot) return true;
    if (
      dateInTimezone(state.active.startedAt, snapshot().course.timezone) ===
      dateInTimezone(new Date(), snapshot().course.timezone)
    )
      return true;
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
    if (!state.active) return;
    audio.currentTime = Math.min(
      state.active.position,
      Math.max(0, audio.duration - 0.1),
    );
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    audioReady = true;
  });
  audio.addEventListener("play", () => {
    // The native control has flipped paused already, but playback has just started.
    stopTimer(false);
    if (!allowActiveDate()) return;
    void persist();
  });
  audio.addEventListener("playing", () => {
    if (!allowActiveDate()) return;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    $("training-audio-state").textContent =
      "Listening. Your position is saved.";
  });
  audio.addEventListener("seeking", () => {
    seeking = true;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
  });
  audio.addEventListener("seeked", () => {
    seeking = false;
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    if (state.active) {
      state.active.position = audio.currentTime;
      void persist();
    }
  });
  audio.addEventListener("waiting", () => {
    lastAudioPosition = audio.currentTime;
    lastAudioClock = performance.now();
    $("training-audio-state").textContent =
      "Buffering. Waiting time is not counted.";
  });
  audio.addEventListener("pause", () => {
    if (state.active) {
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
    $("training-audio-state").textContent = "Playback stays at 1x so the recorded WPM stays accurate. Choose an official faster recording before your next block.";
  });
  audio.addEventListener("error", () => {
    $("training-audio-state").textContent =
      "The official recording could not load. Check your connection or use the source link. Your current progress is saved.";
  });
  audio.addEventListener("timeupdate", () => {
    const active = state.active;
    if (!active || !audioReady || active.task.kind !== "audio") return;
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
  });
  audio.addEventListener("ended", () => {
    const active = state.active;
    if (!active) return;
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
  });
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

  function updateManualNotePrompt() {
    const task = findTask($<HTMLSelectElement>("training-manual-task").value)?.task;
    $<HTMLTextAreaElement>("training-manual-note").placeholder = task && isMorseRunner(task) ? MORSE_RUNNER_RESULTS_PROMPT : "";
  }
  $("training-manual-task").addEventListener("change", updateManualNotePrompt);
  function manual(taskId?: string) {
    $<HTMLFormElement>("training-manual-form").reset();
    $<HTMLSelectElement>("training-manual-task").innerHTML =
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
    const selection = taskId ?? plan().next?.task.id;
    if (selection)
      $<HTMLSelectElement>("training-manual-task").value = selection;
    updateManualNotePrompt();
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
      "[data-action], [data-view], [data-start], [data-review], [data-mode], [data-manual], [data-miss], [data-material], [data-revise-material], [data-practice-material], [data-close], [data-seek]",
    );
    if (!button) return;
    if (button.hasAttribute("data-close")) {
      button.closest("dialog")?.close();
      return;
    }
    if (!state.snapshot) return;
    if (button.dataset.mode && Object.hasOwn(modeHelp, button.dataset.mode)) {
      state.practiceMode = button.dataset.mode as PracticeMode;
      render();
      void persist();
      return;
    }
    if (button.dataset.review) {
      const item = plan().extras.find((item) => item.task.id === button.dataset.review);
      if (item) start(item);
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
          state.active?.runner ? "Your runner block is saved. Start it if ready, or review and save any finished or interrupted run." : "Your saved block is paused. Resume the player or timer when ready.",
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
      case "pause-block":
        pause();
        setView("today");
        render();
        notice(
          state.active?.runner ? "This runner block is saved on this device. A stopped run cannot resume; finish and save its partial results before starting a new one." : "Your block is saved and paused. Return when you have a few minutes.",
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
          blockMinutes: Number(
            $<HTMLSelectElement>("training-block-preference").value,
          ) as 10 | 15,
          reminderTime,
          joinUrl: joinUrl || undefined,
          updatedAt: new Date().toISOString(),
        };
        state.pending.preferences = snapshot().preferences;
        temporaryMinutes = undefined;
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
  $<HTMLSelectElement>("training-block-now").addEventListener("change", (event) => {
    const minutes = Number((event.currentTarget as HTMLSelectElement).value);
    if (![3, 5, 10, 15].includes(minutes)) return;
    temporaryMinutes = minutes as BlockMinutes;
    render();
  });
  $<HTMLSelectElement>("training-audio-preference").addEventListener("change", (event) => {
    state.audioSpeedPreference = (event.currentTarget as HTMLSelectElement).value === "next" ? "next" : "assigned";
    render();
    void persist();
    if (state.active) notice("The new default applies to future blocks. Your current recording and its progress are unchanged.");
  });
  root.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.dataset.audioSpeed || state.active) return;
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
      if (active.runner && active.runner.status !== "completed") completed = false;
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
        activeSeconds < (active.task.minutes ?? 15) * 60 &&
        completed
      ) {
        $("training-finish-help").textContent =
          `This assigned run requires ${active.task.minutes ?? 15} minutes. Record it as partial or correct the practiced duration.`;
        return;
      }
      const endedAt = new Date();
      const note = [
        active.runner ? runnerMetadata(active) : audioRecordingNote(active.task, active.resource),
        String(data.get("note") || ""),
        active.bookmarks.length
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
      if (!found && !material) return;
      const activeSeconds = Math.round(Number(data.get("minutes")) * 60);
      const passes = Number(data.get("passes"));
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
      const complete = data.get("complete") === "on";
      if (
        complete &&
        found?.task.kind === "simulator" &&
        activeSeconds < (found.task.minutes ?? 15) * 60
      ) {
        notice(
          "A completed simulator run must include the full assigned duration. Save a partial run with Requirements completed unchecked.",
        );
        return;
      }
      void record({
        id: crypto.randomUUID(),
        assignmentId: found?.assignment.id ?? `material:${material!.id}`,
        taskId,
        startedAt: new Date(
          endedAt.getTime() - activeSeconds * 1000,
        ).toISOString(),
        endedAt: endedAt.toISOString(),
        activeSeconds,
        completed: complete,
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
    stopRunner();
    stopTimer();
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
      // contest with the old elapsed time or combine partial runs as complete.
      if (["loading", "ready"].includes(run.status) && run.elapsedSeconds === 0) {
        state.active!.runner = createRunnerRun(run.runId, run.settings);
        state.active!.runnerRevision = runnerVersion.revision;
      }
      else if (run.status === "running") state.active!.runner = { ...run, status: "error", errorCode: "interrupted" };
    }
    render();
    if (state.active)
      notice(state.active.runner ? "Your runner block is saved. Open Focus to review it; interrupted runs must be saved as partial before starting another run." : "Your interrupted block is saved and paused. Resume when ready.");
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

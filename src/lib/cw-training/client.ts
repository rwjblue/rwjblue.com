import { dateInTimezone, getTrainingPlan, taskProgress } from "./plan";
import type { PlannedTask } from "./plan";
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
  let temporaryMinutes: 10 | 15 | undefined;
  let running = false;
  let lastClock = performance.now();
  let lastAudioPosition = 0;
  let lastAudioClock = performance.now();
  let seeking = false;
  let audioReady = false;
  let mountedBlock: string | undefined;
  let syncing = false;
  let authorized = true;
  let connectionKnown = false;
  let readingMaterial: TrainingMaterial | undefined;
  let importedFilename: string | undefined;
  let lastSaved = 0;
  let disposed = false;
  const snapshot = () => state.snapshot!;
  const plan = () =>
    getTrainingPlan(
      snapshot().course,
      snapshot().attempts,
      new Date(),
      temporaryMinutes ?? snapshot().preferences.blockMinutes,
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
                ? "Saved and synced"
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
              attempts: state.pending.attempts?.slice(0, 25),
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
  const buttons = (taskId: string, missed = false, unavailable = false) =>
    `<div class="training-actions"><button type="button" data-start="${escapeHtml(taskId)}" ${unavailable ? 'disabled title="This live activity needs an eligible event window"' : ""}>${missed ? "Carry this item" : "Practice"}</button><button type="button" data-manual="${escapeHtml(taskId)}">Done elsewhere</button>${missed ? `<button type="button" data-miss="${escapeHtml(taskId)}">Leave missed</button>` : ""}</div>`;
  const taskRow = (item: PlannedTask, missed = false) =>
    `<div class="training-task"><div><strong>${escapeHtml(item.task.title)}</strong><p>Session ${item.assignment.session} · Day ${item.assignment.day}${item.task.speedWpm ? ` · ${item.task.speedWpm} WPM` : ""}${item.remainingPasses !== undefined ? ` · ${item.remainingPasses} pass${item.remainingPasses === 1 ? "" : "es"} remaining` : ""}</p>${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}${
      item.windows?.length
        ? `<p>Eligible CWT windows: ${item.windows
            .slice(0, 3)
            .map((window) =>
              escapeHtml(formatMeeting(window.start.toISOString())),
            )
            .join("; ")}</p>`
        : ""
    }</div>${buttons(item.task.id, missed, item.task.kind === "live" && !item.availableNow)}</div>`;

  function setView(next: string) {
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
    $("training-app").hidden = false;
    $("training-auth").hidden = true;
    const current = plan();
    const course = snapshot().course;
    const assignment = current.assignment;
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
    $("training-minutes").textContent = current.dailyGoalMinutes
      ? `${Math.round(current.practicedMinutes)} / ${current.dailyGoalMinutes} min`
      : `${Math.round(current.practicedMinutes)} min · optional practice`;
    $<HTMLProgressElement>("training-progress").max =
      current.dailyGoalMinutes || course.dailyGoalMinutes;
    $<HTMLProgressElement>("training-progress").value = Math.min(
      current.practicedMinutes,
      current.dailyGoalMinutes,
    );
    const session = meeting?.session ?? assignment?.session;
    const materials = currentMaterials().filter(
      (item) => item.session === session,
    );
    const preparation = materials.filter(
      (material) =>
        material.usage === "preparation" && !materialComplete(material),
    );
    const remaining =
      current.queue.filter((item) => !item.task.optional).length +
      current.blocked.filter((item) => !item.task.optional).length +
      preparation.length;
    $("training-coverage").textContent = remaining
      ? `${remaining} assigned exercise${remaining === 1 ? "" : "s"} remaining in this preparation window. Practice time and assignment coverage are separate.`
      : current.phase === "practice"
        ? "Your required queue is complete. Additional practice is optional."
        : "Class time does not count toward your independent practice hour.";
    $("training-resume").hidden = !state.active;
    const next = current.next;
    $("training-next").innerHTML = state.active
      ? `<p class="eyebrow">Your saved block</p><h3>${escapeHtml(state.active.task.title)}</h3><p>${time(state.active.activeSeconds)} practiced. Resume where you stopped.</p><button type="button" class="primary" data-action="resume">Resume your block</button>`
      : next
        ? `<p class="eyebrow">Up next · ${escapeHtml(next.task.kind)}${next.task.speedWpm ? ` · ${next.task.speedWpm} WPM` : ""}</p><h3>${escapeHtml(next.task.title)}</h3><p>${next.passesThisBlock ? `${next.passesThisBlock} whole pass${next.passesThisBlock === 1 ? "" : "es"}. ` : ""}${escapeHtml(next.reason || `A focused ${next.suggestedMinutes}-minute block.`)}</p><div class="training-actions"><button type="button" class="primary" data-start="${escapeHtml(next.task.id)}">Start ${next.suggestedMinutes} minutes</button><button type="button" data-action="ten">${temporaryMinutes === 10 ? "Use my usual block" : "I only have 10 minutes"}</button></div>`
        : `<p class="eyebrow">${current.phase === "class" ? "Class materials are ready below" : "A little breathing room"}</p><h3>${remaining ? "Plan your next practice window" : "Your next action is yours."}</h3><p>${remaining ? "The remaining exercises need a longer block, an eligible event window, or a resource check. Review the details below." : current.phase === "rest" ? "Rest today, review an earlier exercise, or prepare with your instructor's material." : "Review the week, open class materials, or log practice completed elsewhere."}</p><div class="training-actions"><button type="button" data-view="week">View the course</button>${current.phase === "class" && snapshot().preferences.joinUrl ? link(snapshot().preferences.joinUrl, "Join class", "training-button primary") : ""}</div>`;
    if (!state.active && preparation.length && (!next || next.task.optional))
      $("training-next").innerHTML =
        `<p class="eyebrow">Instructor preparation · Session ${preparation[0].session}</p><h3>${escapeHtml(preparation[0].title)}</h3><p>This additional preparation is due before class. Its exact duration depends on the instructor's instructions.</p><button type="button" class="primary" data-practice-material="${preparation[0].id}">Start preparation</button>`;
    $("training-queue").innerHTML = current.queue.length
      ? current.queue.map((item) => taskRow(item)).join("")
      : '<p class="training-small">No required work is queued right now.</p>';
    $("training-blocked").innerHTML = current.blocked.length
      ? `<div class="training-section"><h3>Plan ahead: timing and resource checks</h3>${current.blocked.map((item) => taskRow(item)).join("")}</div>`
      : "";
    const missed = current.missed.filter(
      (item) => !state.dismissed.includes(item.task.id),
    );
    $("training-missed-panel").hidden = !missed.length;
    $("training-missed-label").textContent =
      `Earlier work to review (${missed.length})`;
    $("training-missed").innerHTML =
      '<p class="training-small">Choose deliberately what to carry forward. Leaving work missed preserves the record without adding to your queue.</p>' +
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
                    return `<div class="training-task"><div><strong class="${progress.complete ? "training-completed" : ""}">${progress.complete ? "Completed · " : ""}${escapeHtml(task.title)}</strong><details><summary>Instructions</summary><div class="training-original">${escapeHtml(task.instructions)}</div>${task.settings ? `<div class="training-original">${escapeHtml(task.settings)}</div>` : ""}${link(task.sourceUrl, "Official source")}</details></div>${buttons(task.id, false, task.kind === "live" && !live?.availableNow)}</div>`;
                  })
                  .join("")}</details>`,
            )
            .join("")}</details>`,
      )
      .join("");
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
            `<div class="training-task"><div><strong>${escapeHtml(findTask(attempt.taskId)?.task.title ?? snapshot().materials.find((item) => item.id === attempt.taskId)?.title ?? "Practice")}</strong><p>${escapeHtml(formatMeeting(attempt.endedAt))} · ${Math.round((attempt.activeSeconds / 60) * 10) / 10} min · ${attempt.context === "class" ? "Class use" : attempt.completed ? "Completed" : "Partial / review"}${attempt.completedPasses ? ` · ${attempt.completedPasses} passes` : ""}</p>${attempt.note ? `<p>${escapeHtml(attempt.note)}</p>` : ""}</div></div>`,
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
      mountedBlock = undefined;
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    $("training-focus-kind").textContent =
      `${active.task.kind}${active.task.speedWpm ? ` · ${active.task.speedWpm} WPM` : ""}${active.context === "class" ? " · Class use (not practice minutes)" : ""}`;
    $("training-focus-title").textContent = active.task.title;
    $("training-focus-objective").textContent = active.task.alternative
      ? `Alternative allowed by the curriculum: ${active.task.alternative}`
      : "Follow the exercise instructions below. Your progress is saved as you go.";
    $("training-focus-target").textContent =
      `${active.targetMinutes}-minute block${active.task.objectiveCount ? ` · Objective: ${active.task.objectiveCount}` : ""}`;
    $("training-focus-instructions").textContent = active.task.instructions;
    $("training-focus-settings").textContent = active.task.settings ?? "";
    const source = $<HTMLAnchorElement>("training-focus-source");
    source.hidden = !safeUrl(active.task.sourceUrl);
    source.href = safeUrl(active.task.sourceUrl);
    const isAudio =
      active.task.kind === "audio" &&
      !!active.resource?.url &&
      !active.resource.unresolved;
    $("training-audio-box").hidden = !isAudio;
    $("training-timer-box").hidden = isAudio;
    $("training-focus-resource").innerHTML = active.resource?.unresolved
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
      if (isAudio) {
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
          title: active.task.title,
          artist: "CW Academy practice",
          album: snapshot().course.title,
        });
    }
    updateClock();
  }
  function updateClock() {
    if (!state.active) return;
    $("training-timer").textContent = time(state.active.activeSeconds);
    $("training-timer-toggle").textContent = running
      ? "Pause timer"
      : "Resume timer";
    const active = state.active;
    $("training-pass-count").textContent =
      `${active.completedPasses} of ${active.targetPasses} passes this block complete${active.previousPasses ? ` · ${active.previousPasses} recorded earlier` : ""}`;
    $("training-bookmarks").innerHTML = active.bookmarks
      .map(
        (mark, index) =>
          `<button type="button" data-seek="${mark}" aria-label="Replay difficult mark ${index + 1} at ${time(mark)}">${time(mark)}</button>`,
      )
      .join("");
  }
  function pause() {
    running = false;
    audio.pause();
    void persist();
    updateClock();
  }
  async function play(): Promise<void> {
    if (!allowActiveDate()) return;
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
    state.active = {
      id: crypto.randomUUID(),
      assignmentId: item.assignment.id,
      task: item.task,
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
    };
    render();
    setView("focus");
    void persist();
    if (item.task.kind === "audio" && item.resource?.url) void play();
    else {
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
    const resource = snapshot().course.resources.find(
      (item) => item.id === found.task.resourceId,
    );
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
    state.active = {
      id: crypto.randomUUID(),
      assignmentId: `material:${material.id}`,
      task: materialTask(material),
      startedAt: new Date().toISOString(),
      targetMinutes: snapshot().preferences.blockMinutes,
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
    pause();
    $<HTMLFormElement>("training-finish-form").reset();
    $<HTMLInputElement>("training-finish-minutes").value = (
      Math.round(state.active.activeSeconds / 6) / 10
    ).toString();
    const active = state.active;
    $("training-finish-title").textContent =
      active.context === "class" ? "Record class use" : "Finish this block";
    const complete = $<HTMLInputElement>("training-finish-complete");
    const passReady =
      !active.task.minimumPasses ||
      active.previousPasses + active.completedPasses >=
        active.task.minimumPasses;
    complete.disabled = active.task.kind === "audio" && !passReady;
    complete.checked =
      active.task.kind === "audio"
        ? !!active.task.minimumPasses && passReady
        : active.activeSeconds >=
          (active.task.minutes ?? active.targetMinutes) * 60;
    $("training-finish-help").textContent =
      active.task.kind === "audio"
        ? `${active.completedPasses} fully played pass${active.completedPasses === 1 ? "" : "es"} this block. ${!passReady ? "More assigned passes remain; this partial block is still useful." : "Confirm completion when you have met the listening objective."}`
        : "Correct the time if you practiced while away from this page. Mark complete only when you met the assigned objective.";
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
      void persist();
    }
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
        "Take a moment to recall what you heard. Tap play for the next pass.";
    else void play();
  });
  if ("mediaSession" in navigator) {
    for (const [action, handler] of Object.entries({
      play: (): void => {
        void play();
      },
      pause: (): void => {
        audio.pause();
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
      "[data-action], [data-view], [data-start], [data-manual], [data-miss], [data-material], [data-revise-material], [data-practice-material], [data-close], [data-seek]",
    );
    if (!button) return;
    if (button.hasAttribute("data-close")) {
      button.closest("dialog")?.close();
      return;
    }
    if (!state.snapshot) return;
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
          "Your saved block is paused. Resume the player or timer when ready.",
        );
        break;
      case "ten":
        temporaryMinutes = temporaryMinutes === 10 ? undefined : 10;
        render();
        break;
      case "toggle-timer":
        if (!allowActiveDate()) break;
        running = !running;
        lastClock = performance.now();
        updateClock();
        void persist();
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
          "Your block is saved and paused. Return when you have a few minutes.",
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
      const activeSeconds = Math.round(Number(data.get("minutes")) * 60);
      if (
        !Number.isFinite(activeSeconds) ||
        activeSeconds < 0 ||
        activeSeconds > 14400
      )
        return;
      let completed = data.get("complete") === "on";
      if (
        active.task.kind === "audio" &&
        active.task.minimumPasses &&
        active.previousPasses + active.completedPasses <
          active.task.minimumPasses
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
        String(data.get("note") || ""),
        active.bookmarks.length
          ? `Difficult audio marks: ${active.bookmarks.map(time).join(", ")}`
          : "",
        Math.abs(activeSeconds - active.activeSeconds) > 6
          ? "Practice duration confirmed manually."
          : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000);
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
          ? { completedPasses: active.completedPasses }
          : {}),
        ...(data.get("difficulty")
          ? { difficulty: data.get("difficulty") as Difficulty }
          : {}),
        ...(note ? { note } : {}),
        context: active.context,
      };
      state.active = undefined;
      audio.pause();
      running = false;
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
    if (document.hidden && running) {
      running = false;
      updateClock();
      notice(
        "The timer paused while you switched apps. If you continued practicing, confirm those minutes when finishing.",
      );
    }
    if (document.hidden) void persist();
  });
  window.addEventListener("pagehide", () => {
    running = false;
    void persist();
  });
  window.addEventListener("online", () => {
    status();
    void sync();
  });
  window.addEventListener("offline", status);
  setInterval(() => {
    if (disposed) return;
    const now = performance.now();
    const elapsed = (now - lastClock) / 1000;
    lastClock = now;
    if (running && state.active) {
      if (!allowActiveDate()) return;
      if (elapsed < 4 && !document.hidden)
        state.active.activeSeconds += elapsed;
      else {
        running = false;
        notice(
          "The timer paused after an interruption. Confirm any additional practice minutes when finishing.",
        );
      }
      updateClock();
      if (Date.now() - lastSaved > 5000) {
        lastSaved = Date.now();
        void persist();
      }
    }
  }, 1000);
  if (state.snapshot) {
    render();
    if (state.active)
      notice("Your interrupted block is saved and paused. Resume when ready.");
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

// Local adapter for the pinned upstream runtime. Keep this wire schema aligned
// with src/lib/cw-training/runner-bridge.ts; no lesson text or identity crosses it.
export const CHANNEL = "cw-training-runner";
export const VERSION = 1;
const conditionKeys = ["qrm", "qrn", "qsb", "flutter", "lids"];
const assignedIds = ["mode", "wpm", "time", "activity", ...conditionKeys, "expert_config"];
const record = value => typeof value === "object" && value !== null && !Array.isArray(value);
const exact = (value, keys) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

export function parseRunnerCommand(value) {
  if (!record(value) || value.channel !== CHANNEL || value.version !== VERSION
    || typeof value.runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value.runId)) return undefined;
  const base = { channel: CHANNEL, version: VERSION, type: value.type, runId: value.runId };
  if (value.type === "stop" && exact(value, ["channel", "version", "type", "runId"])) return base;
  if (value.type !== "configure" || !exact(value, ["channel", "version", "type", "runId", "settings"])) return undefined;
  const settings = value.settings;
  if (!record(settings) || !exact(settings, ["mode", "wpm", "durationSeconds", "activity", "conditions"])
    || !["SingleCall", "WPX"].includes(settings.mode) || !integer(settings.wpm, 10, 60)
    || !integer(settings.durationSeconds, 60, 6000) || !integer(settings.activity, 1, 9)
    || !record(settings.conditions) || !exact(settings.conditions, conditionKeys)
    || !conditionKeys.every(key => typeof settings.conditions[key] === "boolean")) return undefined;
  return { ...base, settings: { ...settings, conditions: { ...settings.conditions } } };
}

export function readRunnerSummary(log) {
  const qsoCount = log.data.length;
  const verifiedPoints = log.ConfCalls.size;
  const score = verifiedPoints * log.ConfPrefix.size;
  const nrErrors = log.data.filter(qso => qso.Check === "NR").length;
  const nilErrors = log.data.filter(qso => qso.Check === "Nil").length;
  if (!integer(qsoCount, 0, 100000) || !integer(verifiedPoints, 0, qsoCount)
    || !integer(score, 0, 10000000000) || nrErrors + nilErrors > qsoCount) throw new Error("Invalid runner summary");
  return { qsoCount, verifiedPoints, score, nrErrors, nilErrors };
}

/** Install after View.onLoad. Dependencies are injectable for synthetic tests. */
export function installRunnerBridge(view, { window: win, document: doc, callsReady = Promise.resolve() }) {
  const parent = win.parent;
  const origin = win.location.origin;
  const runButton = doc.getElementById("run");
  const originalStart = view.startContest.bind(view);
  const originalToggle = view.toggleNoRunFields.bind(view);
  let configured;
  let sequence = -1;
  let ready = false;
  let used = false;
  let started = false;
  let terminal = false;
  let runGesture = false;
  let gestureExpiry;
  let explicitStop = false;
  let elapsedSeconds = 0;
  let heartbeat;
  let audioStateChanged;

  const send = (type, extra = {}) => {
    if (!configured) return;
    parent.postMessage({ channel: CHANNEL, version: VERSION, runId: configured.runId,
      type, sequence: ++sequence, elapsedSeconds, ...extra }, origin);
  };
  const lockSettings = () => {
    for (const id of assignedIds) doc.getElementById(id).disabled = true;
  };
  const enableSending = enabled => {
    for (const button of doc.querySelectorAll(".send button")) button.disabled = !enabled;
  };
  const engineElapsed = () => {
    if (!started) return 0;
    const elapsed = view.ctx.currentTime - view.start_time;
    if (!Number.isFinite(elapsed) || elapsed < elapsedSeconds) throw new Error("Invalid runner clock");
    return Math.min(configured.settings.durationSeconds, elapsed);
  };
  const cleanup = () => {
    win.clearTimeout(gestureExpiry);
    win.clearInterval(heartbeat);
    win.clearInterval(view.timer_id);
    if (audioStateChanged && view.ctx) view.ctx.removeEventListener("statechange", audioStateChanged);
    view.running = false;
    try { view.ContestNode?.disconnect(); } catch { /* Already disconnected. */ }
    try {
      if (view.ctx && view.ctx.state !== "closed") void view.ctx.close().catch(() => {});
    } catch { /* A failed audio setup may not provide a closable context. */ }
    try { view.stopTX(); } catch { /* Initial setup may not have finished. */ }
    runButton.disabled = true;
    runButton.textContent = "Run finished";
    runButton.classList.remove("stop");
    enableSending(false);
    lockSettings();
  };
  const fail = code => {
    if (terminal) return;
    terminal = true;
    // Preserve the last engine reading; never fill an error gap with wall time.
    try { elapsedSeconds = engineElapsed(); } catch { /* Keep last valid reading. */ }
    send("error", { code });
    cleanup();
  };
  const stop = reason => {
    if (terminal || !configured) return;
    try {
      elapsedSeconds = engineElapsed();
      const summary = readRunnerSummary(view.log);
      terminal = true;
      send("results", { reason, summary });
      cleanup();
      view.clock.textContent = view.formatTimer(elapsedSeconds);
    } catch { fail("engine"); }
  };
  const tick = () => {
    if (!started || terminal) return;
    try {
      elapsedSeconds = engineElapsed();
      if (elapsedSeconds >= configured.settings.durationSeconds) stop("completed");
      else send("progress");
    } catch { fail("engine"); }
  };
  const applySettings = settings => {
    Object.assign(view._config._config, {
      wpm: settings.wpm, time: settings.durationSeconds / 60,
      contest_id: settings.mode === "SingleCall" ? "single" : "wpx", activity: settings.activity,
      ...settings.conditions,
      // A previous standalone run must not change the assigned timing/speed.
      min_dx: 0, max_dx: 0, dx_wpm_type: "standard", dx_min_wpm: settings.wpm,
      dx_max_wpm: settings.wpm, farnsworth: false, farnsworth_eff_wpm: null, contest_start_offset_min: 0,
    });
    view._config.update_dom();
    view._config.update();
    lockSettings();
  };

  // Upstream toggles these fields and changes WPM with keyboard shortcuts.
  // Always retain the assigned values in embedded mode.
  view.toggleNoRunFields = () => { originalToggle(); lockSettings(); };
  view._config.updateWPM = () => {};
  view.startContest = async () => {
    if (view.running || !ready || used || terminal || !runGesture) return;
    runGesture = false;
    win.clearTimeout(gestureExpiry);
    used = true;
    runButton.disabled = true;
    try {
      await originalStart();
      if (terminal) { cleanup(); return; }
      if (!view.ContestNode || !view.ctx || view.ctx.state !== "running" || !Number.isFinite(view.start_time)) {
        fail("audio");
        return;
      }
      started = true;
      send("started");
      runButton.disabled = false;
      enableSending(true);
      audioStateChanged = () => {
        if (!terminal && view.ctx.state !== "running") fail("interrupted");
      };
      view.ctx.addEventListener("statechange", audioStateChanged);
      view.ContestNode.addEventListener("processorerror", () => fail("engine"), { once: true });
      heartbeat = win.setInterval(tick, 500);
    } catch { if (!terminal) fail("audio"); }
  };
  view.stopContest = () => {
    if (!started) { stop("stopped"); return; }
    try { stop(!explicitStop && engineElapsed() >= configured.settings.durationSeconds ? "completed" : "stopped"); }
    catch { fail("engine"); }
  };
  const onRunClick = event => {
    // An iframe click, not a postMessage or an upstream F1 auto-start, unlocks audio.
    runGesture = event.isTrusted === true;
    explicitStop = view.running;
    // Native dispatch may drain microtasks between capture and bubble
    // listeners. Keep this single-use permit until the click task finishes.
    win.clearTimeout(gestureExpiry);
    gestureExpiry = win.setTimeout(() => { runGesture = false; }, 0);
  };
  runButton.addEventListener("click", onRunClick, true);
  runButton.disabled = true;
  enableSending(false);
  lockSettings();

  const onMessage = async event => {
    if (parent === win || event.source !== parent || event.origin !== origin) return;
    const command = parseRunnerCommand(event.data);
    if (!command) return;
    if (command.type === "stop") {
      if (command.runId === configured?.runId) stop("stopped");
      return;
    }
    // One configure/run per frame. A later command cannot reset its clock or ID.
    if (configured || terminal) return;
    configured = command;
    try {
      applySettings(command.settings);
      await callsReady;
      if (terminal) return;
      if (!view.calls.calls?.length) { fail("configuration"); return; }
      ready = true;
      runButton.disabled = false;
      send("ready");
    } catch { fail("configuration"); }
  };
  const onPageHide = () => { if (configured && !terminal) stop("stopped"); };
  const onVisibilityChange = () => {
    if (doc.visibilityState === "hidden" && used && !terminal) stop("stopped");
  };
  win.addEventListener("message", onMessage);
  win.addEventListener("pagehide", onPageHide);
  doc.addEventListener("visibilitychange", onVisibilityChange);
  return {
    stop: () => stop("stopped"),
    destroy: () => {
      onPageHide();
      win.removeEventListener("message", onMessage);
      win.removeEventListener("pagehide", onPageHide);
      doc.removeEventListener("visibilitychange", onVisibilityChange);
      runButton.removeEventListener("click", onRunClick, true);
    },
  };
}

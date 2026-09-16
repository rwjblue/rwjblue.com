import { REPORT_FIELDS, buildPrefilledReportUrl, isReportDate, validateReportAnswers, type ReportField } from "./report-fields";
import { applyReportSuggestions, buildReportDraft, reportWindowForSession, type ReportDraft } from "./report";
import { dateInTimezone } from "./plan";
import type { TrainingDeviceState } from "./storage";
import type { TrainingReport } from "./report-types";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const labels: Record<string, string> = { reportDate: "Report date", session: "Session number", runnerVerifiedPoints: "Highest Verified Pts", wordsErrors: "Word training error count", figuresErrorPercent: "Figures errors (%)", customErrorPercent: "Custom characters errors (%)", problems: "Questions or problems for Bob" };
const label = (field: ReportField) => labels[field.key] ?? field.label.replace(/\s+i\.e\.[\s\S]*/i, "").trim();

interface ReportPanelOptions {
  state(): TrainingDeviceState;
  persist(): Promise<void>;
  save(report: TrainingReport): Promise<void>;
  syncLcwo(): Promise<void>;
}

/** All report answers live in private device/account state, never page markup or URL history. */
export function createTrainingReportPanel(root: HTMLElement, options: ReportPanelOptions) {
  let renderedId: string | undefined;
  let renderedSession: number | undefined;
  let busy = false;
  let lcwoSyncing = false;
  let lcwoSyncMessage = "";
  let autoSyncAttempted = false;
  let importedVersion: string | undefined;
  const state = options.state;
  const snapshot = () => state().snapshot!;
  const draft = () => state().reportDraft!;
  const reports = () => [...(snapshot().reports ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const saveLocal = () => {
    if (state().reportDraft) {
      (state().reportDrafts ??= {})[String(draft().session)] = structuredClone(draft());
      (state().reportEditsBySession ??= {})[String(draft().session)] = [...(state().reportEditedKeys ?? [])];
    }
    void options.persist();
  };
  const message = (text: string) => { root.querySelector<HTMLElement>("[data-report-message]")!.textContent = text; };

  function build(session: number, reportDate: string, fromDate?: string, toDate?: string) {
    const window = fromDate !== undefined && toDate !== undefined ? { fromDate, toDate }
      : reportWindowForSession(snapshot().course, session, reportDate);
    const identity = state().reportDraft?.answers ?? reports()[0]?.answers ?? {};
    return buildReportDraft(snapshot().course, snapshot().attempts, {
      session, reportDate, fromDate: fromDate ?? window.fromDate, toDate: toDate ?? window.toDate,
      callsign: identity.callsign ?? "N1RWJ", firstName: identity.firstName ?? "Rob", reports: reports(), lcwoRuns: snapshot().lcwo?.runs,
    });
  }

  function start(session: number) {
    const today = dateInTimezone(new Date(), snapshot().course.timezone);
    const local = state().reportDrafts?.[String(session)];
    const saved = local ?? reports().find(report => report.session === session);
    if (saved) {
      state().reportDraft = { ...structuredClone(saved), id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "draft" };
      delete state().reportDraft!.submittedAt;
      state().reportEditedKeys = local ? state().reportEditsBySession?.[String(session)] ?? []
        : saved.editedAnswerKeys ?? Object.keys(saved.answers).filter(key => saved.answers[key]?.trim());
    } else {
      const window = reportWindowForSession(snapshot().course, session, today);
      const result = build(session, today);
      state().reportDraft = { id: crypto.randomUUID(), session, reportDate: today, ...window, createdAt: new Date().toISOString(), status: "draft", answers: result.answers, sourceAttemptIds: result.sourceAttemptIds, sourceLcwoIds: result.sourceLcwoIds };
      state().reportEditedKeys = [];
    }
    renderedId = undefined;
    importedVersion = undefined;
    saveLocal();
    render();
  }

  function errors(complete: boolean): string[] {
    const current = draft();
    const problems = validateReportAnswers(current.answers, { requireComplete: complete }).map(error => {
      const field = REPORT_FIELDS.find(field => field.key === error.key);
      return `${field ? label(field) : error.key}: ${error.message}`;
    });
    if (![current.fromDate, current.toDate, current.reportDate].every(isReportDate) || current.fromDate > current.toDate || current.toDate > current.reportDate)
      problems.unshift("Choose a valid practice window ending on or before the report date.");
    return problems;
  }

  function refresh() {
    if (![draft().fromDate, draft().toDate, draft().reportDate].every(isReportDate)) return;
    const result = build(draft().session, draft().reportDate, draft().fromDate, draft().toDate);
    state().reportDraft = applyReportSuggestions(draft(), result, state().reportEditedKeys ?? []);
    renderedId = undefined;
    saveLocal();
    render();
    message("Practice answers refreshed. Your edited answers are preserved.");
  }

  function lcwoStatus() {
    if (!state().snapshot) return;
    const control = root.querySelector<HTMLButtonElement>("[data-report-action=lcwo-sync]");
    if (control) { control.disabled = lcwoSyncing || !snapshot().lcwo?.configured; control.textContent = lcwoSyncing ? "Syncing LCWO..." : "Sync LCWO"; }
    const output = root.querySelector<HTMLElement>("[data-lcwo-status]");
    if (output) {
      const last = snapshot().lcwo?.syncedAt;
      output.textContent = lcwoSyncMessage || (last ? `Last synced ${new Date(last).toLocaleString()}.` : "No LCWO results imported yet.");
    }
  }

  async function syncLcwo() {
    if (lcwoSyncing || !state().snapshot?.lcwo?.configured) return;
    lcwoSyncing = true;
    lcwoSyncMessage = "Fetching saved LCWO results...";
    lcwoStatus();
    try {
      await options.syncLcwo();
      lcwoSyncMessage = "";
      render();
    } catch (error) {
      lcwoSyncMessage = `${error instanceof Error ? error.message : "LCWO could not sync."} Saved results and your report edits are still available.`;
    } finally { lcwoSyncing = false; lcwoStatus(); }
  }

  function lcwoSources(result: ReportDraft) {
    const names: Record<string, string> = { callsign: "Callsigns", words: "Words", letters: "Letters", figures: "Figures", custom: "Custom characters" };
    const edited = new Set(state().reportEditedKeys ?? []);
    const missingLabel = (key: string) => key.endsWith("Wpm") ? "training speed"
      : key.endsWith("MaximumLength") ? "maximum word length" : key.endsWith("Length") ? "group length"
        : key.endsWith("ErrorPercent") ? "errors (%)" : "error count";
    const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: snapshot().course.timezone,
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
    return result.lcwoSources.map(({ run, missingKeys }) => {
      const measurements = [run.score !== undefined ? `Score ${run.score}` : "",
        run.maximumWpm !== undefined ? `Maximum successful-copy speed: ${run.maximumWpm} WPM` : "",
        run.effectiveWpm !== undefined ? `Effective speed: ${run.effectiveWpm} WPM` : "",
        run.characterWpm !== undefined ? `Character speed: ${run.characterWpm} WPM` : "",
        run.accuracyPercent !== undefined ? `Stored accuracy: ${run.accuracyPercent}%` : ""].filter(Boolean);
      const missing = missingKeys.filter(key => !draft().answers[key]?.trim());
      const reviewEdits = REPORT_FIELDS.some(field => field.key.startsWith(run.kind) && edited.has(field.key));
      return `<li><strong>${escape(names[run.kind])} · ${escape(date(run.recordedAt))}</strong><p class="training-small">${escape(measurements.join(". "))}.</p>${missing.length || reviewEdits ? `<p class="training-small">${missing.length ? `Still to fill: ${escape(missing.map(missingLabel).join(", "))}.` : ""}${reviewEdits ? " Your edited answers are preserved; check that they describe this run." : ""}</p>` : ""}</li>`;
    }).join("");
  }

  function input(field: ReportField) {
    const value = draft().answers[field.key] ?? "";
    const attributes = `data-report-answer="${field.key}" id="report-answer-${field.key}" maxlength="4000"`;
    const control = field.type === "rating"
      ? `<select ${attributes}><option value="">${field.required ? "Choose a rating" : "Not reported"}</option>${field.options?.map(option => `<option${option === value ? " selected" : ""}>${escape(option)}</option>`).join("")}</select>`
      : field.type === "textarea"
        ? `<textarea ${attributes} rows="3">${escape(value)}</textarea>`
        : `<input ${attributes} type="${field.type === "number" ? "text" : field.type === "date" ? "date" : "text"}"${field.type === "number" ? ' inputmode="decimal"' : ""} value="${escape(value)}" />`;
    return `<label for="report-answer-${field.key}">${escape(label(field))}${field.required ? " *" : ""}${control}</label>`;
  }

  function summary(report: TrainingReport): string {
    return `<dl class="training-report-summary">${REPORT_FIELDS.filter(field => report.answers[field.key]?.trim()).map(field => `<div><dt>${escape(label(field))}</dt><dd>${escape(report.answers[field.key])}</dd></div>`).join("")}</dl>`;
  }

  function status() {
    lcwoStatus();
    const current = draft();
    const saved = reports().find(report => report.session === current.session);
    const pendingIds = new Set(state().pending.reports?.map(report => report.id));
    root.querySelector<HTMLElement>("[data-report-save-state]")!.textContent = saved
      ? `Latest saved copy: ${saved.status === "submitted" ? "reported as submitted" : "draft"} · ${pendingIds.has(saved.id) ? "waiting to sync" : "saved in account"}. Edits autosave on this device.`
      : "Edits autosave on this device. Save a draft to sync it to your account.";
    const handoff = state().reportHandoff;
    const sent = root.querySelector<HTMLElement>("[data-report-handoff]")!;
    // Do not replace an in-progress checkbox interaction during background sync.
    if (sent.dataset.copyId !== (handoff?.id ?? "")) {
      sent.dataset.copyId = handoff?.id ?? "";
      sent.innerHTML = handoff ? `<h3>Copy opened for Session ${handoff.session}</h3><p class="training-small">Submit in Google Forms, then record that submission here. This saves the exact copy opened, even if you edit the draft above.</p><details class="training-panel"><summary>Review that copy</summary><div class="training-panel-body">${summary(handoff)}</div></details><label class="training-check"><input type="checkbox" data-report-confirm /> Google Forms confirmed that I submitted this copy.</label><button type="button" data-report-action="submitted">Record submission</button>` : "";
    }
    sent.hidden = !handoff;
    const history = root.querySelector<HTMLElement>("[data-report-history]")!;
    history.innerHTML = reports().filter(report => report.status === "submitted").map(report => `<details class="training-panel"><summary>Session ${report.session} · submitted ${escape(report.reportDate)}</summary><div class="training-panel-body"><p class="training-small">Confirmation recorded ${escape(new Date(report.submittedAt!).toLocaleString())}. ${pendingIds.has(report.id) ? "Waiting to sync." : "Saved in account."}</p>${summary(report)}</div></details>`).join("") || '<p class="training-small">No submissions recorded yet.</p>';
  }

  function render() {
    if (!state().snapshot) return;
    if (!state().reportDraft) {
      const meetings = snapshot().course.meetings;
      const selected = meetings.find(meeting => Date.parse(meeting.endsAt) >= Date.now()) ?? meetings.at(-1);
      if (!selected) return;
      start(selected.session);
      return;
    }
    const today = dateInTimezone(new Date(), snapshot().course.timezone);
    if (isReportDate(draft().reportDate) && draft().reportDate < today && !state().reportEditedKeys?.includes("reportDate")) {
      draft().reportDate = today;
      const window = reportWindowForSession(snapshot().course, draft().session, today);
      Object.assign(draft(), window);
      const result = build(draft().session, today, window.fromDate, window.toDate);
      for (const field of REPORT_FIELDS) {
        if (!state().reportEditedKeys?.includes(field.key)) draft().answers[field.key] = result.answers[field.key] ?? "";
      }
      draft().sourceAttemptIds = result.sourceAttemptIds;
      draft().sourceLcwoIds = result.sourceLcwoIds;
      renderedId = undefined;
      saveLocal();
    }
    const version = JSON.stringify([snapshot().lcwo?.configured, snapshot().lcwo?.syncedAt, snapshot().lcwo?.runs.map(run => run.id)]);
    if (importedVersion !== version) {
      importedVersion = version;
      renderedId = undefined;
      if (snapshot().lcwo && [draft().fromDate, draft().toDate, draft().reportDate].every(isReportDate)) {
        state().reportDraft = applyReportSuggestions(draft(), build(draft().session, draft().reportDate, draft().fromDate, draft().toDate), state().reportEditedKeys ?? []);
        renderedId = undefined;
        saveLocal();
      }
    }
    if (renderedId === draft().id) { status(); return; }
    const current = draft();
    const result = build(current.session, current.reportDate, current.fromDate, current.toDate);
    const meeting = snapshot().course.meetings.find(meeting => meeting.session === current.session);
    const target = meeting ? new Intl.DateTimeFormat("en-US", { timeZone: snapshot().course.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(Date.parse(meeting.startsAt) - 2 * 60 * 60_000)) : "";
    const sections = [...new Set(REPORT_FIELDS.map(field => field.section))];
    // An automatic import can finish while the user is typing or confirming a form handoff.
    const focused = document.activeElement;
    const focusedId = focused instanceof HTMLElement && root.contains(focused) ? focused.id : "";
    const selection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
      ? { start: focused.selectionStart, end: focused.selectionEnd } : undefined;
    const expanded = renderedSession === current.session ? new Map([...root.querySelectorAll<HTMLDetailsElement>("[data-report-section]")]
      .map(details => [details.dataset.reportSection, details.open])) : new Map<string | undefined, boolean>();
    const handoffConfirmed = !!state().reportHandoff && root.querySelector<HTMLElement>("[data-report-handoff]")?.dataset.copyId === state().reportHandoff!.id
      && root.querySelector<HTMLInputElement>("[data-report-confirm]")?.checked;
    root.innerHTML = `<div class="training-today-heading"><div><p class="eyebrow">Before class</p><h2>Session report</h2></div><p>Send around ${escape(target)}</p></div>
      <p>Review your practice, fill any gaps, then open Bob's form with your answers ready. Fields marked * are required to open the completed form.</p>
      <div class="training-card"><div class="training-report-controls"><label>Class<select data-report-session>${snapshot().course.meetings.map(meeting => `<option value="${meeting.session}"${meeting.session === current.session ? " selected" : ""}>Session ${meeting.session} · ${escape(dateInTimezone(meeting.startsAt, snapshot().course.timezone))}</option>`).join("")}</select></label><label>Practice from<input data-report-window="fromDate" type="date" value="${escape(current.fromDate)}" /></label><label>Through<input data-report-window="toDate" type="date" value="${escape(current.toDate)}" /></label></div><p class="training-small">Dates use ${escape(snapshot().course.timezone)}. Each run counts separately; the highest Verified Pts wins among runs up to 15 minutes, with longer runs breaking ties.</p><button type="button" data-report-action="refresh">Refresh from practice</button><p data-report-save-state class="training-small"></p></div>
      <div class="training-card"><h3>LCWO results</h3><p>${snapshot().lcwo?.configured ? "Saved results sync when you open Report. Scores and effective speeds fill automatically; add the details LCWO does not export." : "LCWO syncing has not been connected yet. You can still fill in results below."}</p><button type="button" data-report-action="lcwo-sync"${snapshot().lcwo?.configured ? "" : " disabled"}>Sync LCWO</button><p data-lcwo-status role="status" class="training-small" aria-live="polite"></p>${result.lcwoSources.length ? `<details class="training-panel" data-lcwo-details><summary>Imported runs and missing details (${result.lcwoSources.length})</summary><div class="training-panel-body"><p class="training-small">Maximum copied speed may differ from your training speed. Stored accuracy may differ from LCWO's displayed Errors percentage. Fill those report values from your exercise.</p><ul data-lcwo-sources>${lcwoSources(result)}</ul></div></details>` : '<p class="training-small">No imported results selected for this practice window. The latest result for each drill is used, including results entered with saved practice.</p>'}</div>
      <form data-report-form novalidate>${sections.map(section => {
        const fields = REPORT_FIELDS.filter(field => field.section === section && field.key !== "session");
        const filled = fields.filter(field => current.answers[field.key]?.trim()).length;
        return `<details class="training-panel" data-report-section="${escape(section)}"${section === "Identity" || section === "Sending" || filled ? " open" : ""}><summary>${escape(section)}<span class="training-panel-meta">${filled} / ${fields.length} answers</span></summary><div class="training-panel-body"><div class="training-report-fields">${fields.map(input).join("")}</div>${section === "New words" ? '<p class="training-small">Use Learned: word, another word in a saved scratchpad. Previously submitted words are omitted; edit this list as needed.</p>' : section === "MST/SST/CWT monitoring" ? '<p class="training-small">Saved CWT results suggest stations, exchanges, and comments here. QSO counts appear in comments. Review or add details from other events.</p>' : section === "On-air QSOs" ? '<p class="training-small">Review actual training contacts and names, including saved CWT results. Keep calls and names in the same order.</p>' : ""}</div></details>`;
      }).join("")}<div class="training-report-actions training-actions"><button type="button" data-report-action="save">Save draft</button><button type="button" class="primary" data-report-action="open">Open filled Google Form</button><button type="button" data-report-action="export">Download report</button></div></form>
      <p data-report-message role="status" class="training-notice" aria-live="polite"></p>
      <details class="training-panel"><summary>Practice sources and QSO counts</summary><div class="training-panel-body">${result.sources.length ? `<ul>${result.sources.map(source => `<li>${escape(source.description)}</li>`).join("")}</ul>` : '<p>No recorded results in this window yet. You can enter answers above.</p>'}${result.warnings.map(warning => `<p class="training-small">${escape(warning)}</p>`).join("")}</div></details>
      <div data-report-handoff class="training-card" hidden></div><h3>Submitted reports</h3><div data-report-history></div>`;
    renderedId = current.id;
    renderedSession = current.session;
    status();
    for (const details of root.querySelectorAll<HTMLDetailsElement>("[data-report-section]")) {
      const open = expanded.get(details.dataset.reportSection);
      if (open !== undefined) details.open = open;
    }
    if (handoffConfirmed) root.querySelector<HTMLInputElement>("[data-report-confirm]")!.checked = true;
    const replacement = focusedId ? root.querySelector<HTMLElement>(`#${CSS.escape(focusedId)}`) : undefined;
    replacement?.focus({ preventScroll: true });
    if ((replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement) && selection?.start != null && selection.end != null)
      replacement.setSelectionRange(selection.start, selection.end);
  }

  root.addEventListener("input", event => {
    const control = event.target as HTMLInputElement;
    if (control.dataset.reportAnswer) {
      const key = control.dataset.reportAnswer;
      draft().answers[key] = control.value;
      state().reportEditedKeys = [...new Set([...(state().reportEditedKeys ?? []), key])];
      if (key === "reportDate") draft().reportDate = control.value;
      saveLocal();
      if (/^(callsign|words|letters|figures|custom)/.test(key)) {
        const sources = root.querySelector<HTMLElement>("[data-lcwo-sources]");
        if (sources) sources.innerHTML = lcwoSources(build(draft().session, draft().reportDate, draft().fromDate, draft().toDate));
      }
    } else if (control.dataset.reportWindow) {
      draft()[control.dataset.reportWindow as "fromDate" | "toDate"] = control.value;
      // A deliberately selected window pins its associated report date too.
      state().reportEditedKeys = [...new Set([...(state().reportEditedKeys ?? []), "reportDate"])];
      saveLocal();
    }
  });
  root.addEventListener("change", event => {
    const control = event.target as HTMLSelectElement;
    if (control.hasAttribute("data-report-session")) { saveLocal(); start(Number(control.value)); }
  });
  root.addEventListener("submit", event => event.preventDefault());
  root.addEventListener("click", async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-report-action]");
    if (!button || busy) return;
    const action = button.dataset.reportAction;
    if (action === "lcwo-sync") { await syncLcwo(); return; }
    if (action === "refresh") { refresh(); return; }
    if (action === "submitted") {
      const handoff = state().reportHandoff;
      if (!handoff || !root.querySelector<HTMLInputElement>("[data-report-confirm]")?.checked) {
        message("Confirm that Google Forms accepted this copy before recording its submission."); return;
      }
      busy = true;
      try {
        const now = new Date().toISOString();
        await options.save({ ...structuredClone(handoff), id: crypto.randomUUID(), status: "submitted", createdAt: now, submittedAt: now });
        delete state().reportHandoff;
        await options.persist();
        status();
        message("Submission recorded. These learned words will be omitted from future reports.");
      } catch (error) {
        message(error instanceof Error ? error.message : "The submission confirmation could not be saved.");
      } finally { busy = false; }
      return;
    }
    const problems = errors(action === "open");
    if (problems.length) {
      message(problems.join(" "));
      root.querySelector<HTMLElement>("[data-report-message]")!.scrollIntoView({ block: "center" });
      return;
    }
    const copy: TrainingReport = { ...structuredClone(draft()), id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "draft", editedAnswerKeys: [...(state().reportEditedKeys ?? [])] };
    if (action === "export") {
      const blob = new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `cwa-session-${copy.session}-${copy.reportDate}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message("Report downloaded."); return;
    }
    busy = true;
    try {
      if (action === "open") {
        // The explicit click opens a responder draft only, never submits it.
        const url = buildPrefilledReportUrl(copy.answers);
        state().reportHandoff = copy;
        window.open(url, "_blank", "noopener,noreferrer");
      }
      await options.save(copy);
      await options.persist();
      status();
      message(action === "open" ? "The filled form opened in a new tab. Submit it there, then record its confirmation below. If a popup was blocked, allow it and open the form again." : "Draft saved. It will sync with your training account.");
    } catch (error) {
      message(error instanceof Error ? error.message : "The report could not be saved. Your draft is still on this device.");
    } finally { busy = false; }
  });
  return { render, setVisible(visible: boolean) {
    if (!visible) { autoSyncAttempted = false; return; }
    render();
    if (autoSyncAttempted || !state().snapshot?.lcwo?.configured) return;
    autoSyncAttempted = true;
    const last = Date.parse(snapshot().lcwo?.syncedAt ?? "");
    if (!Number.isFinite(last) || Date.now() - last >= 5 * 60_000) void syncLcwo();
  } };
}

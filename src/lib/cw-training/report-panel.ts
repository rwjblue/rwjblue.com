import { REPORT_FIELDS, buildPrefilledReportUrl, isReportDate, validateReportAnswers, type ReportField } from "./report-fields";
import { buildReportDraft, reportWindowForSession } from "./report";
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
}

/** All report answers live in private device/account state, never page markup or URL history. */
export function createTrainingReportPanel(root: HTMLElement, options: ReportPanelOptions) {
  let renderedId: string | undefined;
  let busy = false;
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
      callsign: identity.callsign ?? "N1RWJ", firstName: identity.firstName ?? "Rob", reports: reports(),
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
      state().reportDraft = { id: crypto.randomUUID(), session, reportDate: today, ...window, createdAt: new Date().toISOString(), status: "draft", answers: result.answers, sourceAttemptIds: result.sourceAttemptIds };
      state().reportEditedKeys = [];
    }
    renderedId = undefined;
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
    const edited = new Set(state().reportEditedKeys ?? []);
    for (const field of REPORT_FIELDS) {
      if (!edited.has(field.key)) {
        if (result.answers[field.key] !== undefined) draft().answers[field.key] = result.answers[field.key];
        else delete draft().answers[field.key];
      }
    }
    draft().sourceAttemptIds = result.sourceAttemptIds;
    renderedId = undefined;
    saveLocal();
    render();
    message("Practice answers refreshed. Your edited answers are preserved.");
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
      renderedId = undefined;
      saveLocal();
    }
    if (renderedId === draft().id) { status(); return; }
    const current = draft();
    const result = build(current.session, current.reportDate, current.fromDate, current.toDate);
    const meeting = snapshot().course.meetings.find(meeting => meeting.session === current.session);
    const target = meeting ? new Intl.DateTimeFormat("en-US", { timeZone: snapshot().course.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(Date.parse(meeting.startsAt) - 2 * 60 * 60_000)) : "";
    const sections = [...new Set(REPORT_FIELDS.map(field => field.section))];
    root.innerHTML = `<div class="training-today-heading"><div><p class="eyebrow">Before class</p><h2>Session report</h2></div><p>Send around ${escape(target)}</p></div>
      <p>Review your practice, fill any gaps, then open Bob's form with your answers ready. Fields marked * are required to open the completed form.</p>
      <div class="training-card"><div class="training-report-controls"><label>Class<select data-report-session>${snapshot().course.meetings.map(meeting => `<option value="${meeting.session}"${meeting.session === current.session ? " selected" : ""}>Session ${meeting.session} · ${escape(dateInTimezone(meeting.startsAt, snapshot().course.timezone))}</option>`).join("")}</select></label><label>Practice from<input data-report-window="fromDate" type="date" value="${escape(current.fromDate)}" /></label><label>Through<input data-report-window="toDate" type="date" value="${escape(current.toDate)}" /></label></div><p class="training-small">Dates use ${escape(snapshot().course.timezone)}. Each run counts separately; the highest Verified Pts wins among runs up to 15 minutes, with longer runs breaking ties.</p><button type="button" data-report-action="refresh">Refresh from practice</button><p data-report-save-state class="training-small"></p></div>
      <form data-report-form novalidate>${sections.map(section => {
        const fields = REPORT_FIELDS.filter(field => field.section === section && field.key !== "session");
        const filled = fields.filter(field => current.answers[field.key]?.trim()).length;
        return `<details class="training-panel"${section === "Identity" || section === "Sending" || filled ? " open" : ""}><summary>${escape(section)}<span class="training-panel-meta">${filled} / ${fields.length} answers</span></summary><div class="training-panel-body"><div class="training-report-fields">${fields.map(input).join("")}</div>${section === "New words" ? '<p class="training-small">Use Learned: word, another word in a saved scratchpad. Previously submitted words are omitted; edit this list as needed.</p>' : section === "MST/SST/CWT monitoring" ? '<p class="training-small">Enter stations and exchanges you heard during training.</p>' : section === "On-air QSOs" ? '<p class="training-small">Enter actual training contacts and names. Keep calls and names in the same order.</p>' : ""}</div></details>`;
      }).join("")}<div class="training-report-actions training-actions"><button type="button" data-report-action="save">Save draft</button><button type="button" class="primary" data-report-action="open">Open filled Google Form</button><button type="button" data-report-action="export">Download report</button></div></form>
      <p data-report-message role="status" class="training-notice" aria-live="polite"></p>
      <details class="training-panel"><summary>Practice used for suggestions</summary><div class="training-panel-body">${result.sources.length ? `<ul>${result.sources.map(source => `<li>${escape(source.description)}</li>`).join("")}</ul>` : '<p>No recorded results in this window yet. You can enter answers above.</p>'}${result.warnings.map(warning => `<p class="training-small">${escape(warning)}</p>`).join("")}</div></details>
      <div data-report-handoff class="training-card" hidden></div><h3>Submitted reports</h3><div data-report-history></div>`;
    renderedId = current.id;
    status();
  }

  root.addEventListener("input", event => {
    const control = event.target as HTMLInputElement;
    if (control.dataset.reportAnswer) {
      const key = control.dataset.reportAnswer;
      draft().answers[key] = control.value;
      state().reportEditedKeys = [...new Set([...(state().reportEditedKeys ?? []), key])];
      if (key === "reportDate") draft().reportDate = control.value;
      saveLocal();
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
  return { render };
}

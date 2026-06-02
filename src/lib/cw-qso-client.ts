import {
  buildAdifFile,
  createEmptyValues,
  createLogEntry,
  FIELD_DEFAULTS,
  getAutoGreeting,
  isFilled,
  LOG_KEY,
  normalizeRole,
  PERSISTED_FIELDS,
  renderTransmissions,
  STEP_OWNER,
  STEP_TEXT,
  utcDate,
  type CwQsoFieldId,
  type CwQsoLogEntry,
  type CwQsoRole,
} from "./cw-qso";

type InputControl = HTMLInputElement | HTMLSelectElement;

export function initCwQsoTool(rootId = "cw-qso-tool"): void {
  const root = document.getElementById(rootId);
  if (!(root instanceof HTMLElement)) return;

  const fieldIds = Object.keys(FIELD_DEFAULTS) as CwQsoFieldId[];
  const values = createEmptyValues();
  let role: CwQsoRole = normalizeRole(readStorage("cwqso.role"));
  let qsoStart: number | null = null;

  const getControl = (id: string): InputControl => {
    const el = root.querySelector(`#${id}`);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) {
      throw new Error(`Missing CW QSO control: ${id}`);
    }
    return el;
  };

  const getElement = <T extends Element>(selector: string): T => {
    const el = root.querySelector(selector);
    if (!el) throw new Error(`Missing CW QSO element: ${selector}`);
    return el as T;
  };

  function syncValuesFromDom(): void {
    for (const id of fieldIds) {
      values[id] = getControl(id).value;
    }
  }

  function loadPersistedFields(): void {
    for (const id of fieldIds) {
      if (!PERSISTED_FIELDS.has(id)) continue;
      const stored = readStorage(`cwqso.${id}`);
      if (stored != null) getControl(id).value = stored;
    }

    getControl("greet").value = getAutoGreeting();
    syncValuesFromDom();
  }

  function saveField(id: CwQsoFieldId): void {
    if (!PERSISTED_FIELDS.has(id)) return;
    writeStorage(`cwqso.${id}`, getControl(id).value);
  }

  function loadLog(): CwQsoLogEntry[] {
    const raw = readStorage(LOG_KEY);
    if (!raw) return [];

    try {
      return JSON.parse(raw) as CwQsoLogEntry[];
    } catch {
      return [];
    }
  }

  function persistLog(log: CwQsoLogEntry[]): void {
    writeStorage(LOG_KEY, JSON.stringify(log));
  }

  function renderLog(): void {
    const body = getElement<HTMLElement>("#logBody");
    const count = getElement<HTMLElement>("#logCount");
    const downloadBtn = getElement<HTMLButtonElement>("#downloadBtn");
    const clearLogBtn = getElement<HTMLButtonElement>("#clearLogBtn");
    const log = loadLog();

    if (log.length === 0) {
      body.innerHTML =
        '<p class="cw-empty">No QSOs logged yet. Save one when a contact is complete.</p>';
      count.textContent = "";
      downloadBtn.disabled = true;
      clearLogBtn.disabled = true;
      return;
    }

    const rows = log
      .slice()
      .reverse()
      .map((entry) => {
        const idx = log.indexOf(entry);
        const freqStr = entry.freq ? ` (${escapeHtml(entry.freq)})` : "";
        return `<tr>
          <td class="cw-time">${escapeHtml(entry.qsoDate)} ${escapeHtml(entry.timeOn)}Z</td>
          <td class="cw-call">${escapeHtml(entry.call)}</td>
          <td>${escapeHtml(entry.name || "-")}</td>
          <td>${escapeHtml(entry.qth || "-")}</td>
          <td>${escapeHtml(entry.band || "-")}${freqStr}</td>
          <td>${escapeHtml(entry.rstSent || "")}/${escapeHtml(entry.rstRcvd || "")}</td>
          <td><button type="button" class="cw-del-btn" data-idx="${idx}" title="Delete">x</button></td>
        </tr>`;
      })
      .join("");

    body.innerHTML = `<table>
      <thead>
        <tr>
          <th>UTC</th><th>Call</th><th>Name</th><th>QTH</th><th>Band</th><th>RST s/r</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

    count.textContent = `${log.length} QSO${log.length === 1 ? "" : "s"} logged`;
    downloadBtn.disabled = false;
    clearLogBtn.disabled = false;

    body.querySelectorAll<HTMLButtonElement>(".cw-del-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const idx = Number.parseInt(button.dataset.idx ?? "", 10);
        if (!Number.isFinite(idx)) return;
        if (!window.confirm("Delete this QSO?")) return;
        const nextLog = loadLog();
        nextLog.splice(idx, 1);
        persistLog(nextLog);
        renderLog();
      });
    });
  }

  function render(): void {
    syncValuesFromDom();
    const tx = renderTransmissions(role, values);
    setHtml("tx1", tx.tx1);
    setHtml("tx2", tx.tx2);
    setHtml("tx3", tx.tx3);
    setHtml("tx4", tx.tx4);
    setHtml("tx5", tx.tx5);
    setHtml("tx6", tx.tx6);
    setHtml("tx7", tx.tx7);
    setHtml("tx8", tx.tx8);
    setHtml("tx9", tx.tx9);
    setHtml("tx10", tx.tx10);
    setHtml("wQrz", tx.wQrz);
    setText("wAgnName", tx.wAgnName);
    setText("wAgnName2", tx.wAgnName);
    setText("wAgnQth", tx.wAgnQth);
    setText("wAgnQth2", tx.wAgnQth);
  }

  function applyRole(): void {
    root.querySelectorAll<HTMLButtonElement>(".cw-role-opt").forEach((button) => {
      button.classList.toggle("active", button.dataset.role === role);
    });

    const myStation = role === "cq" ? "stn1" : "stn2";
    Object.keys(STEP_TEXT).forEach((key) => {
      const stepEl = root.querySelector(`.cw-step[data-step="${key}"]`);
      if (!(stepEl instanceof HTMLElement)) return;

      const stepText = STEP_TEXT[Number(key)];
      const isMine = STEP_OWNER[Number(key)] === myStation;

      stepEl.classList.toggle("cw-step-you", isMine);
      stepEl.classList.toggle("cw-step-them", !isMine);
      stepEl.querySelector(".cw-who")!.textContent = isMine ? "You send" : "They send";
      stepEl.querySelector(".cw-step-title")!.textContent =
        role === "cq" ? stepText.titleCq : stepText.titleAns;
      (stepEl.querySelector(".cw-tip") as HTMLElement).innerHTML =
        role === "cq" ? stepText.tipCq : stepText.tipAns;
    });

    render();
  }

  function resetOtherStation(): void {
    ([
      "hisCall",
      "hisName",
      "hisQth",
      "hisRst",
      "hisRig",
      "hisPwr",
      "hisAnt",
      "hisWx",
      "hisHamYears",
      "hisAge",
      "hisJob",
    ] as const).forEach((id) => {
      getControl(id).value = "";
      getControl(id).dispatchEvent(new Event("input", { bubbles: true }));
    });
    qsoStart = null;
  }

  function saveCurrentQso(): void {
    syncValuesFromDom();

    if (!isFilled(values, "myCall")) {
      window.alert("Set your callsign in the 'Your info' section first.");
      getControl("myCall").focus();
      return;
    }

    if (!isFilled(values, "hisCall")) {
      window.alert("Need their callsign before saving.");
      getControl("hisCall").focus();
      return;
    }

    const now = new Date();
    const entry = createLogEntry(values, now, qsoStart);
    const log = loadLog();
    log.push(entry);
    persistLog(log);

    ([
      "hisCall",
      "hisName",
      "hisQth",
      "hisRst",
      "hisRig",
      "hisPwr",
      "hisAnt",
      "hisWx",
      "hisHamYears",
      "hisAge",
      "hisJob",
      "comment",
    ] as const).forEach((id) => {
      getControl(id).value = "";
      getControl(id).dispatchEvent(new Event("input", { bubbles: true }));
    });

    qsoStart = null;
    renderLog();
  }

  function downloadAdi(): void {
    const log = loadLog();
    if (log.length === 0) return;

    const content = buildAdifFile(log);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cwqso-log-${utcDate(new Date())}.adi`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setupFieldSync(masterId: CwQsoFieldId): void {
    const master = getControl(masterId);
    const slaves = root.querySelectorAll<HTMLInputElement>(`[data-master="${masterId}"]`);

    slaves.forEach((slave) => {
      slave.value = master.value;
    });

    slaves.forEach((slave) => {
      slave.addEventListener("input", () => {
        master.value = slave.value;
        master.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    master.addEventListener("input", () => {
      slaves.forEach((slave) => {
        if (slave !== document.activeElement) slave.value = master.value;
      });
    });
  }

  loadPersistedFields();

  fieldIds.forEach((id) => {
    const control = getControl(id);
    const evt = control instanceof HTMLSelectElement ? "change" : "input";
    control.addEventListener(evt, () => {
      saveField(id);
      render();
    });
  });

  getControl("hisCall").addEventListener("input", () => {
    syncValuesFromDom();
    if (qsoStart === null && isFilled(values, "hisCall")) {
      qsoStart = Date.now();
    } else if (qsoStart !== null && !isFilled(values, "hisCall")) {
      qsoStart = null;
    }
  });

  getElement<HTMLButtonElement>("#resetBtn").addEventListener("click", resetOtherStation);
  getElement<HTMLButtonElement>("#saveBtn").addEventListener("click", saveCurrentQso);
  getElement<HTMLButtonElement>("#downloadBtn").addEventListener("click", downloadAdi);
  getElement<HTMLButtonElement>("#clearLogBtn").addEventListener("click", () => {
    const log = loadLog();
    if (log.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${log.length} logged QSO${log.length === 1 ? "" : "s"}? This can't be undone.`,
      )
    ) {
      return;
    }

    persistLog([]);
    renderLog();
  });

  root.querySelectorAll<HTMLButtonElement>(".cw-inline-save-btn").forEach((button) => {
    button.addEventListener("click", saveCurrentQso);
  });

  root.querySelectorAll<HTMLButtonElement>(".cw-role-opt").forEach((button) => {
    button.addEventListener("click", () => {
      role = normalizeRole(button.dataset.role);
      writeStorage("cwqso.role", role);
      applyRole();
    });
  });

  ([
    "hisCall",
    "hisName",
    "hisQth",
    "hisRst",
    "hisRig",
    "hisPwr",
    "hisAnt",
    "hisWx",
    "hisHamYears",
    "hisAge",
    "hisJob",
  ] as const).forEach(setupFieldSync);

  applyRole();
  renderLog();

  function setHtml(id: string, html: string): void {
    getElement<HTMLElement>(`#${id}`).innerHTML = html;
  }

  function setText(id: string, text: string): void {
    getElement<HTMLElement>(`#${id}`).textContent = text;
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );
}

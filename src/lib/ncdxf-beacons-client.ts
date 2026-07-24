import {
  gridToLatLon,
  latLonToGrid,
  type LatLon,
} from "./geo.ts";
import {
  NCDXF_BANDS,
  NCDXF_BEACONS,
  beaconBearingDegrees,
  beaconDistanceMiles,
  beaconWindowAt,
  powerLabel,
  powerMarginDb,
  summarizeBandObservations,
  transmissionAt,
  type BeaconObservation,
  type BeaconPower,
  type NcdxfBeacon,
} from "./ncdxf-beacons.ts";

const STORAGE_GRID = "ncdxfBeacons.grid";
const STORAGE_OBSERVATIONS = "ncdxfBeacons.observations.v1";
const RECENT_OBSERVATION_MS = 30 * 60 * 1000;

export function initNcdxfBeaconTool(rootId = "ncdxf-beacon-tool"): void {
  const root = document.getElementById(rootId);
  if (!(root instanceof HTMLElement)) return;

  const utcClock = getElement<HTMLElement>(root, "#beacon-utc-clock");
  const useLocationButton = getElement<HTMLButtonElement>(root, "#beacon-use-location");
  const gridInput = getElement<HTMLInputElement>(root, "#beacon-grid");
  const applyGridButton = getElement<HTMLButtonElement>(root, "#beacon-apply-grid");
  const locationStatus = getElement<HTMLElement>(root, "#beacon-location-status");
  const viewButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-beacon-view]")];
  const viewPanels = [...root.querySelectorAll<HTMLElement>("[data-beacon-panel]")];
  const nowGrid = getElement<HTMLElement>(root, "#beacon-now-grid");
  const recommendation = getElement<HTMLElement>(root, "#beacon-recommendation");
  const scanBand = getElement<HTMLSelectElement>(root, "#beacon-scan-band");
  const scanFrequency = getElement<HTMLElement>(root, "#beacon-scan-frequency");
  const scanSlot = getElement<HTMLElement>(root, "#beacon-scan-slot");
  const scanCall = getElement<HTMLElement>(root, "#beacon-scan-call");
  const scanLocation = getElement<HTMLElement>(root, "#beacon-scan-location");
  const scanPath = getElement<HTMLElement>(root, "#beacon-scan-path");
  const scanStatus = getElement<HTMLElement>(root, "#beacon-scan-status");
  const scanProgress = getElement<HTMLElement>(root, "#beacon-scan-progress");
  const scanLog = getElement<HTMLElement>(root, "#beacon-scan-log");
  const scanRecorded = getElement<HTMLElement>(root, "#beacon-scan-recorded");
  const pathBeacon = getElement<HTMLSelectElement>(root, "#beacon-path-beacon");
  const pathCall = getElement<HTMLElement>(root, "#beacon-path-call");
  const pathLocation = getElement<HTMLElement>(root, "#beacon-path-location");
  const pathPrompt = getElement<HTMLElement>(root, "#beacon-path-prompt");
  const pathFrequency = getElement<HTMLElement>(root, "#beacon-path-frequency");
  const pathCountdown = getElement<HTMLElement>(root, "#beacon-path-countdown");
  const pathBands = getElement<HTMLElement>(root, "#beacon-path-bands");
  const pathRecommendation = getElement<HTMLElement>(root, "#beacon-path-recommendation");
  const pathRecorded = getElement<HTMLElement>(root, "#beacon-path-recorded");
  const clearButton = getElement<HTMLButtonElement>(root, "#beacon-clear-observations");

  let origin: LatLon | null = null;
  let observations = readObservations();
  let activeView = "now";

  const urlGrid = normalizeGrid(new URLSearchParams(window.location.search).get("grid"));
  const initialGrid = urlGrid ?? normalizeGrid(readStorage(STORAGE_GRID));
  if (initialGrid) {
    gridInput.value = initialGrid;
    setGrid(initialGrid, false);
  } else {
    setLocationStatus("Add a grid for bearings and distances. The beacon clock works without it.");
    void useGrantedBrowserLocation();
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.beaconView;
      if (!view) return;
      activeView = view;
      updateViews();
      render(new Date());
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-beacon-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.beaconJump;
      if (!view) return;
      activeView = view;
      updateViews();
      render(new Date());
    });
  });

  scanBand.addEventListener("change", () => render(new Date()));
  pathBeacon.addEventListener("change", () => render(new Date()));
  useLocationButton.addEventListener("click", () => requestBrowserLocation(true));
  applyGridButton.addEventListener("click", applyGrid);
  gridInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyGrid();
  });

  clearButton.addEventListener("click", () => {
    observations = [];
    writeStorage(STORAGE_OBSERVATIONS, "[]");
    scanRecorded.textContent = "Local observations cleared.";
    pathRecorded.textContent = "Local observations cleared.";
    render(new Date());
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const power = target.dataset.beaconPower as BeaconPower | undefined;
    const mode = target.dataset.beaconMode;
    if (!power || !mode) return;

    const now = new Date();
    if (mode === "scan") {
      const bandIndex = scanBand.selectedIndex;
      const transmission = transmissionAt(now, bandIndex);
      recordObservation({
        bandIndex,
        beaconIndex: transmission.beaconIndex,
        power,
        observedAt: now.toISOString(),
      });
      scanRecorded.textContent = observationMessage(transmission.beacon, power);
    }

    if (mode === "path") {
      const beaconIndex = pathBeacon.selectedIndex;
      const windowState = beaconWindowAt(now, beaconIndex);
      if (windowState.activeBandIndex === null) return;
      recordObservation({
        bandIndex: windowState.activeBandIndex,
        beaconIndex,
        power,
        observedAt: now.toISOString(),
      });
      pathRecorded.textContent = `${windowState.activeBand.label}: ${observationMessage(
        windowState.beacon,
        power,
      )}`;
    }

    render(now);
  });

  updateViews();
  render(new Date());
  window.setInterval(() => render(new Date()), 250);

  function updateViews(): void {
    viewButtons.forEach((button) => {
      const isActive = button.dataset.beaconView === activeView;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    viewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.beaconPanel !== activeView;
    });
  }

  function render(now: Date): void {
    utcClock.textContent = `${now.toISOString().slice(11, 19)} UTC`;
    renderNow(now);
    if (activeView === "scan") renderScan(now);
    if (activeView === "path") renderPath(now);
  }

  function renderNow(now: Date): void {
    nowGrid.innerHTML = NCDXF_BANDS.map((band, bandIndex) => {
      const transmission = transmissionAt(now, bandIndex);
      const path = formatPath(transmission.beacon);
      const status =
        transmission.beacon.status === "off"
          ? '<span class="beacon-offline">reported off</span>'
          : "";
      return `<button type="button" class="beacon-now-item" data-now-band="${bandIndex}">
        <span class="beacon-now-band">${escapeHtml(band.label)}</span>
        <span class="beacon-now-frequency">${formatFrequency(band.frequencyMHz)} MHz</span>
        <strong>${escapeHtml(transmission.beacon.call)}</strong>
        <span>${escapeHtml(transmission.beacon.entity)}</span>
        <span class="beacon-now-path">${escapeHtml(path)}</span>
        <span class="beacon-now-countdown">${transmission.secondsRemaining}s ${status}</span>
      </button>`;
    }).join("");

    nowGrid.querySelectorAll<HTMLButtonElement>("[data-now-band]").forEach((button) => {
      button.addEventListener("click", () => {
        scanBand.selectedIndex = Number(button.dataset.nowBand ?? 0);
        activeView = "scan";
        updateViews();
        render(new Date());
      });
    });

    const recent = recentObservations(now);
    const ranked = summarizeBandObservations(recent);
    const best = ranked.find((summary) => summary.bestPower && summary.bestPower !== "none");

    if (!best) {
      recommendation.innerHTML = `<strong>No local band result yet.</strong>
        <span>Run a 50-second path check or listen to one band for three minutes.</span>`;
      return;
    }

    recommendation.innerHTML = `<strong>Start with ${escapeHtml(best.band.label)}.</strong>
      <span>${best.heard} beacon${best.heard === 1 ? "" : "s"} heard; best step ${escapeHtml(
        powerLabel(best.bestPower),
      )} in the last 30 minutes.</span>`;
  }

  function renderScan(now: Date): void {
    const bandIndex = scanBand.selectedIndex;
    const transmission = transmissionAt(now, bandIndex);
    scanFrequency.textContent = `${formatFrequency(transmission.band.frequencyMHz)} MHz CW`;
    scanSlot.textContent = `${transmission.secondsRemaining}s left · slot ${
      transmission.beaconIndex + 1
    } of 18`;
    scanCall.textContent = transmission.beacon.call;
    scanLocation.textContent = `${transmission.beacon.entity} · ${transmission.beacon.location}`;
    scanPath.textContent = formatPath(transmission.beacon);
    scanStatus.textContent =
      transmission.beacon.status === "off"
        ? "NCDXF currently reports this beacon off the air."
        : "Callsign and first dash are 100 W, followed by 10 W, 1 W, and 100 mW.";

    scanProgress.innerHTML = NCDXF_BEACONS.map((beacon, beaconIndex) => {
      const currentClass = beaconIndex === transmission.beaconIndex ? " is-current" : "";
      const heard = observations.some(
        (observation) =>
          observation.bandIndex === bandIndex &&
          observation.beaconIndex === beaconIndex &&
          Date.parse(observation.observedAt) >= now.getTime() - RECENT_OBSERVATION_MS,
      );
      return `<span class="${heard ? "is-checked" : ""}${currentClass}" aria-label="${escapeHtml(
        beacon.call,
      )}${heard ? " checked" : ""}"></span>`;
    }).join("");

    const recentForBand = recentObservations(now)
      .filter((observation) => observation.bandIndex === bandIndex)
      .slice(-6)
      .reverse();
    scanLog.innerHTML =
      recentForBand.length === 0
        ? '<p class="beacon-empty">No observations recorded on this band yet.</p>'
        : `<ol>${recentForBand
            .map((observation) => {
              const beacon = NCDXF_BEACONS[observation.beaconIndex];
              return `<li><strong>${escapeHtml(beacon.call)}</strong><span>${escapeHtml(
                powerLabel(observation.power),
              )}</span></li>`;
            })
            .join("")}</ol>`;

    updatePowerSelection(
      "scan",
      recentForBand.find(
        (observation) => observation.beaconIndex === transmission.beaconIndex,
      )?.power ?? null,
      false,
    );
  }

  function renderPath(now: Date): void {
    const beaconIndex = pathBeacon.selectedIndex;
    const windowState = beaconWindowAt(now, beaconIndex);
    pathCall.textContent = windowState.beacon.call;
    pathLocation.textContent = `${windowState.beacon.entity} · ${windowState.beacon.location} · ${formatPath(
      windowState.beacon,
    )}`;

    if (windowState.activeBand && windowState.activeBandIndex !== null) {
      pathPrompt.textContent = `Listen now on ${windowState.activeBand.label}`;
      pathFrequency.textContent = `${formatFrequency(
        windowState.activeBand.frequencyMHz,
      )} MHz CW`;
      pathCountdown.textContent = `${windowState.secondsRemaining}s left in this transmission`;
    } else {
      pathPrompt.textContent = `Next: ${windowState.nextBand.label}`;
      pathFrequency.textContent = `${formatFrequency(
        windowState.nextBand.frequencyMHz,
      )} MHz CW`;
      pathCountdown.textContent = `Starts in ${formatDuration(windowState.secondsUntilNext)}`;
    }

    const recentForBeacon = recentObservations(now).filter(
      (observation) => observation.beaconIndex === beaconIndex,
    );
    pathBands.innerHTML = NCDXF_BANDS.map((band, bandIndex) => {
      const latest = [...recentForBeacon]
        .reverse()
        .find((observation) => observation.bandIndex === bandIndex);
      const isActive = windowState.activeBandIndex === bandIndex;
      return `<div class="beacon-path-band${isActive ? " is-active" : ""}">
        <div>
          <strong>${escapeHtml(band.label)}</strong>
          <span>${formatFrequency(band.frequencyMHz)} MHz</span>
        </div>
        <span>${escapeHtml(powerLabel(latest?.power ?? null))}</span>
      </div>`;
    }).join("");

    const ranked = summarizeBandObservations(recentForBeacon);
    const best = ranked.find((summary) => summary.bestPower && summary.bestPower !== "none");
    if (!best) {
      pathRecommendation.textContent =
        "Follow the beacon through its five transmissions and record the weakest step on each band.";
    } else {
      const margin = powerMarginDb(best.bestPower ?? "none");
      pathRecommendation.textContent = `${best.band.label} has the strongest observed path: ${powerLabel(
        best.bestPower,
      )}${margin && margin > 0 ? `, ${margin} dB below the 100 W reference` : ""}.`;
    }

    const latestForActive =
      windowState.activeBandIndex === null
        ? null
        : [...recentForBeacon]
            .reverse()
            .find((observation) => observation.bandIndex === windowState.activeBandIndex)?.power ??
          null;
    updatePowerSelection("path", latestForActive, windowState.activeBandIndex === null);
  }

  function updatePowerSelection(
    mode: "scan" | "path",
    selectedPower: BeaconPower | null,
    disabled: boolean,
  ): void {
    root
      .querySelectorAll<HTMLButtonElement>(`[data-beacon-mode="${mode}"]`)
      .forEach((button) => {
        button.disabled = disabled;
        const selected = button.dataset.beaconPower === selectedPower;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
  }

  function recordObservation(observation: BeaconObservation): void {
    observations = observations
      .filter(
        (existing) =>
          existing.bandIndex !== observation.bandIndex ||
          existing.beaconIndex !== observation.beaconIndex ||
          Date.parse(existing.observedAt) < Date.now() - RECENT_OBSERVATION_MS,
      )
      .concat(observation)
      .slice(-200);
    writeStorage(STORAGE_OBSERVATIONS, JSON.stringify(observations));
  }

  function recentObservations(now: Date): BeaconObservation[] {
    const cutoff = now.getTime() - RECENT_OBSERVATION_MS;
    return observations.filter((observation) => Date.parse(observation.observedAt) >= cutoff);
  }

  function observationMessage(beacon: NcdxfBeacon, power: BeaconPower): string {
    if (power === "none") return `${beacon.call} not heard.`;
    return `${beacon.call} heard down to ${powerLabel(power)}.`;
  }

  function applyGrid(): void {
    const grid = normalizeGrid(gridInput.value);
    if (!grid) {
      setLocationStatus("Enter a valid 4- or 6-character Maidenhead grid, such as FN41FR.");
      return;
    }
    setGrid(grid, true);
  }

  function setGrid(grid: string, updateUrl: boolean): void {
    const point = gridToLatLon(grid);
    if (!point) return;
    origin = point;
    gridInput.value = grid;
    writeStorage(STORAGE_GRID, grid);
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("grid", grid);
      window.history.replaceState({}, "", url);
    }
    setLocationStatus(`Operating position set to ${grid}. Bearings and distances are approximate.`);
    render(new Date());
  }

  async function useGrantedBrowserLocation(): Promise<void> {
    if (!navigator.geolocation || !navigator.permissions) return;
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") requestBrowserLocation(false);
    } catch {
      // Permissions queries are not implemented consistently across browsers.
    }
  }

  function requestBrowserLocation(reportErrors: boolean): void {
    if (!navigator.geolocation) {
      if (reportErrors) {
        setLocationStatus("Browser location is unavailable. Enter a Maidenhead grid instead.");
      }
      return;
    }

    if (reportErrors) setLocationStatus("Requesting browser location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        const grid = latLonToGrid(point);
        if (!grid) {
          setLocationStatus("The browser returned an invalid location. Enter a grid instead.");
          return;
        }
        origin = point;
        gridInput.value = grid;
        writeStorage(STORAGE_GRID, grid);
        const url = new URL(window.location.href);
        url.searchParams.set("grid", grid);
        window.history.replaceState({}, "", url);
        setLocationStatus(`Operating position set from this browser (${grid}).`);
        render(new Date());
      },
      () => {
        if (reportErrors) {
          setLocationStatus("Browser location was not available. Enter a Maidenhead grid instead.");
        }
      },
      { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10000 },
    );
  }

  function formatPath(beacon: NcdxfBeacon): string {
    if (!origin) return beacon.grid;
    const bearing = beaconBearingDegrees(origin, beacon);
    const miles = beaconDistanceMiles(origin, beacon);
    if (bearing === null || miles === null) return beacon.grid;
    return `${bearing}° · ${Math.round(miles).toLocaleString()} mi`;
  }

  function setLocationStatus(message: string): void {
    locationStatus.textContent = message;
  }
}

function readObservations(): BeaconObservation[] {
  const raw = readStorage(STORAGE_OBSERVATIONS);
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(isObservation).slice(-200);
  } catch {
    return [];
  }
}

function isObservation(value: unknown): value is BeaconObservation {
  if (!value || typeof value !== "object") return false;
  const observation = value as Partial<BeaconObservation>;
  return (
    Number.isInteger(observation.bandIndex) &&
    Number.isInteger(observation.beaconIndex) &&
    ["none", "100", "10", "1", "0.1"].includes(observation.power ?? "") &&
    typeof observation.observedAt === "string" &&
    Number.isFinite(Date.parse(observation.observedAt))
  );
}

function normalizeGrid(value: string | null): string | null {
  const grid = String(value ?? "").trim().toUpperCase();
  return grid && gridToLatLon(grid) ? grid : null;
}

function formatFrequency(frequencyMHz: number): string {
  return frequencyMHz.toFixed(3);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
  } catch {
    // The tool remains usable without persistence.
  }
}

function getElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing beacon tool element: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

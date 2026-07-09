import L from "leaflet";
import {
  buildRbnMainUrl,
  defaultSelectedSkimmers,
  gridToLatLon,
  parseTargetCalls,
  rankSkimmers,
  type LatLon,
  type RankedSkimmer,
  type RbnNodeRecord,
} from "./rbn-skimmers";

const RBN_NODES_URL = "https://www.reversebeacon.net/nodes/detail_json.php";
const STORAGE_GRID = "rbnSkimmers.grid";
const STORAGE_TARGETS = "rbnSkimmers.targets";
const RESULT_LIMIT = 10;

export function initRbnSkimmerTool(rootId = "rbn-skimmer-tool"): void {
  const root = document.getElementById(rootId);
  if (!(root instanceof HTMLElement)) return;

  const useLocationButton = getElement<HTMLButtonElement>(root, "#rbn-use-location");
  const gridInput = getElement<HTMLInputElement>(root, "#rbn-grid");
  const applyGridButton = getElement<HTMLButtonElement>(root, "#rbn-apply-grid");
  const status = getElement<HTMLElement>(root, "#rbn-status");
  const count = getElement<HTMLElement>(root, "#rbn-count");
  const results = getElement<HTMLElement>(root, "#rbn-results");
  const targetsInput = getElement<HTMLInputElement>(root, "#rbn-targets");
  const openLink = getElement<HTMLAnchorElement>(root, "#rbn-open-link");
  const linkSummary = getElement<HTMLElement>(root, "#rbn-link-summary");
  const mapElement = getElement<HTMLElement>(root, "#rbn-map");

  let nodes: RbnNodeRecord[] = [];
  let origin: LatLon | null = null;
  let ranked: RankedSkimmer[] = [];
  let selectedCalls = new Set<string>();
  let leafletMap: L.Map | null = null;
  let markerLayer: L.LayerGroup | null = null;

  gridInput.value = readStorage(STORAGE_GRID) ?? "";
  targetsInput.value = readStorage(STORAGE_TARGETS) ?? "";
  setupMap();
  updateRbnLink();
  void fetchNodes();

  useLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Browser location is unavailable. Enter a Maidenhead grid instead.");
      return;
    }

    setStatus("Requesting browser location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        origin = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setStatus("Location set from this browser. Ranking active skimmers...");
        render();
      },
      () => {
        setStatus("Browser location was not available. Enter a Maidenhead grid instead.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10000,
      },
    );
  });

  applyGridButton.addEventListener("click", applyGrid);
  gridInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyGrid();
    }
  });

  targetsInput.addEventListener("input", () => {
    writeStorage(STORAGE_TARGETS, targetsInput.value);
    updateRbnLink();
  });

  results.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;

    if (target.checked) {
      selectedCalls.add(target.value);
    } else {
      selectedCalls.delete(target.value);
    }

    updateRbnLink();
    updateMap();
  });

  function applyGrid(): void {
    const grid = gridInput.value.trim().toUpperCase();
    const point = gridToLatLon(grid);

    if (!point) {
      setStatus("Enter a valid 4- or 6-character Maidenhead grid, such as EL96 or EL96WD.");
      return;
    }

    gridInput.value = grid;
    writeStorage(STORAGE_GRID, grid);
    origin = point;
    setStatus(`Location set from grid ${grid}. Ranking active skimmers...`);
    render();
  }

  async function fetchNodes(): Promise<void> {
    setStatus("Fetching active RBN skimmers...");

    try {
      const response = await fetch(RBN_NODES_URL, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`RBN returned ${response.status}`);

      const json = await response.json();
      if (!Array.isArray(json)) throw new Error("RBN response was not a node list");

      nodes = json as RbnNodeRecord[];
      if (origin) {
        render();
      } else {
        setStatus(`Loaded ${nodes.length} active RBN nodes. Enter a grid or use browser location.`);
      }
    } catch {
      setStatus("Could not fetch active RBN nodes. Try again later or open RBN directly.");
      results.innerHTML =
        '<p class="rbn-empty">RBN active-node data is unavailable right now.</p>';
    }
  }

  function render(): void {
    if (!origin) {
      results.innerHTML =
        '<p class="rbn-empty">Enter a grid or use browser location to rank active skimmers.</p>';
      count.textContent = "";
      updateRbnLink();
      updateMap();
      return;
    }

    if (nodes.length === 0) {
      results.innerHTML =
        '<p class="rbn-empty">Waiting for active RBN node data.</p>';
      count.textContent = "";
      updateRbnLink();
      updateMap();
      return;
    }

    ranked = rankSkimmers(nodes, origin).slice(0, RESULT_LIMIT);

    if (ranked.length === 0) {
      results.innerHTML =
        '<p class="rbn-empty">No active skimmers with usable grid squares were found.</p>';
      count.textContent = "";
      selectedCalls.clear();
      updateRbnLink();
      updateMap();
      return;
    }

    const selectedStillVisible = ranked.some((skimmer) => selectedCalls.has(skimmer.call));
    if (!selectedStillVisible) {
      selectedCalls = new Set(defaultSelectedSkimmers(ranked));
    }

    count.textContent = `${ranked.length} shown`;
    results.innerHTML = renderTable(ranked, selectedCalls);
    setStatus(`Ranked ${ranked.length} nearest active skimmers from ${nodes.length} RBN nodes.`);
    updateRbnLink();
    updateMap();
  }

  function renderTable(skimmers: RankedSkimmer[], selected: Set<string>): string {
    return `<table class="rbn-table">
      <thead>
        <tr>
          <th scope="col">Use</th>
          <th scope="col">Rank</th>
          <th scope="col">Skimmer</th>
          <th scope="col">Grid</th>
          <th scope="col">Distance</th>
          <th scope="col">Bands</th>
          <th scope="col">Policy</th>
          <th scope="col">Last seen</th>
        </tr>
      </thead>
      <tbody>
        ${skimmers
          .map((skimmer, index) => {
            const checked = selected.has(skimmer.call) ? " checked" : "";
            return `<tr>
              <td><input type="checkbox" value="${escapeHtml(skimmer.call)}"${checked} aria-label="Use ${escapeHtml(skimmer.call)} on RBN" /></td>
              <td>${index + 1}</td>
              <td><strong>${escapeHtml(skimmer.call)}</strong></td>
              <td>${escapeHtml(skimmer.grid)}</td>
              <td>${formatMiles(skimmer.distanceMiles)}</td>
              <td>${escapeHtml(formatBands(skimmer.bands))}</td>
              <td>${escapeHtml(skimmer.spotPolicy)}</td>
              <td>${escapeHtml(skimmer.lastSeen)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
  }

  function updateRbnLink(): void {
    const spotterCalls = [...selectedCalls];
    const targetCalls = parseTargetCalls(targetsInput.value);
    const href = buildRbnMainUrl({
      spotterCalls,
      targetCalls,
      maxAge: 6,
      maxAgeUnits: "hours",
      rows: 50,
    });

    openLink.href = href;
    openLink.target = "_blank";
    openLink.rel = "noreferrer";
    openLink.setAttribute("aria-disabled", spotterCalls.length === 0 ? "true" : "false");
    linkSummary.textContent =
      spotterCalls.length === 0
        ? "Select at least one skimmer to build a focused RBN link."
        : `RBN will use ${spotterCalls.join(", ")}${targetCalls.length > 0 ? ` for ${targetCalls.join(", ")}` : ""}.`;
  }

  function setupMap(): void {
    try {
      leafletMap = L.map(mapElement, {
        scrollWheelZoom: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(leafletMap);
      markerLayer = L.layerGroup().addTo(leafletMap);
      leafletMap.setView([39, -96], 3);
    } catch {
      mapElement.innerHTML = '<p class="rbn-empty">Map unavailable. The table still works.</p>';
      leafletMap = null;
      markerLayer = null;
    }
  }

  function updateMap(): void {
    if (!leafletMap || !markerLayer) return;

    markerLayer.clearLayers();

    if (!origin) {
      leafletMap.setView([39, -96], 3);
      return;
    }

    const bounds = L.latLngBounds([]);
    const originLatLng: L.LatLngTuple = [origin.lat, origin.lon];
    bounds.extend(originLatLng);

    L.circleMarker(originLatLng, {
      radius: 8,
      color: "#fffdfa",
      weight: 3,
      fillColor: "#172026",
      fillOpacity: 1,
    })
      .addTo(markerLayer)
      .bindPopup("<strong>Operating location</strong>");

    for (const [index, skimmer] of ranked.entries()) {
      const selected = selectedCalls.has(skimmer.call);
      const latLng: L.LatLngTuple = [skimmer.lat, skimmer.lon];
      bounds.extend(latLng);

      L.circleMarker(latLng, {
        radius: selected ? 8 : 5,
        color: selected ? "#172026" : "#5f6f79",
        weight: selected ? 2 : 1.4,
        fillColor: selected ? "#2f6f4e" : "#d9ded8",
        fillOpacity: selected ? 0.92 : 0.76,
      })
        .addTo(markerLayer)
        .bindPopup(
          `<strong>${index + 1}. ${escapeHtml(skimmer.call)}</strong><span>${escapeHtml(skimmer.grid)} · ${formatMiles(skimmer.distanceMiles)} · ${escapeHtml(formatBands(skimmer.bands))}</span>`,
        );
    }

    if (bounds.isValid()) {
      leafletMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 8 });
    }
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }
}

function getElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing RBN skimmer element: ${selector}`);
  return element as T;
}

function formatMiles(value: number): string {
  return `${Math.round(value).toLocaleString()} mi`;
}

function formatBands(bands: string[]): string {
  return bands.length > 0 ? bands.join(", ") : "-";
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (value.trim() === "") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage is optional; private browsing modes can reject writes.
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

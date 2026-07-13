import L from "leaflet";
import {
  gridToLatLon,
  latLonToGrid,
  type LatLon,
} from "./geo";
import {
  buildRbnMainUrl,
  buildSearchWithGrid,
  defaultSelectedSkimmers,
  gridFromUrlSearch,
  parseTargetCalls,
  rankSkimmers,
  type RankedSkimmer,
  type RbnNodeRecord,
} from "./rbn-skimmers";
import {
  decodeRbnNodeCache,
  encodeRbnNodeCache,
} from "./rbn-node-cache";

const RBN_NODES_URL = "https://www.reversebeacon.net/nodes/detail_json.php";
const STORAGE_GRID = "rbnSkimmers.grid";
const STORAGE_NODES = "rbnSkimmers.nodes.v1";
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
  let nodesFetchedAt: number | null = null;
  let nodesFromCache = false;

  const initialUrlGrid = gridFromUrlSearch(window.location.search);
  const initialGrid = initialUrlGrid ?? readStorage(STORAGE_GRID);
  const cachedNodes = decodeRbnNodeCache(readStorage(STORAGE_NODES));
  if (cachedNodes) {
    nodes = cachedNodes.nodes;
    nodesFetchedAt = cachedNodes.fetchedAt;
    nodesFromCache = true;
  }

  gridInput.value = initialGrid ?? "";
  targetsInput.value = readStorage(STORAGE_TARGETS) ?? "";
  setupMap();
  updateRbnLink();
  if (initialGrid) {
    applyGrid();
  } else if (cachedNodes) {
    setStatus(
      `Loaded ${nodes.length} cached RBN nodes from ${formatCacheAge(cachedNodes.ageMs)} ago. Enter a grid or use browser location.`,
    );
  }
  if (!cachedNodes?.isFresh) {
    void fetchNodes();
  }
  if (!initialUrlGrid) {
    void useGrantedBrowserLocation();
  }

  useLocationButton.addEventListener("click", () => requestBrowserLocation(true));

  async function useGrantedBrowserLocation(): Promise<void> {
    if (!navigator.geolocation || !navigator.permissions) return;

    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") {
        requestBrowserLocation(false);
      }
    } catch {
      // Some browsers expose Permissions but do not support geolocation queries.
    }
  }

  function requestBrowserLocation(reportErrors: boolean): void {
    if (!navigator.geolocation) {
      if (reportErrors) {
        setStatus("Browser location is unavailable. Enter a Maidenhead grid instead.");
      }
      return;
    }

    if (reportErrors) {
      setStatus("Requesting browser location...");
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        const grid = latLonToGrid(point);
        if (!grid) {
          setStatus("Browser location was invalid. Enter a Maidenhead grid instead.");
          return;
        }

        setOperatingLocation(
          point,
          grid,
          `Location set from this browser (${grid}). Ranking active skimmers...`,
        );
      },
      () => {
        if (reportErrors) {
          setStatus("Browser location was not available. Enter a Maidenhead grid instead.");
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 10000,
      },
    );
  }

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

    setOperatingLocation(
      point,
      grid,
      `Location set from grid ${grid}. Ranking active skimmers...`,
    );
  }

  function setOperatingLocation(point: LatLon, grid: string, message: string): void {
    origin = point;
    gridInput.value = grid;
    writeStorage(STORAGE_GRID, grid);
    writeGridToUrl(grid);
    setStatus(message);
    render();
  }

  async function fetchNodes(): Promise<void> {
    if (nodes.length === 0) {
      setStatus("Fetching active RBN skimmers...");
    }

    try {
      const response = await fetch(RBN_NODES_URL, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`RBN returned ${response.status}`);

      const json = await response.json();
      if (!Array.isArray(json)) throw new Error("RBN response was not a node list");

      nodes = json as RbnNodeRecord[];
      nodesFetchedAt = Date.now();
      nodesFromCache = false;
      writeStorage(STORAGE_NODES, encodeRbnNodeCache(nodes, nodesFetchedAt));
      if (origin) {
        render();
      } else {
        setStatus(`Loaded ${nodes.length} active RBN nodes. Enter a grid or use browser location.`);
      }
    } catch {
      if (nodes.length > 0 && nodesFetchedAt !== null) {
        const ageMs = Math.max(0, Date.now() - nodesFetchedAt);
        setStatus(
          `Using cached RBN data from ${formatCacheAge(ageMs)} ago; the live refresh failed.`,
        );
        return;
      }

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
    const cacheStatus =
      nodesFromCache && nodesFetchedAt !== null
        ? ` Cached ${formatCacheAge(Date.now() - nodesFetchedAt)} ago.`
        : "";
    setStatus(
      `Ranked ${ranked.length} nearest active skimmers from ${nodes.length} RBN nodes.${cacheStatus}`,
    );
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

function writeGridToUrl(grid: string | null): void {
  const nextSearch = buildSearchWithGrid(window.location.search, grid);
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
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

function formatCacheAge(ageMs: number): string {
  const minutes = Math.max(0, Math.floor(ageMs / (60 * 1000)));
  if (minutes < 1) return "less than a minute";
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
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

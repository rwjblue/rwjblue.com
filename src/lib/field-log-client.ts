import L from "leaflet";
import {
  matchesFieldLogFilters,
  type FieldLogEntry,
} from "./field-log";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );

export function initFieldLog() {
  const root = document.querySelector<HTMLElement>("[data-field-log]");
  const mapElement = document.querySelector<HTMLElement>("[data-field-log-map]");
  const dataElement = document.getElementById("field-log-data");
  const status = document.querySelector<HTMLElement>("[data-field-log-status]");
  const empty = document.querySelector<HTMLElement>("[data-field-log-empty]");
  const selects = [...document.querySelectorAll<HTMLSelectElement>("[data-field-filter]")];
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-field-entry]"),
  ];

  if (!root || !mapElement || !dataElement || !status || !empty) return;

  const entries = JSON.parse(dataElement.textContent ?? "[]") as FieldLogEntry[];
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const buttonsById = new Map(buttons.map((button) => [button.dataset.fieldEntry!, button]));
  const map = L.map(mapElement, { scrollWheelZoom: false });
  const markers = new Map<string, L.CircleMarker>();

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  for (const entry of entries) {
    const marker = L.circleMarker([entry.latitude, entry.longitude], {
      radius: 7,
      color: "#fffdfa",
      weight: 2,
      fillColor: "#2f6f4e",
      fillOpacity: 0.92,
    }).bindPopup(
      `<strong>${escapeHtml(entry.reference)}</strong><span>${escapeHtml(entry.park)}</span><time>${escapeHtml(entry.date)}</time>`,
    );
    marker.on("click", () => selectEntry(entry.id, false, true));
    markers.set(entry.id, marker);
  }

  const filters = () =>
    Object.fromEntries(
      selects
        .map((select) => [select.dataset.fieldFilter!, select.value])
        .filter(([, value]) => value),
    );

  const visibleEntries = () =>
    entries.filter((entry) => matchesFieldLogFilters(entry, filters()));

  const updateUrl = () => {
    const url = new URL(window.location.href);
    for (const select of selects) {
      const key = select.dataset.fieldFilter!;
      if (select.value) url.searchParams.set(key, select.value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState({}, "", url);
  };

  const applyFilters = () => {
    const visible = visibleEntries();
    const visibleIds = new Set(visible.map((entry) => entry.id));
    const bounds = L.latLngBounds([]);

    for (const entry of entries) {
      const button = buttonsById.get(entry.id);
      button?.closest("li")?.toggleAttribute("hidden", !visibleIds.has(entry.id));
      const marker = markers.get(entry.id);
      if (!marker) continue;
      if (visibleIds.has(entry.id)) {
        marker.addTo(map);
        bounds.extend([entry.latitude, entry.longitude]);
      } else {
        marker.removeFrom(map);
      }
    }

    empty.hidden = visible.length > 0;
    status.textContent = `${visible.length} ${visible.length === 1 ? "outing" : "outings"} shown.`;
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });

    const selected = buttons.find(
      (button) => button.getAttribute("aria-pressed") === "true",
    );
    if (selected && !visibleIds.has(selected.dataset.fieldEntry!)) {
      selected.setAttribute("aria-pressed", "false");
      selected.closest("li")?.classList.remove("is-selected");
    }
    updateUrl();
  };

  function selectEntry(id: string, moveMap = true, focusTimeline = false) {
    const entry = entriesById.get(id);
    const button = buttonsById.get(id);
    const marker = markers.get(id);
    if (!entry || !button || !marker) return;

    for (const candidate of buttons) {
      const selected = candidate === button;
      candidate.setAttribute("aria-pressed", String(selected));
      candidate.closest("li")?.classList.toggle("is-selected", selected);
    }
    if (moveMap) map.setView([entry.latitude, entry.longitude], Math.max(map.getZoom(), 10));
    marker.openPopup();
    if (focusTimeline) {
      button.focus({ preventScroll: true });
      button.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  for (const select of selects) {
    const initial = new URLSearchParams(window.location.search).get(
      select.dataset.fieldFilter!,
    );
    if (initial && [...select.options].some((option) => option.value === initial)) {
      select.value = initial;
    }
    select.addEventListener("change", applyFilters);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => selectEntry(button.dataset.fieldEntry!));
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const visible = buttons.filter((candidate) => !candidate.closest("li")?.hidden);
      const index = visible.indexOf(button);
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const next = visible[index + offset];
      if (next) {
        event.preventDefault();
        next.focus();
      }
    });
  });

  root.dataset.enhanced = "true";
  applyFilters();
  const first = visibleEntries()[0];
  if (first) selectEntry(first.id, false);
}

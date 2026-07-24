import L from "leaflet";
import { gridToLatLon, type LatLon } from "./geo.ts";
import {
  NCDXF_BEACONS,
  type BeaconObservation,
  type BeaconPower,
} from "./ncdxf-beacons.ts";

export type NcdxfBeaconMapMode = "network" | "now" | "scan" | "path";

export interface NcdxfBeaconMapState {
  mode: NcdxfBeaconMapMode;
  active?: Array<{
    beaconIndex: number;
    label: string;
  }>;
  currentBeaconIndex?: number | null;
  observations?: BeaconObservation[];
  origin?: LatLon | null;
  selectedBeaconIndex?: number | null;
}

export interface NcdxfBeaconMap {
  focusBeacon(beaconIndex: number): void;
  invalidateSize(): void;
  setState(state: NcdxfBeaconMapState): void;
}

const BEACON_POINTS = NCDXF_BEACONS.map((beacon) => {
  const point = gridToLatLon(beacon.grid);
  if (!point) {
    throw new Error(`Invalid NCDXF beacon grid: ${beacon.call} ${beacon.grid}`);
  }
  return point;
});

export function createNcdxfBeaconMap(
  element: HTMLElement,
  initialState: NcdxfBeaconMapState = { mode: "network" },
): NcdxfBeaconMap {
  const map = L.map(element, {
    scrollWheelZoom: false,
    worldCopyJump: true,
    minZoom: 0,
    zoomSnap: 0.25,
  });
  const pathLayer = L.layerGroup().addTo(map);
  const labelLayer = L.layerGroup().addTo(map);
  const originLayer = L.layerGroup().addTo(map);
  let state = initialState;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = NCDXF_BEACONS.map((beacon, beaconIndex) => {
    const point = BEACON_POINTS[beaconIndex];
    const card = beaconCardHtml(beaconIndex);
    return L.circleMarker([point.lat, point.lon])
      .addTo(map)
      .bindTooltip(card, {
        className: "beacon-map-card-shell",
        direction: "top",
        offset: [0, -7],
      })
      .bindPopup(card, {
        className: "beacon-map-popup-shell",
        maxWidth: 280,
        minWidth: 220,
      });
  });

  const mapWidth = Math.max(256, element.clientWidth - 32);
  const initialZoom = Math.max(
    0,
    Math.min(2.25, Math.floor(Math.log2(mapWidth / 256) * 4) / 4),
  );
  map.setView([0, 8], initialZoom);
  map.on("zoomend", render);
  render();

  return {
    focusBeacon(beaconIndex) {
      const marker = markers[beaconIndex];
      if (!marker) return;
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 4));
      marker.openPopup();
    },
    invalidateSize() {
      map.invalidateSize();
    },
    setState(nextState) {
      if (state.mode !== nextState.mode) map.closePopup();
      state = nextState;
      render();
    },
  };

  function render(): void {
    pathLayer.clearLayers();
    labelLayer.clearLayers();
    originLayer.clearLayers();

    const activeByBeacon = new Map(
      (state.active ?? []).map((active) => [active.beaconIndex, active]),
    );
    const latestByBeacon = new Map<number, BeaconObservation>();
    for (const observation of state.observations ?? []) {
      latestByBeacon.set(observation.beaconIndex, observation);
    }

    markers.forEach((marker, beaconIndex) => {
      const beacon = NCDXF_BEACONS[beaconIndex];
      const active = activeByBeacon.get(beaconIndex);
      const observation = latestByBeacon.get(beaconIndex);
      const isSelected = state.selectedBeaconIndex === beaconIndex;
      const isCurrent = state.currentBeaconIndex === beaconIndex;
      const baseRadius = map.getZoom() <= 2 ? 5 : 7;
      let fillColor = beacon.status === "off" ? "#8a4b2b" : "#7a858c";
      let radius = baseRadius;
      let weight = 1.5;
      let color = "#fffdfa";
      let fillOpacity = 0.76;

      if (state.mode === "network") {
        fillColor = beacon.status === "off" ? "#8a4b2b" : "#172026";
        fillOpacity = 1;
      }
      if (active) {
        fillColor = beacon.status === "off" ? "#8a4b2b" : "#2f6f4e";
        fillOpacity = 1;
        radius = baseRadius + 3;
        weight = 2;
      }
      if (observation) {
        fillColor = powerColor(observation.power);
        fillOpacity = 1;
        radius = baseRadius + 2;
        weight = 2;
      }
      if (isSelected) {
        fillColor = "#2f6f4e";
        fillOpacity = 1;
        radius = baseRadius + 3;
        weight = 2.5;
      }
      if (isCurrent) {
        color = "#172026";
        weight = 3;
      }

      marker.setRadius(radius);
      marker.setStyle({
        color,
        fillColor,
        fillOpacity,
        weight,
      });

      if (active) {
        addMapLabel(beaconIndex, active.label);
      }
    });

    if (state.origin) {
      const originLatLng: L.LatLngTuple = [
        state.origin.lat,
        state.origin.lon,
      ];
      L.circleMarker(originLatLng, {
        radius: 7,
        color: "#fffdfa",
        weight: 2,
        fillColor: "#172026",
        fillOpacity: 1,
      })
        .addTo(originLayer)
        .bindTooltip("<strong>Operating location</strong>", {
          className: "beacon-map-card-shell",
          direction: "top",
          offset: [0, -7],
        })
        .bindPopup("<strong>Operating location</strong>", {
          className: "beacon-map-popup-shell",
        });
    }

    if (state.mode === "scan" && state.origin) {
      for (const observation of latestByBeacon.values()) {
        if (observation.power === "none") continue;
        addPath(state.origin, observation.beaconIndex, observation.power);
      }
    }

    if (
      state.mode === "path" &&
      state.origin &&
      state.selectedBeaconIndex !== null &&
      state.selectedBeaconIndex !== undefined
    ) {
      addPath(state.origin, state.selectedBeaconIndex, "0.1", true);
    }
  }

  function addMapLabel(beaconIndex: number, label: string): void {
    const point = BEACON_POINTS[beaconIndex];
    const placeOnLeft = point.lon > 110;
    L.marker([point.lat, point.lon], {
      interactive: false,
      icon: L.divIcon({
        className: `beacon-map-label-marker${placeOnLeft ? " is-left" : ""}`,
        html: `<span>${escapeHtml(label)}</span>`,
        iconSize: [0, 0],
      }),
    }).addTo(labelLayer);
  }

  function addPath(
    origin: LatLon,
    beaconIndex: number,
    power: BeaconPower,
    selected = false,
  ): void {
    const destination = BEACON_POINTS[beaconIndex];
    const destinationLon = nearestLongitude(origin.lon, destination.lon);
    L.polyline(
      [
        [origin.lat, origin.lon],
        [destination.lat, destinationLon],
      ],
      {
        className: "beacon-observed-path",
        color: selected ? "#2f6f4e" : powerColor(power),
        dashArray: selected ? "8 7" : undefined,
        opacity: selected ? 0.68 : 0.58,
        weight: selected ? 3 : 4,
      },
    ).addTo(pathLayer);
  }
}

function beaconCardHtml(beaconIndex: number): string {
  const beacon = NCDXF_BEACONS[beaconIndex];
  const point = BEACON_POINTS[beaconIndex];
  return `<span class="beacon-map-card">
    <strong>${escapeHtml(beacon.call)}</strong>
    <span>${escapeHtml(beacon.entity)} · ${escapeHtml(beacon.location)}</span>
    <span>${escapeHtml(beacon.grid)} · ${formatCoordinates(point)}</span>
    <span>Slot ${beaconIndex + 1}${beacon.status === "off" ? " · reported off" : ""}</span>
  </span>`;
}

function formatCoordinates(point: LatLon): string {
  const latitude = `${Math.abs(point.lat).toFixed(2)}° ${point.lat >= 0 ? "N" : "S"}`;
  const longitude = `${Math.abs(point.lon).toFixed(2)}° ${point.lon >= 0 ? "E" : "W"}`;
  return `${latitude}, ${longitude}`;
}

function nearestLongitude(origin: number, destination: number): number {
  let longitude = destination;
  while (longitude - origin > 180) longitude -= 360;
  while (longitude - origin < -180) longitude += 360;
  return longitude;
}

function powerColor(power: BeaconPower): string {
  return {
    none: "#9f3b32",
    "100": "#c7652d",
    "10": "#b38b20",
    "1": "#1f7a78",
    "0.1": "#2f6f4e",
  }[power];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

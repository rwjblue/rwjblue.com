import {
  distanceOnEarth,
  gridToLocation,
  locationToGrid6,
  type EarthLocationInput,
} from "@ham2k/lib-geo-tools";

export interface LatLon {
  lat: number;
  lon: number;
}

export function gridToLatLon(grid: string): LatLon | null {
  if (!/^[A-Ra-r]{2}\d{2}([A-Xa-x]{2}(\d{2})?)?$/.test(grid.trim())) {
    return null;
  }

  try {
    const [lat, lon] = gridToLocation(grid.trim().toUpperCase());
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

export function latLonToGrid(location: LatLon): string | null {
  const grid = locationToGrid6(toHam2kLocation(location));
  return grid?.toUpperCase() ?? null;
}

export function distanceKilometers(origin: LatLon, destination: LatLon): number {
  return distanceBetween(origin, destination, "km");
}

export function distanceMiles(origin: LatLon, destination: LatLon): number {
  return distanceBetween(origin, destination, "miles");
}

function distanceBetween(
  origin: LatLon,
  destination: LatLon,
  units: "km" | "miles",
): number {
  const distance = distanceOnEarth(
    toHam2kLocation(origin),
    toHam2kLocation(destination),
    { units },
  );

  if (distance === null) {
    throw new Error("Unable to calculate distance for the provided locations.");
  }

  return distance;
}

function toHam2kLocation(location: LatLon): EarthLocationInput {
  return {
    latitude: location.lat,
    longitude: location.lon,
  };
}

export interface FieldLogNote {
  id: string;
  title: string;
  href: string;
}

export interface FieldLogSeries {
  slug: string;
  title: string;
}

export interface FieldLogEntry {
  id: string;
  date: string;
  year: string;
  reference: string;
  park: string;
  parkHref: string;
  latitude: number;
  longitude: number;
  callsign: string;
  qsos: number;
  modes: string[];
  notes: FieldLogNote[];
  series?: FieldLogSeries;
  trip: string;
}

interface SourcePark {
  reference: string;
  name: string;
  href: string;
  latitude: number;
  longitude: number;
  activations: Array<{
    date: string;
    callsign: string;
    qsos: { total: number; cw: number; data: number; phone: number };
    notes: FieldLogNote[];
    projects: Array<{ id: string; label: string }>;
  }>;
}

interface PublicNoteRelationship {
  id: string;
  series?: FieldLogSeries;
}

export function buildFieldLog(
  parks: SourcePark[],
  publicNotes: PublicNoteRelationship[],
): FieldLogEntry[] {
  const notes = new Map(publicNotes.map((note) => [note.id, note]));
  const entries: FieldLogEntry[] = [];

  for (const park of parks) {
    park.activations.forEach((activation, activationIndex) => {
      const publicActivationNotes = activation.notes.filter((note) =>
        notes.has(note.id),
      );
      const series = publicActivationNotes
        .map((note) => notes.get(note.id)?.series)
        .find((value): value is FieldLogSeries => Boolean(value));
      const project = activation.projects[0];
      const modes = [
        activation.qsos.cw > 0 ? "cw" : null,
        activation.qsos.data > 0 ? "data" : null,
        activation.qsos.phone > 0 ? "phone" : null,
      ].filter((mode): mode is string => Boolean(mode));

      entries.push({
        id: `${activation.date}-${park.reference}-${activationIndex}`,
        date: activation.date,
        year: activation.date.slice(0, 4),
        reference: park.reference,
        park: park.name,
        parkHref: park.href,
        latitude: park.latitude,
        longitude: park.longitude,
        callsign: activation.callsign,
        qsos: activation.qsos.total,
        modes,
        notes: publicActivationNotes,
        series,
        trip: series?.slug ?? project?.id ?? "other",
      });
    });
  }

  return entries.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.reference.localeCompare(b.reference) ||
      a.id.localeCompare(b.id),
  );
}

export interface FieldLogFilters {
  year?: string;
  mode?: string;
  trip?: string;
}

export function matchesFieldLogFilters(
  entry: FieldLogEntry,
  filters: FieldLogFilters,
): boolean {
  return (
    (!filters.year || entry.year === filters.year) &&
    (!filters.mode || entry.modes.includes(filters.mode)) &&
    (!filters.trip || entry.trip === filters.trip)
  );
}

export interface PotaPark {
  reference: string;
  name: string;
  latitude: number;
  longitude: number;
  grid: string;
  locationDesc: string;
  attempts?: number;
  activations?: number;
  qsos?: number;
}

export interface PotaProfileActivation {
  date: string;
  reference: string;
  park: string;
  location: string;
  cw: number;
  data: number;
  phone: number;
  total: number;
}

export interface PotaProfile {
  callsign: string;
  other_callsigns?: string[];
  recent_activity?: {
    activations?: PotaProfileActivation[];
  };
}

export interface ActivationLedgerEntry {
  reference: string;
  park: string;
  date: string;
  callsign: string;
  qsos: {
    total: number;
    cw: number;
    data: number;
    phone: number;
  };
  source: "backfill" | "profile";
}

export interface ActivationLedger {
  activations: ActivationLedgerEntry[];
}

export interface TrackerNote {
  id: string;
  title: string;
  tags: string[];
}

export interface TrackerData {
  generatedAt: string;
  callsigns: string[];
  summary: {
    completed: number;
    remaining: number;
    total: number;
    percentComplete: number;
  };
  references: TrackerReference[];
}

export interface TrackerReference {
  reference: string;
  name: string;
  latitude: number;
  longitude: number;
  grid: string;
  locationDesc: string;
  status: "completed" | "remaining";
  potaUrl: string;
  firstActivation: ActivationLedgerEntry | null;
  latestActivation: ActivationLedgerEntry | null;
  activationCount: number;
  notes: Array<{
    id: string;
    title: string;
    href: string;
  }>;
  publicStats: {
    attempts: number | null;
    activations: number | null;
    qsos: number | null;
  };
}

const normalizeReference = (reference: string) => reference.trim().toUpperCase();

const callsignsForProfile = (profile: PotaProfile): string[] => [
  profile.callsign.toUpperCase(),
  ...(profile.other_callsigns ?? []).map((callsign) => callsign.toUpperCase()),
];

const activationKey = (activation: ActivationLedgerEntry): string =>
  [
    normalizeReference(activation.reference),
    activation.date,
    activation.callsign.toUpperCase(),
  ].join(":");

const compareDate = (left: ActivationLedgerEntry, right: ActivationLedgerEntry) =>
  left.date.localeCompare(right.date);

export function mergeProfileActivations(
  ledger: ActivationLedger,
  profile: PotaProfile,
): ActivationLedger {
  const activations = [...ledger.activations];
  const seen = new Set(activations.map(activationKey));

  for (const activation of profile.recent_activity?.activations ?? []) {
    const ledgerEntry: ActivationLedgerEntry = {
      reference: normalizeReference(activation.reference),
      park: activation.park,
      date: activation.date,
      callsign: profile.callsign.toUpperCase(),
      qsos: {
        total: activation.total,
        cw: activation.cw,
        data: activation.data,
        phone: activation.phone,
      },
      source: "profile",
    };

    if (!seen.has(activationKey(ledgerEntry))) {
      activations.push(ledgerEntry);
      seen.add(activationKey(ledgerEntry));
    }
  }

  return { activations };
}

export function buildTrackerData({
  parks,
  ledger,
  profile,
  notes,
  generatedAt,
}: {
  parks: PotaPark[];
  ledger: ActivationLedger;
  profile: PotaProfile;
  notes: TrackerNote[];
  generatedAt: string;
}): TrackerData {
  const callsigns = callsignsForProfile(profile);
  const callsignSet = new Set(callsigns);
  const mergedLedger = mergeProfileActivations(ledger, profile);
  const notesByReference = new Map<
    string,
    Array<{ id: string; title: string; href: string }>
  >();

  for (const note of notes) {
    for (const tag of note.tags) {
      const normalizedTag = tag.toLowerCase();
      if (/^us-\d+$/.test(normalizedTag)) {
        const reference = normalizedTag.toUpperCase();
        const referenceNotes = notesByReference.get(reference) ?? [];
        referenceNotes.push({
          id: note.id,
          title: note.title,
          href: `/notes/${note.id}/`,
        });
        notesByReference.set(reference, referenceNotes);
      }
    }
  }

  const activationsByReference = new Map<string, ActivationLedgerEntry[]>();

  for (const activation of mergedLedger.activations) {
    const callsign = activation.callsign.toUpperCase();

    if (!callsignSet.has(callsign)) {
      continue;
    }

    const reference = normalizeReference(activation.reference);
    const referenceActivations = activationsByReference.get(reference) ?? [];
    referenceActivations.push({
      ...activation,
      reference,
      callsign,
    });
    activationsByReference.set(reference, referenceActivations);
  }

  const references = parks.map((park): TrackerReference => {
    const reference = normalizeReference(park.reference);
    const activations = (activationsByReference.get(reference) ?? []).sort(
      compareDate,
    );
    const firstActivation = activations[0] ?? null;
    const latestActivation = activations.at(-1) ?? null;

    return {
      reference,
      name: park.name,
      latitude: park.latitude,
      longitude: park.longitude,
      grid: park.grid,
      locationDesc: park.locationDesc,
      status: firstActivation ? "completed" : "remaining",
      potaUrl: `https://pota.app/#/park/${reference}`,
      firstActivation,
      latestActivation,
      activationCount: activations.length,
      notes: notesByReference.get(reference) ?? [],
      publicStats: {
        attempts: park.attempts ?? null,
        activations: park.activations ?? null,
        qsos: park.qsos ?? null,
      },
    };
  });

  references.sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "remaining" ? -1 : 1;
    }

    if (left.latestActivation && right.latestActivation) {
      const dateComparison = right.latestActivation.date.localeCompare(
        left.latestActivation.date,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }
    }

    return left.reference.localeCompare(right.reference);
  });

  const completed = references.filter(
    (reference) => reference.status === "completed",
  ).length;
  const total = references.length;

  return {
    generatedAt,
    callsigns,
    summary: {
      completed,
      remaining: total - completed,
      total,
      percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
    },
    references,
  };
}

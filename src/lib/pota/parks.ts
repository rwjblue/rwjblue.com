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

export interface PotaActivation {
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
  source: "adi" | "backfill" | "profile";
}

export interface PotaNote {
  id: string;
  title: string;
  date: string;
  tags: string[];
}

export interface PotaProjectRule {
  id: string;
  label: string;
  href: string;
  references: string[];
  startDate: string;
  endDate: string;
  minimumQsos: number;
}

export interface PotaParkPageNote {
  id: string;
  title: string;
  date: string;
  href: string;
}

export interface PotaParkPageProject {
  id: string;
  label: string;
  href: string;
}

export interface PotaParkPageActivation extends PotaActivation {
  notes: PotaParkPageNote[];
  projects: PotaParkPageProject[];
}

export interface PotaParkPage {
  reference: string;
  name: string;
  latitude: number;
  longitude: number;
  grid: string;
  locationDesc: string;
  href: string;
  potaUrl: string;
  activationCount: number;
  qsoTotal: number;
  activations: PotaParkPageActivation[];
  notes: PotaParkPageNote[];
  publicStats: {
    attempts: number | null;
    activations: number | null;
    qsos: number | null;
  };
}

export interface PotaParkPagesData {
  generatedAt: string;
  parks: PotaParkPage[];
}

const referenceTagPattern = /^us-\d+$/;

export const normalizeReference = (reference: string): string =>
  reference.trim().toUpperCase();

export const potaParkHref = (reference: string): string =>
  `/radio/pota/${normalizeReference(reference)}/`;

const potaParkUrl = (reference: string): string =>
  `https://pota.app/#/park/${normalizeReference(reference)}`;

const noteHref = (note: PotaNote): string => `/notes/${note.id}/`;

const noteReferences = (note: PotaNote): string[] =>
  note.tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => referenceTagPattern.test(tag))
    .map((tag) => tag.toUpperCase());

export function collectKnownReferences({
  notes,
  activations,
  projectReferences,
}: {
  notes: PotaNote[];
  activations: PotaActivation[];
  projectReferences: string[];
}): string[] {
  const references = new Set<string>();

  for (const note of notes) {
    for (const reference of noteReferences(note)) {
      references.add(reference);
    }
  }

  for (const activation of activations) {
    references.add(normalizeReference(activation.reference));
  }

  for (const reference of projectReferences) {
    references.add(normalizeReference(reference));
  }

  return [...references].sort((left, right) => left.localeCompare(right));
}

const projectAppliesToActivation = (
  project: PotaProjectRule,
  activation: PotaActivation,
): boolean => {
  const references = new Set(project.references.map(normalizeReference));

  return (
    references.has(normalizeReference(activation.reference)) &&
    activation.date >= project.startDate &&
    activation.date <= project.endDate &&
    activation.qsos.total >= project.minimumQsos
  );
};

export function buildPotaParkPages({
  parks,
  activations,
  notes,
  projectRules,
  generatedAt,
}: {
  parks: PotaPark[];
  activations: PotaActivation[];
  notes: PotaNote[];
  projectRules: PotaProjectRule[];
  generatedAt: string;
}): PotaParkPagesData {
  const notesByReference = new Map<string, PotaParkPageNote[]>();
  const notesByReferenceAndDate = new Map<string, PotaParkPageNote[]>();

  for (const note of notes) {
    const pageNote = {
      id: note.id,
      title: note.title,
      date: note.date,
      href: noteHref(note),
    };

    for (const reference of noteReferences(note)) {
      const referenceNotes = notesByReference.get(reference) ?? [];
      referenceNotes.push(pageNote);
      notesByReference.set(reference, referenceNotes);

      const datedKey = `${reference}:${note.date}`;
      const datedNotes = notesByReferenceAndDate.get(datedKey) ?? [];
      datedNotes.push(pageNote);
      notesByReferenceAndDate.set(datedKey, datedNotes);
    }
  }

  const activationsByReference = new Map<string, PotaActivation[]>();

  for (const activation of activations) {
    const reference = normalizeReference(activation.reference);
    const referenceActivations = activationsByReference.get(reference) ?? [];
    referenceActivations.push({
      ...activation,
      reference,
      callsign: activation.callsign.toUpperCase(),
    });
    activationsByReference.set(reference, referenceActivations);
  }

  return {
    generatedAt,
    parks: parks
      .map((park): PotaParkPage => {
        const reference = normalizeReference(park.reference);
        const pageActivations = (activationsByReference.get(reference) ?? [])
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((activation): PotaParkPageActivation => ({
            ...activation,
            notes:
              notesByReferenceAndDate.get(`${reference}:${activation.date}`) ??
              [],
            projects: projectRules
              .filter((project) => projectAppliesToActivation(project, activation))
              .map((project) => ({
                id: project.id,
                label: project.label,
                href: project.href,
              })),
          }));

        return {
          reference,
          name: park.name,
          latitude: park.latitude,
          longitude: park.longitude,
          grid: park.grid,
          locationDesc: park.locationDesc,
          href: potaParkHref(reference),
          potaUrl: potaParkUrl(reference),
          activationCount: pageActivations.length,
          qsoTotal: pageActivations.reduce(
            (total, activation) => total + activation.qsos.total,
            0,
          ),
          activations: pageActivations,
          notes: notesByReference.get(reference) ?? [],
          publicStats: {
            attempts: park.attempts ?? null,
            activations: park.activations ?? null,
            qsos: park.qsos ?? null,
          },
        };
      })
      .sort((left, right) => left.reference.localeCompare(right.reference)),
  };
}

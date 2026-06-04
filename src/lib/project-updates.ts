export const RI_POTA_PROJECT_ID = "2026-activate-all-ri-pota";

type ProjectWithUpdated = {
  id: string;
  data: {
    updated: Date;
  };
};

type TrackerActivation = {
  date?: string;
};

type TrackerReference = {
  firstActivation?: TrackerActivation | null;
  latestActivation?: TrackerActivation | null;
};

type TrackerData = {
  references?: TrackerReference[];
};

export function latestTrackerActivationDate(trackerData: TrackerData) {
  const dates = (trackerData.references ?? [])
    .flatMap((reference) => [
      reference.firstActivation?.date,
      reference.latestActivation?.date,
    ])
    .map((date) => dateFromIsoDate(date))
    .filter((date): date is Date => date !== null);

  if (dates.length === 0) {
    return null;
  }

  return new Date(Math.max(...dates.map((date) => date.valueOf())));
}

export function effectiveProjectUpdatedDate(
  project: ProjectWithUpdated,
  { riPotaTrackerData }: { riPotaTrackerData: TrackerData },
) {
  if (project.id !== RI_POTA_PROJECT_ID) {
    return project.data.updated;
  }

  const latestActivationDate = latestTrackerActivationDate(riPotaTrackerData);

  if (!latestActivationDate) {
    return project.data.updated;
  }

  return new Date(
    Math.max(project.data.updated.valueOf(), latestActivationDate.valueOf()),
  );
}

function dateFromIsoDate(date: string | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  return new Date(`${date}T00:00:00.000Z`);
}

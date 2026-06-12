export const RI_POTA_PROJECT_ID = "2026-activate-all-ri-pota";
export const ROVE_TO_FL_PROJECT_ID = "2026-06-rove-to-fl";

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
  generatedAt?: string;
  references?: TrackerReference[];
};

type GeneratedProjectData = {
  generatedAt?: string;
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
  {
    riPotaTrackerData,
    roveToFlData,
  }: {
    riPotaTrackerData: TrackerData;
    roveToFlData?: GeneratedProjectData;
  },
) {
  if (project.id === RI_POTA_PROJECT_ID) {
    return latestDate([
      project.data.updated,
      dateFromIsoDate(riPotaTrackerData.generatedAt),
      latestTrackerActivationDate(riPotaTrackerData),
    ]);
  }

  if (project.id === ROVE_TO_FL_PROJECT_ID) {
    return latestDate([
      project.data.updated,
      dateFromIsoDate(roveToFlData?.generatedAt),
    ]);
  }

  return project.data.updated;
}

function dateFromIsoDate(date: string | undefined) {
  const match = date?.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);

  if (!match) {
    return null;
  }

  return new Date(`${match[1]}T00:00:00.000Z`);
}

function latestDate(dates: Array<Date | null>) {
  const validDates = dates.filter((date): date is Date => date !== null);

  return new Date(Math.max(...validDates.map((date) => date.valueOf())));
}

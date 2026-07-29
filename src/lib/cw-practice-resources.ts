export const NNN_TIME_ZONE = "America/Chicago";
export const NNN_WEEKDAYS = [1, 4] as const;
export const NNN_HOUR = 19;

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);

  function numberPart(type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find((part) => part.type === type)?.value ?? 0);
  }

  return {
    year: numberPart("year"),
    month: numberPart("month"),
    day: numberPart("day"),
    hour: numberPart("hour"),
    minute: numberPart("minute"),
  };
}

function zonedWallTimeToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const targetWallTime = Date.UTC(year, month - 1, day, hour);
  let candidate = targetWallTime;

  for (let pass = 0; pass < 3; pass += 1) {
    const actual = zonedDateParts(new Date(candidate), timeZone);
    const actualWallTime = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );

    candidate += targetWallTime - actualWallTime;
  }

  return new Date(candidate);
}

/**
 * Return the next Monday or Thursday 7 PM occurrence in the net's Central
 * time zone. The conversion happens from a wall-clock recurrence so CDT/CST
 * changes are handled by the runtime's time-zone data.
 */
export function nextNnnStart(now = new Date()): Date {
  const local = zonedDateParts(now, NNN_TIME_ZONE);

  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const date = new Date(
      Date.UTC(local.year, local.month - 1, local.day + dayOffset),
    );

    if (!NNN_WEEKDAYS.includes(date.getUTCDay() as 1 | 4)) {
      continue;
    }

    const candidate = zonedWallTimeToDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      NNN_HOUR,
      NNN_TIME_ZONE,
    );

    if (candidate.getTime() >= now.getTime()) {
      return candidate;
    }
  }

  throw new Error("Unable to calculate the next NNN session");
}

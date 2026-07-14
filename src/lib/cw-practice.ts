export type CwActivityId = "sst" | "mst" | "cwt";

export interface CwSessionRule {
  weekdayUtc: number;
  hourUtc: number;
}

export interface CwActivity {
  id: CwActivityId;
  abbreviation: string;
  name: string;
  sponsor: string;
  speed: string;
  exchange: string;
  rulesUrl: string;
  frequencies: string;
  sessions: readonly CwSessionRule[];
}

export interface CwSession {
  activity: CwActivity;
  start: Date;
  end: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

export const CW_CALENDAR_PATH = "/radio/cw-practice/calendar.ics";
export const CW_CALENDAR_VERSION = "2026-07-13";
// Increment whenever a deployed calendar change should replace subscribed events.
export const CW_CALENDAR_SEQUENCE = 4;

export const cwActivities: readonly CwActivity[] = [
  {
    id: "sst",
    abbreviation: "SST",
    name: "Slow Speed Test",
    sponsor: "K1USN Radio Club",
    speed: "Up to 20 WPM",
    exchange: "First name + state, province, or DX",
    rulesUrl: "https://www.k1usn.com/sst_rules.html",
    frequencies:
      "1.812-1.828, 3.528-3.545, 7.028-7.045, 14.028-14.045, 21.028-21.045, and 28.028-28.045 MHz",
    sessions: [
      { weekdayUtc: 1, hourUtc: 0 },
      { weekdayUtc: 5, hourUtc: 20 },
    ],
  },
  {
    id: "mst",
    abbreviation: "MST",
    name: "Medium Speed Test",
    sponsor: "International CW Council",
    speed: "20-25 WPM; slow down when asked",
    exchange: "First name + sequential QSO number",
    rulesUrl: "https://internationalcwcouncil.org/mst-contest/",
    frequencies:
      "1.812-1.828, 3.528-3.550, 7.028-7.050 in the Americas, 14.028-14.050, 21.028-21.050, and 28.028-28.050 MHz",
    sessions: [
      { weekdayUtc: 1, hourUtc: 13 },
      { weekdayUtc: 1, hourUtc: 19 },
      { weekdayUtc: 2, hourUtc: 3 },
    ],
  },
  {
    id: "cwt",
    abbreviation: "CWT",
    name: "CWops Test",
    sponsor: "CWops",
    speed: "Usually 25+ WPM; slow down for slower callers",
    exchange: "First name + CWops number, state/province/DX country prefix, or CWA",
    rulesUrl: "https://cwops.org/cwops-tests/",
    frequencies:
      "Generally 28-45 kHz above the lower band edge on 10, 15, 20, 40, 80, and 160 meters",
    sessions: [
      { weekdayUtc: 3, hourUtc: 13 },
      { weekdayUtc: 3, hourUtc: 19 },
      { weekdayUtc: 4, hourUtc: 3 },
      { weekdayUtc: 4, hourUtc: 7 },
    ],
  },
];

export function activityById(id: CwActivityId): CwActivity {
  const activity = cwActivities.find((candidate) => candidate.id === id);

  if (!activity) {
    throw new Error(`Unknown CW activity: ${id}`);
  }

  return activity;
}

function nextOccurrence(now: Date, rule: CwSessionRule): Date {
  const start = new Date(now);
  const daysAhead = (rule.weekdayUtc - now.getUTCDay() + 7) % 7;

  start.setUTCDate(now.getUTCDate() + daysAhead);
  start.setUTCHours(rule.hourUtc, 0, 0, 0);

  if (start.getTime() + HOUR_MS <= now.getTime()) {
    start.setTime(start.getTime() + WEEK_MS);
  }

  return start;
}

export function upcomingCwSessions(now = new Date(), limit = 12): CwSession[] {
  const sessions = cwActivities.flatMap((activity) =>
    activity.sessions.flatMap((rule) => {
      const firstStart = nextOccurrence(now, rule);

      return [0, 1].map((weekOffset) => {
        const start = new Date(firstStart.getTime() + weekOffset * WEEK_MS);

        return {
          activity,
          start,
          end: new Date(start.getTime() + HOUR_MS),
        };
      });
    }),
  );

  return sessions
    .sort((left, right) => left.start.getTime() - right.start.getTime())
    .slice(0, limit);
}

export function isSessionOnAir(session: CwSession, now = new Date()): boolean {
  return session.start.getTime() <= now.getTime() && now.getTime() < session.end.getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatIcsDate(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function foldIcsLine(line: string): string[] {
  if (line.length <= 75) {
    return [line];
  }

  const folded = [line.slice(0, 75)];
  let rest = line.slice(75);

  while (rest.length > 0) {
    folded.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }

  return folded;
}

export function buildCwCalendar(siteOrigin = "https://rwjblue.com"): string {
  const calendarUpdated = new Date(`${CW_CALENDAR_VERSION}T00:00:00.000Z`);
  const anchorMonday = new Date("2026-07-13T00:00:00.000Z");
  const scheduleUrl = new URL("/radio/cw-practice/", siteOrigin).toString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//rwjblue.com//CW Practice Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CW Practice Schedule",
    "X-WR-CALDESC:Weekly SST, MST, and CWT on-air CW practice sessions",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const activity of cwActivities) {
    for (const rule of activity.sessions) {
      const start = new Date(anchorMonday);
      const daysFromMonday = (rule.weekdayUtc - 1 + 7) % 7;

      start.setUTCDate(anchorMonday.getUTCDate() + daysFromMonday);
      start.setUTCHours(rule.hourUtc, 0, 0, 0);

      const end = new Date(start.getTime() + HOUR_MS);
      const hourId = pad(rule.hourUtc);
      const description = [
        activity.speed,
        `Exchange: ${activity.exchange}`,
        `Schedule and exchange walkthrough: ${scheduleUrl}`,
        `Official rules: ${activity.rulesUrl}`,
      ].join("\n");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${activity.id}-${rule.weekdayUtc}-${hourId}00@rwjblue.com`,
        `DTSTAMP:${formatIcsDate(calendarUpdated)}`,
        `LAST-MODIFIED:${formatIcsDate(calendarUpdated)}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        "RRULE:FREQ=WEEKLY",
        `SUMMARY:${escapeIcsText(`${activity.abbreviation} - ${activity.name}`)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        `URL:${scheduleUrl}`,
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        `SEQUENCE:${CW_CALENDAR_SEQUENCE}`,
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");

  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}

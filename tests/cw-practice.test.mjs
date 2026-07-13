import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCwCalendar,
  CW_CALENDAR_PATH,
  cwActivities,
  isSessionOnAir,
  upcomingCwSessions,
} from "../src/lib/cw-practice.ts";
import worker, { calendarResponse } from "../worker/index.ts";

test("CW activity data defines all nine weekly sessions", () => {
  assert.deepEqual(
    cwActivities.map((activity) => [
      activity.id,
      activity.sessions.map((session) => [session.weekdayUtc, session.hourUtc]),
    ]),
    [
      ["sst", [[1, 0], [5, 20]]],
      ["mst", [[1, 13], [1, 19], [2, 3]]],
      ["cwt", [[3, 13], [3, 19], [4, 3], [4, 7]]],
    ],
  );
});

test("upcoming sessions include the currently on-air session", () => {
  const now = new Date("2026-07-13T19:30:00.000Z");
  const sessions = upcomingCwSessions(now, 3);

  assert.equal(sessions[0].activity.id, "mst");
  assert.equal(sessions[0].start.toISOString(), "2026-07-13T19:00:00.000Z");
  assert.equal(isSessionOnAir(sessions[0], now), true);
  assert.equal(sessions[1].start.toISOString(), "2026-07-14T03:00:00.000Z");
});

test("an ended session rolls forward to its next weekly occurrence", () => {
  const now = new Date("2026-07-13T20:00:00.000Z");
  const sessions = upcomingCwSessions(now, 2);

  assert.equal(sessions[0].start.toISOString(), "2026-07-14T03:00:00.000Z");
  assert.equal(sessions[1].start.toISOString(), "2026-07-15T13:00:00.000Z");
});

test("calendar feed contains stable weekly UTC events", () => {
  const calendar = buildCwCalendar();
  const physicalLines = calendar.split("\r\n").filter(Boolean);
  const uids = physicalLines.filter((line) => line.startsWith("UID:"));

  assert.match(calendar, /^BEGIN:VCALENDAR\r\n/);
  assert.match(calendar, /X-WR-CALNAME:CW Practice Schedule\r\n/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 9);
  assert.equal((calendar.match(/RRULE:FREQ=WEEKLY/g) ?? []).length, 9);
  assert.equal(new Set(uids).size, 9);
  assert.match(calendar, /DTSTART:20260713T190000Z/);
  assert.match(calendar, /DTSTART:20260716T070000Z/);
  assert.match(calendar, /SEQUENCE:2/);
  assert.match(calendar, /or CWA/);
  assert.ok(physicalLines.every((line) => line.length <= 75));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
});

test("calendar endpoint returns a cacheable iCalendar response", async () => {
  const request = new Request(`https://rwjblue.com${CW_CALENDAR_PATH}`);
  const response = calendarResponse(request);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/calendar; charset=utf-8");
  assert.match(response.headers.get("Content-Disposition"), /cw-practice-schedule\.ics/);
  assert.match(response.headers.get("Cache-Control"), /s-maxage=3600/);
  assert.match(await response.text(), /BEGIN:VCALENDAR/);
});

test("calendar endpoint supports HEAD, conditional requests, and method rejection", async () => {
  const url = `https://rwjblue.com${CW_CALENDAR_PATH}`;
  const initial = calendarResponse(new Request(url));
  const etag = initial.headers.get("ETag");
  const head = calendarResponse(new Request(url, { method: "HEAD" }));
  const conditional = calendarResponse(new Request(url, {
    headers: { "If-None-Match": etag },
  }));
  const rejected = calendarResponse(new Request(url, { method: "POST" }));

  assert.equal(await head.text(), "");
  assert.equal(conditional.status, 304);
  assert.equal(rejected.status, 405);
  assert.equal(rejected.headers.get("Allow"), "GET, HEAD");
});

test("Worker forwards non-calendar requests to static assets", async () => {
  const request = new Request("https://rwjblue.com/radio/");
  const response = await worker.fetch(request, {
    ASSETS: {
      fetch(forwarded) {
        assert.equal(forwarded, request);
        return Promise.resolve(new Response("asset"));
      },
    },
  });

  assert.equal(await response.text(), "asset");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { audioAutoReplay, createDailyListeningBlock, dailyListeningSeconds, DAILY_LISTENING_ID, shouldReplayAudio } from "../src/lib/cw-training/daily-listening.ts";
import { taskProgress } from "../src/lib/cw-training/plan.ts";
import { renderPracticeHistory } from "../src/lib/cw-training/history.ts";

const resource = { id: DAILY_LISTENING_ID, title: "Bob's 77 Words", url: "https://example.org/audio", format: "audio", durationSeconds: 116 };
const start = () => createDailyListeningBlock(resource, "2026-09-21T20:00:00.000Z", "session");

test("repeat choices have independent defaults and survive serialized device storage", () => {
  const daily = start().task;
  const ordinary = { id: "course-audio" };
  assert.equal(audioAutoReplay({}, daily), true);
  assert.equal(audioAutoReplay({}, ordinary), false);
  const state = JSON.parse(JSON.stringify({ dailyListeningAutoReplay: false, audioAutoReplay: true }));
  assert.equal(audioAutoReplay(state, daily), false);
  assert.equal(audioAutoReplay(state, ordinary), true);
});

test("daily listening loops past ten minutes and partial loops without changing assignment replay", () => {
  const daily = { ...start(), activeSeconds: 720, completedPasses: 6 };
  assert.equal(shouldReplayAudio(daily, true, true), true);
  assert.equal(shouldReplayAudio(daily, false, true), true);
  assert.equal(shouldReplayAudio(daily, true, false), false);
  const course = { ...daily, task: { id: "course-audio" }, targetPasses: 7 };
  assert.equal(shouldReplayAudio(course, true, true), true);
  assert.equal(shouldReplayAudio(course, false, true), false);
  assert.equal(shouldReplayAudio({ ...course, completedPasses: 7 }, true, true), false);
});

test("new sessions start at zero while daily progress excludes recall, other days and duplicates", () => {
  const active = { ...start(), activeSeconds: 240, recallSeconds: 60, position: 43 };
  const saved = { ...active, taskId: DAILY_LISTENING_ID, completed: false, endedAt: "2026-09-21T20:04:00.000Z" };
  assert.equal(dailyListeningSeconds([saved, saved], active, "2026-09-21", "America/New_York"), 180);
  assert.equal(dailyListeningSeconds([saved], { ...active, id: "next" }, "2026-09-21", "America/New_York"), 360);
  assert.equal(dailyListeningSeconds([saved], active, "2026-09-22", "America/New_York"), 0);
  assert.equal(start().position, 0);
  assert.equal(start().activeSeconds, 0);
  assert.equal(taskProgress(active.task, [saved]).complete, false);
  const html = renderPracticeHistory([saved], { course: { assignments: [], timezone: "America/New_York" }, materials: [], pendingIds: new Set() });
  assert.match(html, /Bob&#39;s 77 Words/);
  assert.match(html, /Extra review/);
});

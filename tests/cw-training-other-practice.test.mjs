import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OTHER_PRACTICE_ID,
  OTHER_PRACTICE_ACTIVITIES,
  OTHER_PRACTICE_ASSIGNMENT_ID,
  otherPracticeActivity,
} from "../src/lib/cw-training/other-practice.ts";
import { getTrainingPlan, taskProgress } from "../src/lib/cw-training/plan.ts";

const now = new Date("2026-09-08T20:00:00.000Z");
const makeTask = (id, kind, extra = {}) => ({
  id, kind, title: id, instructions: "Synthetic practice instruction.",
  sourceUrl: "https://example.invalid/course", ...extra,
});
function fixtureCourse() {
  return {
    id: "fixture", title: "Synthetic course", version: "1",
    sourceUrl: "https://example.invalid/course", verifiedAt: "2026-09-05T00:00:00.000Z",
    timezone: "America/New_York", dailyGoalMinutes: 60, instructions: "Synthetic instructions.",
    meetings: [{ session: 1, startsAt: "2026-09-10T19:30:00.000Z", endsAt: "2026-09-10T20:30:00.000Z" }],
    assignments: [{
      id: "s1d1", session: 1, day: 1, date: "2026-09-08", dueAt: "2026-09-10T19:30:00.000Z",
      instructions: "Synthetic instructions.", sourceUrl: "https://example.invalid/course",
      tasks: [
        makeTask("sending", "sending"),
        makeTask("words", "audio", { minimumPasses: 2, resourceId: "recording" }),
        makeTask("characters", "icr"),
        makeTask("runner", "simulator", { minutes: 15, speedWpm: 10, title: "Morse Runner", instructions: "Single calls at 10 WPM." }),
      ],
    }],
    resources: [{ id: "recording", title: "Synthetic recording", url: "https://example.invalid/words.mp3", format: "audio", durationSeconds: 180 }],
  };
}

function otherAttempt(id, taskId = DEFAULT_OTHER_PRACTICE_ID, extra = {}) {
  return {
    id, assignmentId: OTHER_PRACTICE_ASSIGNMENT_ID, taskId,
    startedAt: "2026-09-08T12:00:00.000Z", endedAt: "2026-09-08T12:10:00.000Z",
    activeSeconds: 600, completed: false, review: true, context: "practice", ...extra,
  };
}

test("self-directed practice exposes stable, distinct categories with an explicit default", () => {
  assert.equal(OTHER_PRACTICE_ASSIGNMENT_ID, "other-practice");
  assert.deepEqual(OTHER_PRACTICE_ACTIVITIES.map((activity) => activity.id), [
    "other:word-recognition", "other:icr", "other:general",
  ]);
  assert.equal(DEFAULT_OTHER_PRACTICE_ID, "other:general");
  for (const activity of OTHER_PRACTICE_ACTIVITIES) {
    assert.equal(otherPracticeActivity(activity.id), activity);
    assert.ok(activity.title.trim());
    assert.ok(activity.notePlaceholder.trim());
  }
  for (const unknown of ["", "word-recognition", "icr", "other", "other:unknown", "other:ICR", " other:icr", "other:icr ", "words"]) {
    assert.equal(otherPracticeActivity(unknown), undefined, unknown);
  }
});

test("all self-directed categories add practice minutes without changing the required queue", () => {
  const course = fixtureCourse();
  const history = OTHER_PRACTICE_ACTIVITIES.map((activity, index) => otherAttempt(`other-${index}`, activity.id));
  const before = structuredClone({ course, history });
  const baseline = getTrainingPlan(course, [], now);
  const plan = getTrainingPlan(course, history, now);
  assert.equal(plan.practicedMinutes, 30);
  assert.equal(plan.dailyGoalMinutes, 60);
  assert.equal(plan.next.task.id, "sending");
  assert.deepEqual({ ...plan, practicedMinutes: 0 }, baseline);
  assert.deepEqual({ course, history }, before, "planning never mutates curriculum or saved records");
});

test("self-directed practice cannot complete or advance sending, listening, ICR, or simulator objectives", () => {
  const course = fixtureCourse();
  const assigned = [{
    ...otherAttempt("assigned-partial"), assignmentId: "s1d1", taskId: "words",
    review: false, completedPasses: 1, activeSeconds: 180,
  }];
  const selfDirected = OTHER_PRACTICE_ACTIVITIES.map((activity, index) => otherAttempt(`extra-${index}`, activity.id, {
    activeSeconds: 1800, endedAt: "2026-09-08T12:30:00.000Z",
  }));
  for (const task of course.assignments[0].tasks) {
    const progress = taskProgress(task, [...assigned, ...selfDirected]);
    assert.deepEqual(progress, taskProgress(task, assigned), task.id);
    assert.equal(progress.complete, false, task.id);
  }
  const plan = getTrainingPlan(course, [...assigned, ...selfDirected], now);
  assert.equal(plan.practicedMinutes, 93, "the daily target does not cap recorded time");
  assert.equal(plan.dailyGoalMinutes, 60);
  assert.equal(plan.queue.length, 4, "exceeding an hour never clears assigned work");
  const words = plan.queue.find((item) => item.task.id === "words");
  assert.equal(words.completedPasses, 1);
  assert.equal(words.remainingPasses, 1);
  assert.equal(words.activeSeconds, 180);
});

test("self-directed minutes follow the course date, including the Eastern midnight boundary", () => {
  const course = fixtureCourse();
  const history = [
    otherAttempt("late-seventh", "other:word-recognition", {
      startedAt: "2026-09-08T03:50:00.000Z", endedAt: "2026-09-08T04:05:00.000Z", activeSeconds: 900,
    }),
    otherAttempt("early-eighth", "other:icr", {
      startedAt: "2026-09-08T04:00:00.000Z", endedAt: "2026-09-08T04:05:00.000Z", activeSeconds: 300,
    }),
    otherAttempt("late-eighth", "other:general", {
      startedAt: "2026-09-09T03:30:00.000Z", endedAt: "2026-09-09T03:40:00.000Z",
    }),
    otherAttempt("early-ninth", "other:general", {
      startedAt: "2026-09-09T04:00:00.000Z", endedAt: "2026-09-09T04:20:00.000Z", activeSeconds: 1200,
    }),
  ];
  for (const [stamp, date, minutes] of [
    ["2026-09-08T03:59:59.000Z", "2026-09-07", 15],
    ["2026-09-09T03:59:59.000Z", "2026-09-08", 15],
    ["2026-09-09T20:00:00.000Z", "2026-09-09", 20],
  ]) {
    const plan = getTrainingPlan(course, history, new Date(stamp));
    assert.equal(plan.date, date);
    assert.equal(plan.practicedMinutes, minutes, "a block counts on its start date, like assigned practice");
  }
});

test("daily totals combine assigned and self-directed practice but still exclude class time", () => {
  const course = fixtureCourse();
  const other = otherAttempt("self-directed", "other:icr");
  const assigned = {
    ...otherAttempt("assigned"), assignmentId: "s1d1", taskId: "sending",
    review: false, completed: true, activeSeconds: 300,
  };
  const classWork = {
    ...otherAttempt("class"), assignmentId: "s1d1", taskId: "characters",
    context: "class", review: false, completed: true, activeSeconds: 3600,
    endedAt: "2026-09-08T13:00:00.000Z",
  };
  const plan = getTrainingPlan(course, [other, assigned, classWork], now);
  assert.equal(plan.practicedMinutes, 15);
  assert.ok(!plan.queue.some((item) => item.task.id === "sending"));
  assert.ok(plan.queue.some((item) => item.task.id === "characters"));
});

test("duplicate self-directed attempt IDs count once while distinct sessions in one category accumulate", () => {
  const course = fixtureCourse();
  const first = otherAttempt("first-session", "other:word-recognition");
  const second = otherAttempt("second-session", "other:word-recognition", { activeSeconds: 300 });
  const plan = getTrainingPlan(course, [first, structuredClone(first), second, structuredClone(second)], now);
  assert.equal(plan.practicedMinutes, 15);
  const updated = { ...first, activeSeconds: 420 };
  assert.equal(getTrainingPlan(course, [first, updated, second], now).practicedMinutes, 12,
    "existing last-record-per-ID planner semantics also apply to self-directed records");
});

test("serialized snapshots preserve self-directed categories, notes, and daily accounting", () => {
  const course = fixtureCourse();
  const attempts = OTHER_PRACTICE_ACTIVITIES.map((activity, index) => otherAttempt(`roundtrip-${index}`, activity.id, {
    note: `${activity.title}: synthetic trainer at 15 WPM.\nA separate reflection.`,
  }));
  const snapshot = {
    userId: "synthetic-owner", course, attempts, materials: [],
    preferences: { blockMinutes: 15, reminderTime: "09:00", updatedAt: "2026-09-08T12:00:00.000Z" },
    serverTime: now.toISOString(),
  };
  const restored = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(restored, snapshot);
  for (const item of restored.attempts) {
    assert.equal(item.assignmentId, OTHER_PRACTICE_ASSIGNMENT_ID);
    assert.ok(otherPracticeActivity(item.taskId));
    assert.equal(item.context, "practice");
    assert.equal(item.review, true);
    assert.equal(item.completed, false);
  }
  assert.deepEqual(getTrainingPlan(restored.course, restored.attempts, now), getTrainingPlan(course, attempts, now));
  assert.equal(getTrainingPlan(restored.course, [...restored.attempts, ...attempts], now).practicedMinutes, 30);
});

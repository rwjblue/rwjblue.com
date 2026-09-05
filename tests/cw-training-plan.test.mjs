import assert from "node:assert/strict";
import test from "node:test";
import { dateInTimezone, getTrainingPlan, taskProgress } from "../src/lib/cw-training/plan.ts";

const makeTask = (id, kind, extra = {}) => ({ id, kind, title: id, instructions: "Synthetic practice instruction.", sourceUrl: "https://example.invalid", ...extra });
function fixtureCourse() {
  return {
    id: "fixture", title: "Fixture", version: "1", instructions: "Fixture", verifiedAt: "2026-09-05", sourceUrl: "https://example.invalid", timezone: "America/New_York", dailyGoalMinutes: 60,
    meetings: [
      { session: 1, startsAt: "2026-09-07T19:30:00Z", endsAt: "2026-09-07T20:30:00Z" },
      { session: 2, startsAt: "2026-09-10T19:30:00Z", endsAt: "2026-09-10T20:30:00Z" },
    ],
    assignments: [
      { id: "s1d1", session: 1, day: 1, date: "2026-09-05", dueAt: "2026-09-07T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("send", "sending"), makeTask("audio", "audio", { resourceId: "recording", minimumPasses: 2 }), makeTask("icr", "icr")] },
      { id: "s1d2", session: 1, day: 2, date: "2026-09-06", dueAt: "2026-09-07T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("run", "simulator", { minutes: 15 })] },
      { id: "s1d3", session: 1, day: 3, date: "2026-09-07", dueAt: "2026-09-07T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("send2", "sending")] },
      { id: "s2d1", session: 2, day: 1, date: "2026-09-08", dueAt: "2026-09-10T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("send3", "sending")] },
      { id: "s2d2", session: 2, day: 2, date: "2026-09-09", dueAt: "2026-09-10T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("live", "live", { objectiveCount: 5 })] },
      { id: "s2d3", session: 2, day: 3, date: "2026-09-10", dueAt: "2026-09-10T19:30:00Z", instructions: "Fixture", sourceUrl: "https://example.invalid", tasks: [makeTask("send4", "sending")] },
    ],
    resources: [{ id: "recording", title: "Fixture", url: "https://example.invalid/fixture.mp3", format: "audio", durationSeconds: 443.2 }],
  };
}
const attempt = (taskId, extra = {}) => ({ id: `attempt-${taskId}`, taskId, assignmentId: "s1d1", startedAt: "2026-09-05T12:00:00Z", endedAt: "2026-09-05T12:15:00Z", activeSeconds: 900, completed: true, context: "practice", ...extra });

test("the opening day uses Eastern dates and packs whole audio passes into 10 or 15 minutes", () => {
  const course = fixtureCourse();
  const short = getTrainingPlan(course, [attempt("send")], new Date("2026-09-05T22:00:00Z"), 10);
  assert.equal(short.assignment.id, "s1d1");
  assert.equal(short.next.task.id, "audio");
  assert.equal(short.next.passesThisBlock, 1);
  assert.equal(short.next.suggestedMinutes, 8);
  const normal = getTrainingPlan(course, [attempt("send")], new Date("2026-09-05T22:00:00Z"), 15);
  assert.equal(normal.next.passesThisBlock, 2);
  assert.equal(normal.practicedMinutes, 15);
  assert.equal(dateInTimezone("2026-09-06T01:00:00Z"), "2026-09-05");
});

test("partial passes accumulate once and interrupted work has priority", () => {
  const course = fixtureCourse();
  const partial = attempt("audio", { completed: false, completedPasses: 1, activeSeconds: 443.2 });
  const plan = getTrainingPlan(course, [partial, partial], new Date("2026-09-05T22:00:00Z"), 15);
  assert.equal(plan.next.task.id, "audio");
  assert.equal(plan.next.completedPasses, 1);
  assert.equal(plan.next.remainingPasses, 1);
  assert.equal(plan.next.passesThisBlock, 1);
  assert.equal(plan.next.interrupted, true);
  assert.equal(taskProgress(course.assignments[0].tasks[1], [partial, partial]).complete, false);
  const finished = attempt("audio", { id: "second-pass", completedPasses: 1 });
  assert.equal(taskProgress(course.assignments[0].tasks[1], [partial, finished]).complete, true);
});

test("audio coverage does not override an explicitly unfinished listening objective", () => {
  const course = fixtureCourse();
  const listened = attempt("audio", { completed: false, completedPasses: 2 });
  const task = course.assignments[0].tasks[1];
  assert.equal(taskProgress(task, [listened]).complete, false);
  const plan = getTrainingPlan(course, [listened], new Date("2026-09-05T22:00:00Z"));
  assert.equal(plan.next.task.id, "audio");
  assert.equal(plan.next.remainingPasses, 0);
  assert.equal(plan.next.passesThisBlock, 1);
  assert.ok(plan.next.suggestedMinutes > 0);
  assert.match(plan.next.reason, /Confirm the listening objective/);
  const confirmed = attempt("audio", { id: "confirmation", completed: true, completedPasses: 0, activeSeconds: 0 });
  assert.equal(taskProgress(task, [listened, confirmed]).complete, true);
});

test("fixed simulator runs do not fit ten minutes and cannot aggregate partial runs", () => {
  const course = fixtureCourse();
  const plan = getTrainingPlan(course, [], new Date("2026-09-06T22:00:00Z"), 10);
  assert.equal(plan.blocked[0].task.id, "run");
  assert.match(plan.blocked[0].reason, /15 uninterrupted/);
  const run = course.assignments[1].tasks[0];
  assert.equal(taskProgress(run, [attempt("run", { activeSeconds: 480 }), attempt("run", { id: "run-2", activeSeconds: 480 })]).complete, false);
  assert.equal(taskProgress(run, [attempt("run")]).complete, true);
});

test("class boundaries preserve today's quota and never start tomorrow's required queue", () => {
  const course = fixtureCourse();
  const before = getTrainingPlan(course, [], new Date("2026-09-07T19:29:59Z"));
  assert.equal(before.phase, "practice");
  assert.equal(before.assignment.id, "s1d3");
  const during = getTrainingPlan(course, [], new Date("2026-09-07T19:30:00Z"));
  assert.equal(during.phase, "class");
  assert.equal(during.queue.length, 0);
  assert.equal(during.assignment.id, "s1d3");
  const after = getTrainingPlan(course, [], new Date("2026-09-07T20:30:00Z"));
  assert.equal(after.phase, "rest");
  assert.equal(after.assignment.id, "s1d3");
  assert.equal(after.dailyGoalMinutes, 60);
  assert.equal(after.queue.length, 0);
  const nextDay = getTrainingPlan(course, [], new Date("2026-09-08T12:00:00Z"));
  assert.equal(nextDay.next.task.id, "send3");
  assert.ok(nextDay.missed.every((item) => item.assignment.session === 1));
});

test("missed work is explicit, bounded to the previous class, and never silently complete", () => {
  const course = fixtureCourse();
  const left = attempt("send", { completed: false, note: "[Left missed]" });
  const plan = getTrainingPlan(course, [left], new Date("2026-09-10T21:00:00Z"));
  assert.ok(plan.missed.every((item) => item.assignment.session === 2));
  assert.equal(taskProgress(course.assignments[0].tasks[0], [left]).complete, false);
  assert.equal(taskProgress(course.assignments[0].tasks[0], [left]).interrupted, false);
});

test("unknown audio duration remains explicit and unresolved files stay blocked", () => {
  const course = fixtureCourse();
  delete course.resources[0].durationSeconds;
  const plan = getTrainingPlan(course, [attempt("send")], new Date("2026-09-05T22:00:00Z"), 10);
  assert.equal(plan.next.task.id, "audio");
  assert.equal(plan.next.suggestedMinutes, 10);
  assert.match(plan.next.reason, /not yet measured/);
  course.resources[0].unresolved = "Fixture discrepancy";
  const blocked = getTrainingPlan(course, [attempt("send")], new Date("2026-09-05T22:00:00Z"));
  assert.equal(blocked.next.task.id, "icr");
  assert.equal(blocked.blocked[0].reason, "Fixture discrepancy");
});

test("long audio passes require a larger block instead of being split", () => {
  const course = fixtureCourse();
  course.resources[0].durationSeconds = 960;
  const plan = getTrainingPlan(course, [attempt("send")], new Date("2026-09-05T22:00:00Z"));
  assert.equal(plan.blocked[0].suggestedMinutes, 16);
  assert.equal(plan.blocked[0].passesThisBlock, 1);
});

test("daily minutes exclude class work and required coverage remains separate from the goal", () => {
  const course = fixtureCourse();
  const history = [attempt("send", { activeSeconds: 3600 }), attempt("class", { context: "class", activeSeconds: 3600 })];
  const plan = getTrainingPlan(course, history, new Date("2026-09-05T22:00:00Z"));
  assert.equal(plan.practicedMinutes, 60);
  assert.equal(plan.next.task.id, "audio");
  const covered = [attempt("send", { activeSeconds: 600 }), attempt("audio", { activeSeconds: 600 }), attempt("icr", { activeSeconds: 600 })];
  const review = getTrainingPlan(course, covered, new Date("2026-09-05T22:00:00Z"));
  assert.equal(review.next.task.id, "s1d1-reinforcement");
  assert.equal(review.next.task.optional, true);
});

test("live tasks appear before the operating window and early completion is credited once", () => {
  const course = fixtureCourse();
  const plan = getTrainingPlan(course, [], new Date("2026-09-08T12:00:00Z"));
  assert.equal(plan.liveUpcoming[0].task.id, "live");
  assert.equal(plan.liveUpcoming[0].windows.length, 4);
  assert.equal(plan.liveUpcoming[0].windows[0].start.toISOString(), "2026-09-09T13:00:00.000Z");
  const done = getTrainingPlan(course, [attempt("live")], new Date("2026-09-09T22:00:00Z"));
  assert.equal(done.liveUpcoming.length, 0);
  assert.ok(done.queue.every((item) => item.task.id !== "live"));
});

test("live practice is recommended only during an eligible CWT window", () => {
  const course = fixtureCourse();
  const history = [attempt("send3"), attempt("send4")];
  const early = getTrainingPlan(course, history, new Date("2026-09-09T12:30:00Z"));
  assert.ok(early.queue.every((item) => item.task.id !== "live"));
  assert.match(early.blocked.find((item) => item.task.id === "live").reason, /next CWT window starts/);
  const onAir = getTrainingPlan(course, history, new Date("2026-09-09T13:30:00Z"));
  assert.equal(onAir.next.task.id, "live");
  assert.equal(onAir.next.availableNow, true);
  const tooLate = getTrainingPlan(course, history, new Date("2026-09-10T12:00:00Z"));
  assert.ok(tooLate.queue.every((item) => item.task.id !== "live"));
  assert.match(tooLate.blocked.find((item) => item.task.id === "live").reason, /No CWT window remains/);
  assert.match(tooLate.liveUpcoming[0].reason, /No CWT window remains/);
});

test("outside scheduled dates the planner offers no artificial daily quota", () => {
  const course = fixtureCourse();
  assert.equal(getTrainingPlan(course, [], new Date("2026-09-04T12:00:00Z")).phase, "upcoming");
  const after = getTrainingPlan(course, [], new Date("2026-09-11T12:00:00Z"));
  assert.equal(after.phase, "complete");
  assert.equal(after.dailyGoalMinutes, 0);
  assert.equal(after.queue.length, 0);
});

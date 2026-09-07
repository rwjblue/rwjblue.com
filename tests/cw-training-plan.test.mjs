import assert from "node:assert/strict";
import test from "node:test";
import { dateInTimezone, getTrainingPlan, matchesPracticeMode, taskProgress } from "../src/lib/cw-training/plan.ts";

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
  assert.equal(review.next.task.id, "send");
  assert.equal(review.next.task.optional, true);
  assert.equal(review.next.extra, true);
  assert.equal(review.queue.length, 0);
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

test("practice modes select a suitable next action without hiding other required work", () => {
  const expected = {
    anything: ["sending", "audio", "icr", "simulator", "live", "review"],
    listen: ["audio"], send: ["sending"], computer: ["icr", "simulator"],
  };
  for (const [mode, kinds] of Object.entries(expected)) {
    for (const kind of expected.anything) assert.equal(matchesPracticeMode(makeTask("test", kind), mode), kinds.includes(kind));
  }
  const course = fixtureCourse();
  const now = new Date("2026-09-05T22:00:00Z");
  const listen = getTrainingPlan(course, [], now, 15, "listen");
  assert.equal(listen.next.task.id, "audio");
  assert.equal(listen.next.extra, undefined);
  assert.deepEqual(listen.queue.map((item) => item.task.id), ["send", "audio", "icr"]);
  assert.equal(getTrainingPlan(course, [], now, 15, "send").next.task.id, "send");
  assert.equal(getTrainingPlan(course, [], now, 15, "computer").next.task.id, "icr");
  const tenMinutes = getTrainingPlan(course, [], new Date("2026-09-06T22:00:00Z"), 10, "listen");
  assert.equal(tenMinutes.blocked[0].task.id, "run");
});

test("finishing sixty minutes never removes fitting optional suggestions", () => {
  const course = fixtureCourse();
  const source = JSON.stringify(course);
  const history = [attempt("send", { activeSeconds: 1800 }), attempt("audio", { activeSeconds: 1800 }), attempt("icr", { activeSeconds: 900 })];
  const plan = getTrainingPlan(course, history, new Date("2026-09-05T22:00:00Z"), 15, "listen");
  assert.equal(plan.practicedMinutes, 75);
  assert.equal(plan.queue.length, 0);
  assert.equal(plan.next.task.id, "audio");
  assert.equal(plan.next.assignment.id, "s1d1");
  assert.equal(plan.next.extra, true);
  assert.equal(plan.next.task.optional, true);
  assert.equal(plan.next.completedPasses, 0, "review starts its own playback target");
  assert.equal(plan.next.passesThisBlock, 2);
  assert.equal(JSON.stringify(course), source, "optional clones never change the curriculum");
});

test("listening review remains available while sending requirements are unfinished", () => {
  const course = fixtureCourse();
  const history = [attempt("audio")];
  const plan = getTrainingPlan(course, history, new Date("2026-09-05T22:00:00Z"), 15, "listen");
  assert.deepEqual(plan.queue.map((item) => item.task.id), ["send", "icr"]);
  assert.equal(plan.next.task.id, "audio");
  assert.equal(plan.next.extra, true);
  assert.deepEqual(plan.extras.map((item) => item.task.kind), ["audio"]);
});

test("extras rotate by the last practice of a recording and deduplicate repeated material", () => {
  const course = fixtureCourse();
  course.resources.push({ ...course.resources[0], id: "recording2", url: "https://example.invalid/second.mp3", durationSeconds: 120 });
  course.assignments[0].tasks.push(makeTask("audio2", "audio", { resourceId: "recording2", minimumPasses: 2 }));
  // The second assignment repeats a resource under another task ID.
  course.assignments[1].tasks.push(makeTask("repeated-audio", "audio", { resourceId: "recording", minimumPasses: 2 }));
  course.assignments[1].tasks.push(makeTask("repeated-audio2", "audio", { resourceId: "recording2", minimumPasses: 2 }));
  const now = new Date("2026-09-06T22:00:00Z");
  const history = [
    attempt("audio", { endedAt: "2026-09-05T12:00:00Z" }),
    attempt("audio2", { endedAt: "2026-09-05T13:00:00Z" }),
    attempt("repeated-audio", { endedAt: "2026-09-06T12:00:00Z" }),
    attempt("repeated-audio2", { endedAt: "2026-09-06T13:00:00Z" }),
  ];
  const initial = getTrainingPlan(course, history, now, 15, "listen");
  assert.deepEqual(initial.extras.map((item) => item.task.id), ["repeated-audio", "repeated-audio2"]);
  const replay = attempt("audio", { id: "new-review", review: true, startedAt: "2026-09-06T14:00:00Z", endedAt: "2026-09-06T14:15:00Z" });
  const rotated = getTrainingPlan(course, [...history, replay, replay], now, 15, "listen");
  assert.equal(rotated.next.task.id, "repeated-audio2", "replaying an older task rotates the same recording's newer task too");
  assert.equal(rotated.practicedMinutes, 15, "a duplicate review ID counts only once");
  const nextReplay = attempt("repeated-audio2", { id: "second-review", review: true, startedAt: "2026-09-06T15:00:00Z", endedAt: "2026-09-06T15:15:00Z" });
  assert.equal(getTrainingPlan(course, [...history, replay, nextReplay], now, 15, "listen").next.task.id, "repeated-audio");
});

test("a single latest recording rotates through recent assignments without reaching distant material", () => {
  const course = fixtureCourse();
  const dates = ["2026-08-20", "2026-09-05", "2026-09-06", "2026-09-07"];
  course.resources = dates.map((date, index) => ({ id: `recording-${index}`, title: `Fixture ${index}`, url: `https://example.invalid/${index}.mp3`, format: "audio", durationSeconds: 120 }));
  course.assignments = dates.map((date, index) => ({ ...course.assignments[0], id: `day-${index}`, date, tasks: [makeTask(`audio-${index}`, "audio", { resourceId: `recording-${index}`, minimumPasses: 1 })] }));
  // An older task points at the newest recording too. It must not masquerade
  // as another fresh alternative after the newer task was replayed.
  course.assignments[1].tasks.push(makeTask("duplicate-latest", "audio", { resourceId: "recording-3", minimumPasses: 1 }));
  const history = course.assignments.flatMap((assignment) => assignment.tasks.map((task) => attempt(task.id, { assignmentId: assignment.id })));
  const now = new Date("2026-09-07T18:00:00Z");
  const build = (extra = []) => getTrainingPlan(course, [...history, ...extra], now, 15, "listen");
  const initial = build();
  assert.deepEqual(initial.extras.map((item) => item.task.id), ["audio-3", "audio-2", "audio-1"]);
  const reviews = [];
  for (const [index, expected] of ["audio-3", "audio-2", "audio-1"].entries()) {
    assert.equal(build(reviews).next.task.id, expected);
    reviews.push(attempt(expected, { id: `rotation-${index}`, review: true, startedAt: `2026-09-07T${12 + index}:00:00Z`, endedAt: `2026-09-07T${12 + index}:15:00Z` }));
  }
  assert.equal(build([...reviews, reviews[0]]).next.task.id, "audio-3", "after reviewing the pool, return to the least recently reviewed material");
  reviews.push(attempt("duplicate-latest", { id: "repeat-latest", review: true, startedAt: "2026-09-07T15:00:00Z", endedAt: "2026-09-07T15:15:00Z" }));
  const rotated = build(reviews);
  assert.equal(rotated.next.task.id, "audio-2");
  assert.ok(rotated.extras.every((item) => item.assignment.date >= "2026-09-05"));
  assert.equal(rotated.extras.filter((item) => item.resource.id === "recording-3").length, 1);
  const nextDay = getTrainingPlan(course, [...history, ...reviews], new Date("2026-09-08T18:00:00Z"), 15, "listen");
  assert.equal(nextDay.next.task.id, "audio-3", "a new day begins with the latest composition again");
});

test("extra review minutes count without completing or dismissing required objectives", () => {
  const course = fixtureCourse();
  const reviews = [
    attempt("send", { review: true }),
    attempt("audio", { review: true, completedPasses: 4 }),
    attempt("icr", { review: true }),
    attempt("run", { review: true }),
    attempt("send2", { review: true, completed: false, note: "[Left missed]" }),
  ];
  for (const task of course.assignments.flatMap((assignment) => assignment.tasks)) {
    assert.equal(taskProgress(task, reviews).complete, false);
    assert.equal(taskProgress(task, reviews).completedPasses, 0);
    assert.equal(taskProgress(task, reviews).interrupted, false);
  }
  const plan = getTrainingPlan(course, reviews, new Date("2026-09-07T12:00:00Z"), 15, "send");
  assert.ok(plan.queue.some((item) => item.task.id === "send2"), "a review note cannot leave a required task missed");
  const opening = getTrainingPlan(course, reviews, new Date("2026-09-05T22:00:00Z"), 15, "listen");
  assert.equal(opening.practicedMinutes, 75);
  assert.equal(opening.next.task.id, "audio");
  assert.equal(opening.next.extra, undefined);
  assert.equal(opening.next.remainingPasses, 2);
});

test("rest, post-class, and post-course suggestions stay on familiar dated material", () => {
  const course = fixtureCourse();
  const postClass = getTrainingPlan(course, [], new Date("2026-09-07T21:00:00Z"), 15, "send");
  assert.equal(postClass.phase, "rest");
  assert.equal(postClass.next.task.id, "send2");
  assert.equal(postClass.next.extra, true);
  const duringClass = getTrainingPlan(course, [], new Date("2026-09-07T19:45:00Z"), 15, "listen");
  assert.equal(duringClass.next, undefined);
  assert.equal(duringClass.extras.length, 0);

  const postCourse = getTrainingPlan(course, [], new Date("2026-09-11T12:00:00Z"), 15, "send");
  assert.equal(postCourse.phase, "complete");
  assert.equal(postCourse.dailyGoalMinutes, 0);
  assert.equal(postCourse.next.task.id, "send4");
  course.meetings.push({ session: 3, startsAt: "2026-09-14T19:30:00Z", endsAt: "2026-09-14T20:30:00Z" });
  course.assignments.push({ ...course.assignments[0], id: "s3d1", session: 3, date: "2026-09-12", dueAt: "2026-09-14T19:30:00Z", tasks: [makeTask("future-send", "sending"), makeTask("future-audio", "audio", { resourceId: "recording", speedWpm: 25, minimumPasses: 2 })] });
  const restDay = getTrainingPlan(course, [], new Date("2026-09-11T12:00:00Z"), 15, "listen");
  assert.equal(restDay.phase, "rest");
  assert.equal(restDay.dailyGoalMinutes, 0);
  assert.equal(restDay.next.task.id, "audio");
  assert.ok(restDay.extras.every((item) => item.assignment.date < "2026-09-12"));
  assert.equal(getTrainingPlan(course, [], new Date("2026-09-04T12:00:00Z"), 15, "listen").next, undefined);
  const review = attempt(restDay.next.task.id, { review: true, completedPasses: 2 });
  assert.equal(taskProgress(course.assignments.at(-1).tasks[1], [review]).complete, false, "replaying a shared recording cannot complete tomorrow's task");
});

test("extra suggestions respect audio fit, missing resources, and uninterrupted runs", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-06T22:00:00Z");
  const history = [attempt("audio"), attempt("icr"), attempt("run")];
  const computer = getTrainingPlan(course, history, now, 10, "computer");
  assert.equal(computer.next.task.id, "icr");
  assert.ok(computer.extras.every((item) => item.task.kind !== "simulator"));
  const fifteen = getTrainingPlan(course, history, now, 15, "computer");
  assert.equal(fifteen.next.task.id, "run");
  assert.equal(fifteen.next.suggestedMinutes, 15);

  course.resources[0].durationSeconds = 960;
  const longRequired = getTrainingPlan(course, [], new Date("2026-09-05T22:00:00Z"), 10, "listen");
  assert.equal(longRequired.next, undefined);
  assert.equal(longRequired.extras.length, 0);
  assert.equal(longRequired.blocked[0].task.id, "audio");
  for (const resource of [
    { ...course.resources[0], durationSeconds: 120, unresolved: "Ask the advisor." },
    { ...course.resources[0], durationSeconds: undefined },
    { ...course.resources[0], durationSeconds: 120, format: "link" },
  ]) {
    course.resources = [resource];
    assert.equal(getTrainingPlan(course, history, now, 15, "listen").extras.length, 0);
  }
  course.resources = [];
  assert.equal(getTrainingPlan(course, history, now, 15, "listen").extras.length, 0);
  const liveOnly = { ...course, assignments: course.assignments.map((assignment) => ({ ...assignment, tasks: assignment.tasks.filter((task) => task.kind === "live") })) };
  assert.equal(getTrainingPlan(liveOnly, [], new Date("2026-09-11T12:00:00Z")).extras.length, 0);
});

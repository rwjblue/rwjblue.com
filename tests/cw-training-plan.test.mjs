import assert from "node:assert/strict";
import test from "node:test";
import { availableBlockMinutes, dateInTimezone, getTrainingPlan, matchesPracticeMode, taskProgress } from "../src/lib/cw-training/plan.ts";

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

test("unrelated fixed simulator runs do not fit ten minutes or aggregate partial runs", () => {
  const course = fixtureCourse();
  const plan = getTrainingPlan(course, [], new Date("2026-09-06T22:00:00Z"), 10);
  assert.equal(plan.blocked[0].task.id, "run");
  assert.match(plan.blocked[0].reason, /15 uninterrupted/);
  const run = course.assignments[1].tasks[0];
  assert.equal(taskProgress(run, [attempt("run", { activeSeconds: 480 }), attempt("run", { id: "run-2", activeSeconds: 480 })]).complete, false);
  assert.equal(taskProgress(run, [attempt("run")]).complete, true);
});

test("Morse Runner assignment time combines ten plus five minutes without changing saved outcomes", () => {
  const task = makeTask("runner", "simulator", { title: "Morse Runner", minutes: 15 });
  const first = attempt("runner", { id: "ten-minute-run", completed: false, activeSeconds: 600 });
  const second = attempt("runner", { id: "five-minute-run", completed: false, activeSeconds: 300 });
  const history = [first, second];
  const original = structuredClone(history);
  assert.deepEqual(taskProgress(task, [first]), {
    complete: false, started: true, completedPasses: 0, activeSeconds: 600, interrupted: true,
  });
  assert.deepEqual(taskProgress(task, history), {
    complete: true, started: true, completedPasses: 0, activeSeconds: 900, interrupted: false,
  });
  assert.deepEqual(history, original, "retroactive credit is derived; saved records remain unchanged");
});

test("fifteen one-minute saved Morse Runner runs satisfy the assigned fifteen minutes", () => {
  const task = makeTask("runner", "simulator", { title: "Morse Runner", minutes: 15 });
  const history = Array.from({ length: 15 }, (_, index) => attempt("runner", {
    id: `one-minute-run-${index}`, completed: false, activeSeconds: 60,
  }));
  assert.equal(taskProgress(task, history.slice(0, 14)).complete, false);
  const progress = taskProgress(task, history);
  assert.equal(progress.activeSeconds, 900);
  assert.equal(progress.complete, true);
  assert.equal(progress.interrupted, false);
});

test("interrupted and previously saved Morse Runner partials accumulate even with old result notes", () => {
  const task = makeTask("runner", "simulator", { instructions: "Use Morse Runner for practice.", minutes: 15 });
  const history = [
    attempt("runner", { id: "older-embedded", completed: false, activeSeconds: 450, note: "Web Morse Runner: stopped (partial); 450s; 10 WPM starting speed." }),
    attempt("runner", { id: "interrupted-embedded", completed: false, activeSeconds: 449, note: "Web Morse Runner interrupted; confirmed time retained." }),
  ];
  assert.equal(taskProgress(task, history).complete, false);
  assert.equal(taskProgress(task, history).activeSeconds, 899);
  const lastSecond = attempt("runner", { id: "last-second", completed: false, activeSeconds: 1 });
  assert.equal(taskProgress(task, [...history, lastSecond]).complete, true);
  const blankCompleted = attempt("runner", { id: "empty-confirmation", completed: true, activeSeconds: 0 });
  assert.equal(taskProgress(task, [blankCompleted]).complete, false, "a completion flag alone cannot replace actual practice time");
});

test("cumulative Morse Runner credit deduplicates IDs and excludes review, class, and other tasks", () => {
  const task = makeTask("runner", "simulator", { title: "Morse Runner", minutes: 15 });
  const required = attempt("runner", { id: "required-ten", completed: false, activeSeconds: 600 });
  const exclusions = [
    attempt("runner", { id: "extra-review", activeSeconds: 900, review: true }),
    attempt("runner", { id: "class-run", activeSeconds: 900, context: "class" }),
    attempt("other-runner", { id: "another-assignment", activeSeconds: 900 }),
  ];
  const progress = taskProgress(task, [required, structuredClone(required), ...exclusions]);
  assert.equal(progress.activeSeconds, 600);
  assert.equal(progress.complete, false);
  const remaining = attempt("runner", { id: "required-five", completed: false, activeSeconds: 300 });
  assert.equal(taskProgress(task, [required, required, remaining, remaining, ...exclusions]).activeSeconds, 900);
  assert.equal(taskProgress(task, [required, required, remaining, remaining, ...exclusions]).complete, true);
});

test("required Morse Runner practice fits short blocks and recommends only the remaining minutes", () => {
  const course = fixtureCourse();
  const runner = course.assignments[1].tasks[0];
  Object.assign(runner, { title: "Morse Runner", instructions: "Single calls at 10 WPM.", speedWpm: 10 });
  const now = new Date("2026-09-06T12:00:00Z");
  const original = structuredClone(course);
  assert.deepEqual(availableBlockMinutes(course, [], now, "computer"), [3, 5, 10, 15]);
  for (const minutes of [3, 5, 10, 15]) {
    const plan = getTrainingPlan(course, [], now, minutes, "computer");
    assert.equal(plan.next.task.id, runner.id);
    assert.equal(plan.next.extra, undefined, "short required practice stays separate from review");
    assert.equal(plan.next.suggestedMinutes, minutes);
    assert.ok(!plan.blocked.some((item) => item.task.id === runner.id));
    assert.doesNotMatch(plan.next.reason ?? "", /uninterrupted/);
  }
  for (const [seconds, blockMinutes, expected] of [[600, 3, 3], [600, 10, 5], [600, 15, 5], [601, 15, 5], [839, 15, 2], [840, 15, 1], [899, 3, 1]]) {
    const history = [attempt("run", { assignmentId: "s1d2", completed: false, activeSeconds: seconds })];
    const plan = getTrainingPlan(course, history, now, blockMinutes, "computer");
    assert.equal(plan.next.task.id, runner.id);
    assert.equal(plan.next.suggestedMinutes, expected);
    assert.equal(plan.next.activeSeconds, seconds);
  }
  const complete = [attempt("run", { assignmentId: "s1d2", completed: false, activeSeconds: 900 })];
  const completedPlan = getTrainingPlan(course, complete, now, 3, "computer");
  assert.ok(!completedPlan.queue.some((item) => item.task.id === runner.id));
  assert.equal(completedPlan.runnerReview.extra, true);
  assert.equal(completedPlan.runnerReview.suggestedMinutes, 3, "review is still its own fresh practice block");
  assert.deepEqual(course, original);
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

test("missed work remains available across previous classes and never silently completes", () => {
  const course = fixtureCourse();
  const left = attempt("send", { completed: false, note: "[Left missed]" });
  const plan = getTrainingPlan(course, [left], new Date("2026-09-10T21:00:00Z"));
  assert.deepEqual([...new Set(plan.missed.map((item) => item.assignment.session))], [1, 2]);
  assert.ok(!plan.missed.some((item) => item.task.id === "send"));
  assert.equal(taskProgress(course.assignments[0].tasks[0], [left]).complete, false);
  assert.equal(taskProgress(course.assignments[0].tasks[0], [left]).interrupted, false);
});

test("adding old work to today preserves its assignment and progress without recording practice", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-08T12:00:00Z");
  const history = [attempt("audio", { completed: false, activeSeconds: 443, completedPasses: 1 })];
  const before = structuredClone({ course, history });
  const pinned = [{ taskId: "audio", date: "2026-09-08" }, { taskId: "audio", date: "2026-09-08" }];
  const plan = getTrainingPlan(course, history, now, 15, "anything", pinned);
  assert.equal(plan.next.task.id, "send3", "today's required work stays first");
  assert.deepEqual(plan.queue.map((item) => item.task.id), ["send3", "audio"]);
  const item = plan.queue.find((item) => item.carried);
  assert.equal(item.assignment.id, "s1d1");
  assert.equal(item.assignment.date, "2026-09-05");
  assert.equal(item.task, course.assignments[0].tasks[1]);
  assert.equal(item.remainingPasses, 1);
  assert.equal(item.activeSeconds, 443);
  assert.equal(plan.practicedMinutes, 0);
  assert.ok(!plan.missed.some((entry) => entry.task.id === "audio"));
  assert.deepEqual({ course, history }, before, "selection never mutates curriculum/history");
});

test("carried work stays in the plan across filters, class/rest windows, and original dismissals", () => {
  const course = fixtureCourse();
  const pin = [{ taskId: "run", date: "2026-09-08" }];
  const history = [attempt("run", { activeSeconds: 0, completed: false, note: "[Left missed]" })];
  const short = getTrainingPlan(course, history, new Date("2026-09-08T12:00:00Z"), 3, "listen", pin);
  assert.equal(short.blocked.find((item) => item.task.id === "run").carried, true);
  assert.equal(short.next, undefined, "a computer carry never becomes a listening recommendation");
  for (const stamp of ["2026-09-07T19:45:00Z", "2026-09-07T21:00:00Z", "2026-09-11T12:00:00Z"]) {
    const date = stamp.slice(0, 10);
    const plan = getTrainingPlan(course, history, new Date(stamp), 15, "computer", [{ taskId: "run", date }]);
    assert.equal(plan.queue.find((item) => item.task.id === "run").carried, true);
    if (plan.phase === "class") assert.equal(plan.next, undefined);
  }
});

test("carry pins deduplicate natural queues and expire by course date without erasing progress", () => {
  const course = fixtureCourse();
  const pinned = [{ taskId: "audio", date: "2026-09-07" }];
  const monday = getTrainingPlan(course, [], new Date("2026-09-07T12:00:00Z"), 15, "anything", pinned);
  assert.equal(monday.queue.filter((item) => item.task.id === "audio").length, 1);
  assert.equal(monday.queue.find((item) => item.task.id === "audio").carried, true);
  const stillMonday = getTrainingPlan(course, [], new Date("2026-09-08T02:00:00Z"), 15, "anything", pinned);
  assert.equal(stillMonday.queue.find((item) => item.task.id === "audio").carried, true);
  const tuesday = getTrainingPlan(course, [], new Date("2026-09-08T12:00:00Z"), 15, "anything", pinned);
  assert.ok(!tuesday.queue.some((item) => item.carried));
  assert.ok(tuesday.missed.some((item) => item.task.id === "audio"));
  const done = getTrainingPlan(course, [attempt("audio")], new Date("2026-09-07T12:00:00Z"), 15, "anything", pinned);
  assert.ok(!done.queue.some((item) => item.carried));
  const invalid = getTrainingPlan(course, [], new Date("2026-09-05T12:00:00Z"), 15, "anything", [{ taskId: "run", date: "2026-09-05" }, { taskId: "missing", date: "2026-09-05" }]);
  assert.ok(!invalid.queue.some((item) => item.carried), "unknown and future source tasks cannot be pinned");
});

test("Morse Runner review is always discoverable, including short blocks and pending assignments", () => {
  const course = fixtureCourse();
  const runner = course.assignments[1].tasks[0];
  Object.assign(runner, { title: "Morse Runner", instructions: "Single calls at 10 WPM.", speedWpm: 10 });
  for (const stamp of ["2026-09-05T12:00:00Z", "2026-09-06T12:00:00Z", "2026-09-07T19:45:00Z", "2026-09-07T21:00:00Z", "2026-09-11T12:00:00Z"]) {
    for (const minutes of [3, 5, 10, 15]) for (const mode of ["anything", "computer", "listen", "send"]) {
      const plan = getTrainingPlan(course, [], new Date(stamp), minutes, mode);
      assert.equal(plan.runnerReview.task.id, runner.id);
      assert.equal(plan.runnerReview.extra, true);
      assert.equal(plan.runnerReview.suggestedMinutes, minutes);
      assert.ok(!plan.extras.some((item) => item.task.id === runner.id), "dedicated review doesn't duplicate filtered extras");
      if (plan.phase === "class") assert.equal(plan.next, undefined);
      else if (mode === "listen" || mode === "send") assert.notEqual(plan.next?.task.id, runner.id);
    }
  }
  const now = new Date("2026-09-06T12:00:00Z");
  assert.deepEqual(availableBlockMinutes(course, [], now, "computer"), [3, 5, 10, 15]);
  const short = getTrainingPlan(course, [], now, 3, "computer");
  assert.ok(short.queue.some((item) => item.task.id === runner.id), "required minutes can be practiced in short blocks too");
  const history = [attempt("run", { review: true, activeSeconds: 900 })];
  assert.equal(taskProgress(runner, history).complete, false);
  assert.ok(getTrainingPlan(course, history, now, 15, "computer").runnerReview);
});

test("LCWO is always available at the latest introduced settings without advancing future assignments", () => {
  const course = fixtureCourse();
  const introductory = course.assignments[0].tasks.find((task) => task.kind === "icr");
  Object.assign(introductory, { speedWpm: 15, settings: "Two-character words", resourceId: "lcwo" });
  const advanced = makeTask("advanced-icr", "icr", { speedWpm: 25, settings: "Five-character words", resourceId: "lcwo" });
  course.assignments[4].tasks.push(advanced);
  course.resources.push({ id: "lcwo", title: "LCWO", url: "https://lcwo.net/wordtraining", format: "link" });
  const original = structuredClone(course);
  for (const [stamp, expected] of [
    ["2026-09-04T12:00:00Z", introductory],
    ["2026-09-05T12:00:00Z", introductory],
    ["2026-09-07T19:45:00Z", introductory],
    ["2026-09-07T21:00:00Z", introductory],
    ["2026-09-08T12:00:00Z", introductory],
    ["2026-09-09T12:00:00Z", advanced],
    ["2026-09-11T12:00:00Z", advanced],
  ]) for (const mode of ["anything", "computer", "listen", "send"]) {
    const plan = getTrainingPlan(course, [], new Date(stamp), null, mode);
    const review = plan.lcwoReview;
    assert.equal(review.task, expected, "preserve the original task and all its settings/instructions");
    assert.equal(review.assignment, course.assignments.find((assignment) => assignment.tasks.includes(expected)));
    assert.equal(review.resource, course.resources.at(-1));
    assert.equal(review.extra, true);
    assert.equal(review.suggestedMinutes, 15);
    assert.equal(review.started, false);
    assert.ok(!plan.extras.some((item) => item.task.kind === "icr"), "the dedicated LCWO card replaces rotating LCWO duplicates");
    if (plan.phase === "class") assert.equal(plan.next, undefined);
    if (mode === "listen" || mode === "send") assert.notEqual(plan.next?.task.kind, "icr");
  }
  course.assignments.reverse();
  assert.equal(getTrainingPlan(course, [], new Date("2026-09-04T12:00:00Z"), null).lcwoReview.task, introductory, "introductory selection follows dates, not input order");
  course.assignments.reverse();
  assert.deepEqual(course, original);
});

test("LCWO review adds actual practice time without completing or starting its source assignment", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T22:00:00Z");
  const original = structuredClone(course);
  const review = getTrainingPlan(course, [], now, null).lcwoReview;
  const saved = attempt(review.task.id, { review: review.extra, activeSeconds: 137 });
  const plan = getTrainingPlan(course, [saved, saved], now, null);
  assert.equal(plan.practicedMinutes, 137 / 60);
  assert.equal(plan.queue.find((item) => item.task.id === review.task.id).started, false);
  assert.equal(taskProgress(review.task, [saved]).complete, false);
  assert.equal(plan.lcwoReview.activeSeconds, 0, "each optional block starts fresh");
  const done = attempt(review.task.id, { id: "required-icr", activeSeconds: 180 });
  const completed = getTrainingPlan(course, [saved, done], now, null, "computer");
  assert.ok(!completed.queue.some((item) => item.task.id === review.task.id));
  assert.equal(completed.next, completed.lcwoReview, "LCWO stays available after the required objective is complete");
  assert.deepEqual(course, original);
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

test("unrestricted practice offers long audio and fixed exercises without changing their completion requirements", () => {
  const course = fixtureCourse();
  course.resources[0].durationSeconds = 1_920;
  const now = new Date("2026-09-06T22:00:00Z");
  const history = [attempt("send"), attempt("audio", { completed: false, completedPasses: 0, activeSeconds: 180 })];
  const original = structuredClone({ course, history });
  const plan = getTrainingPlan(course, history, now, null);
  assert.deepEqual(plan.queue.map((item) => item.task.id), ["run", "audio", "icr"]);
  assert.deepEqual(plan.blocked, []);
  const audio = plan.queue.find((item) => item.task.kind === "audio");
  assert.equal(audio.suggestedMinutes, 15);
  assert.equal(audio.passesThisBlock, 1);
  assert.equal(audio.remainingPasses, 2);
  assert.equal(audio.activeSeconds, 180);
  assert.equal(audio.started, true);
  assert.equal(audio.reason, undefined, "a complete recording is not required to begin a practice block");
  assert.equal(taskProgress(audio.task, history).complete, false);
  course.assignments[1].tasks[0].minutes = 25;
  const longerSimulator = getTrainingPlan(course, history, now, null).queue.find((item) => item.task.id === "run");
  assert.equal(longerSimulator.suggestedMinutes, 25, "the fixed exercise retains its assigned duration");
  assert.equal(taskProgress(longerSimulator.task, [attempt("run", { activeSeconds: 900 })]).complete, false);
  course.assignments[1].tasks[0].minutes = 15;
  assert.deepEqual({ course, history }, original);
});

test("unrestricted listening includes playable recordings with unknown duration for required and optional practice", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T22:00:00Z");
  for (const durationSeconds of [undefined, 0, -1, NaN, Infinity]) {
    course.resources[0].durationSeconds = durationSeconds;
    const required = getTrainingPlan(course, [], now, null, "listen");
    assert.equal(required.next.task.id, "audio");
    assert.equal(required.next.suggestedMinutes, 15);
    assert.equal(required.next.passesThisBlock, 1);
    assert.equal(required.blocked.length, 0);
    assert.match(required.next.reason, /partial playback counts/);
    const completed = getTrainingPlan(course, [attempt("audio")], now, null, "listen");
    assert.equal(completed.next.task.id, "audio");
    assert.equal(completed.next.extra, true);
  }
  course.resources[0].durationSeconds = 1_920;
  const review = getTrainingPlan(course, [attempt("audio")], now, null, "listen");
  assert.equal(review.next.extra, true);
  assert.equal(review.next.suggestedMinutes, 15);
});

test("unrestricted practice still blocks unavailable sources and respects live-event windows", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T22:00:00Z");
  for (const resources of [
    [{ ...course.resources[0], unresolved: "Ask the advisor." }],
    [{ ...course.resources[0], format: "link" }],
    [],
  ]) {
    course.resources = resources;
    const required = getTrainingPlan(course, [], now, null, "listen");
    assert.equal(required.next, undefined);
    assert.equal(required.blocked[0].task.id, "audio");
    assert.equal(getTrainingPlan(course, [attempt("audio")], now, null, "listen").extras.length, 0);
  }
  const early = getTrainingPlan(course, [], new Date("2026-09-09T12:30:00Z"), null);
  assert.equal(early.blocked.find((item) => item.task.id === "live").availableNow, false);
  assert.ok(!early.queue.some((item) => item.task.id === "live"));
  const onAir = getTrainingPlan(course, [], new Date("2026-09-09T13:30:00Z"), null);
  assert.equal(onAir.next.task.id, "live");
  assert.equal(onAir.next.availableNow, true);
  const expired = getTrainingPlan(course, [], new Date("2026-09-10T12:00:00Z"), null);
  assert.match(expired.blocked.find((item) => item.task.id === "live").reason, /No CWT window remains/);
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

test("today's matching work comes before earlier started work in every activity mode", () => {
  const course = fixtureCourse();
  course.assignments[2].tasks.push(
    makeTask("today-audio", "audio", { resourceId: "recording", minimumPasses: 2 }),
    makeTask("today-icr", "icr"),
  );
  const history = ["send", "audio", "icr", "run"].map((id) => attempt(id, { completed: false, activeSeconds: 30 }));
  const now = new Date("2026-09-07T12:00:00Z");
  for (const [mode, expected] of [["anything", "send2"], ["send", "send2"], ["listen", "today-audio"], ["computer", "today-icr"]]) {
    const plan = getTrainingPlan(course, history, now, 15, mode);
    assert.equal(plan.next.task.id, expected);
    assert.equal(plan.next.assignment.date, "2026-09-07");
    assert.equal(plan.next.started, false);
    assert.deepEqual(plan.queue.slice(0, 3).map((item) => item.assignment.day), [3, 3, 3]);
    assert.equal(plan.queue.filter((item) => item.assignment.day < 3).length, 4, "earlier preparation stays available");
    assert.equal(plan.queue.find((item) => item.task.id === "audio").started, true);
    assert.equal(plan.queue.find((item) => item.task.id === "audio").activeSeconds, 30);
  }
});

test("started work has priority only within its own assignment date", () => {
  const course = fixtureCourse();
  course.assignments[2].tasks.push(makeTask("today-icr", "icr"));
  const history = [attempt("run", { completed: false }), attempt("today-icr", { completed: false, activeSeconds: 20 })];
  const plan = getTrainingPlan(course, history, new Date("2026-09-07T12:00:00Z"));
  assert.deepEqual(plan.queue.map((item) => item.task.id), ["today-icr", "send2", "send", "audio", "icr", "run"]);
  const oldPartial = attempt("audio", { completed: false, activeSeconds: 20 });
  const withEarlierPartial = getTrainingPlan(course, [...history, oldPartial], new Date("2026-09-07T12:00:00Z"));
  assert.deepEqual(withEarlierPartial.queue.map((item) => item.task.id), ["today-icr", "send2", "audio", "send", "icr", "run"]);
});

test("started means actual required practice rather than an empty, missed, class, or review record", () => {
  const task = makeTask("audio", "audio", { minimumPasses: 3 });
  const empty = attempt("audio", { completed: false, activeSeconds: 0, completedPasses: 0 });
  for (const history of [[], [empty], [{ ...empty, note: "A note without practice" }], [{ ...empty, note: "[Left missed]" }], [attempt("audio", { context: "class" })], [attempt("audio", { review: true, completedPasses: 2 })]]) {
    const progress = taskProgress(task, history);
    assert.equal(progress.started, false);
    assert.equal(progress.interrupted, false);
  }
  for (const history of [
    [{ ...empty, activeSeconds: 0.5 }],
    [{ ...empty, completedPasses: 1 }],
    [{ ...empty, completed: true }],
  ]) assert.equal(taskProgress(task, history).started, true);
  const partial = { ...empty, activeSeconds: 20, completedPasses: 1 };
  const progress = taskProgress(task, [partial, partial]);
  assert.equal(progress.completedPasses, 1);
  assert.equal(progress.activeSeconds, 20);
  assert.equal(progress.started, true);
  assert.equal(progress.interrupted, true);
});

test("a short audio choice needs one full pass, not all remaining repetitions", () => {
  const course = fixtureCourse();
  course.resources[0].durationSeconds = 180;
  course.assignments[0].tasks[1].minimumPasses = 3;
  const now = new Date("2026-09-05T12:00:00Z");
  assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), [3, 5, 10, 15]);
  for (const [minutes, passes] of [[3, 1], [5, 1], [10, 3], [15, 3]]) {
    const plan = getTrainingPlan(course, [], now, minutes, "listen");
    assert.equal(plan.next.task.id, "audio");
    assert.equal(plan.next.remainingPasses, 3);
    assert.equal(plan.next.passesThisBlock, passes);
    assert.equal(plan.next.suggestedMinutes, passes * 3);
  }
  const history = [attempt("audio", { completed: false, completedPasses: 1, activeSeconds: 180 })];
  assert.equal(getTrainingPlan(course, history, now, 10, "listen").next.passesThisBlock, 2);
});

test("short audio membership uses exact measured duration boundaries", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T12:00:00Z");
  for (const [seconds, expected] of [[179.9, [3, 5, 10, 15]], [180, [3, 5, 10, 15]], [180.001, [5, 10, 15]], [300, [5, 10, 15]], [300.001, [10, 15]]]) {
    course.resources[0].durationSeconds = seconds;
    assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), expected);
    for (const minutes of [3, 5]) {
      const plan = getTrainingPlan(course, [], now, minutes, "listen");
      assert.equal(plan.queue.some((item) => item.task.kind === "audio"), seconds <= minutes * 60);
    }
  }
});

test("time choices depend on the selected activity, not unrelated fitting work", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T12:00:00Z");
  assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), [10, 15]);
  for (const mode of ["anything", "send", "computer"]) assert.deepEqual(availableBlockMinutes(course, [], now, mode), [3, 5, 10, 15]);
  const simulatorOnly = { ...course, assignments: course.assignments.map((assignment) => ({ ...assignment, tasks: assignment.tasks.filter((task) => task.kind === "simulator") })) };
  const simulatorDate = new Date("2026-09-06T12:00:00Z");
  assert.deepEqual(availableBlockMinutes(simulatorOnly, [], simulatorDate, "computer"), [10, 15]);
  for (const minutes of [3, 5, 10]) {
    const plan = getTrainingPlan(simulatorOnly, [], simulatorDate, minutes, "computer");
    assert.equal(plan.next, undefined);
    assert.equal(plan.blocked[0].suggestedMinutes, 15);
  }
  assert.equal(getTrainingPlan(simulatorOnly, [], simulatorDate, 15, "computer").next.task.id, "run");
});

test("unknown, unresolved, or missing audio cannot justify a short time choice", () => {
  const course = fixtureCourse();
  const now = new Date("2026-09-05T12:00:00Z");
  for (const durationSeconds of [undefined, 0, -1, NaN, Infinity]) {
    course.resources[0].durationSeconds = durationSeconds;
    assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), [10, 15]);
    for (const minutes of [3, 5]) {
      const plan = getTrainingPlan(course, [], now, minutes, "listen");
      assert.equal(plan.next, undefined);
      assert.match(plan.blocked.find((item) => item.task.id === "audio").reason, /not yet measured/);
    }
  }
  course.resources[0].durationSeconds = 120;
  course.resources[0].unresolved = "Ask the instructor about this source.";
  assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), [10, 15]);
  course.resources = [];
  assert.deepEqual(availableBlockMinutes(course, [], now, "listen"), [10, 15]);
});

test("short choices can come from completed-material review without advancing future work", () => {
  const course = fixtureCourse();
  course.resources[0].durationSeconds = 180;
  const now = new Date("2026-09-05T12:00:00Z");
  const history = [attempt("audio")];
  assert.deepEqual(availableBlockMinutes(course, history, now, "listen"), [3, 5, 10, 15]);
  assert.equal(getTrainingPlan(course, history, now, 3, "listen").next.extra, true);
  assert.deepEqual(availableBlockMinutes(course, history, new Date("2026-09-07T19:45:00Z"), "listen"), [10, 15], "class does not advertise short independent practice");
  assert.deepEqual(availableBlockMinutes(course, [], new Date("2026-09-04T12:00:00Z"), "listen"), [10, 15], "tomorrow's recording is not eligible today");
  assert.deepEqual(availableBlockMinutes(course, history, new Date("2026-09-07T21:00:00Z"), "listen"), [3, 5, 10, 15], "post-class review can still be short");
});

test("short time choices preserve eligible live-event windows", () => {
  const course = fixtureCourse();
  course.assignments = course.assignments.map((assignment) => ({ ...assignment, tasks: assignment.tasks.filter((task) => task.kind === "live") }));
  assert.deepEqual(availableBlockMinutes(course, [], new Date("2026-09-09T12:30:00Z"), "anything"), [10, 15]);
  assert.deepEqual(availableBlockMinutes(course, [], new Date("2026-09-09T13:30:00Z"), "anything"), [3, 5, 10, 15]);
  assert.deepEqual(availableBlockMinutes(course, [], new Date("2026-09-09T13:30:00Z"), "listen"), [10, 15]);
});

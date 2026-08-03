import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPublishedNoteAt,
  isScheduledNoteAt,
  nextScheduledPublicationAt,
} from "../src/lib/note-publication.ts";
import { notePublicationState } from "../scripts/note-frontmatter.mjs";
import { shouldTriggerPublicationBuild } from "../worker/index.ts";

const now = new Date("2026-08-03T16:00:00.000Z");
const scheduledNote = {
  data: {
    visibility: "public",
    publishAt: new Date("2026-08-03T17:00:00.000Z"),
  },
};

test("future public notes remain scheduled until publishAt", () => {
  assert.equal(isScheduledNoteAt(scheduledNote, now), true);
  assert.equal(isPublishedNoteAt(scheduledNote, now), false);
  assert.equal(
    isPublishedNoteAt(
      scheduledNote,
      new Date("2026-08-03T17:00:00.000Z"),
    ),
    true,
  );
});

test("drafts and unlisted notes never auto-publish", () => {
  for (const visibility of ["draft", "unlisted"]) {
    const note = {
      data: {
        visibility,
        publishAt: new Date("2026-08-03T15:00:00.000Z"),
      },
    };

    assert.equal(isScheduledNoteAt(note, now), false);
    assert.equal(isPublishedNoteAt(note, now), false);
  }
});

test("publication manifest selects the earliest future public note", () => {
  const laterNote = {
    data: {
      visibility: "public",
      publishAt: new Date("2026-08-04T12:00:00.000Z"),
    },
  };
  const draft = {
    data: {
      visibility: "draft",
      publishAt: new Date("2026-08-03T16:30:00.000Z"),
    },
  };

  assert.equal(
    nextScheduledPublicationAt(
      [laterNote, draft, scheduledNote],
      now,
    )?.toISOString(),
    "2026-08-03T17:00:00.000Z",
  );
});

test("raw frontmatter uses the same scheduled boundary", () => {
  const markdown = `---
title: Scheduled note
date: 2026-08-03
publishAt: "2026-08-03T13:00:00-04:00"
summary: A scheduled note.
---`;

  assert.equal(notePublicationState(markdown, now), "scheduled");
  assert.equal(
    notePublicationState(markdown, new Date("2026-08-03T17:00:00.000Z")),
    "public",
  );
});

test("Worker triggers a build only when the manifest is due", () => {
  const schedule = {
    version: 1,
    generatedAt: now.toISOString(),
    nextPublishAt: "2026-08-03T17:00:00.000Z",
  };

  assert.equal(
    shouldTriggerPublicationBuild(
      schedule,
      new Date("2026-08-03T16:59:59Z").valueOf(),
    ),
    false,
  );
  assert.equal(
    shouldTriggerPublicationBuild(
      schedule,
      new Date("2026-08-03T17:00:00Z").valueOf(),
    ),
    true,
  );
  assert.equal(
    shouldTriggerPublicationBuild(
      { ...schedule, nextPublishAt: null },
      now.valueOf(),
    ),
    false,
  );
});

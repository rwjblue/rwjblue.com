-- LCWO exports provide measurements, not practice durations or assignment credit.
CREATE TABLE training_lcwo_results (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id, id)
);

CREATE TABLE training_lcwo_sync (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  synced_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id)
);

-- Report drafts and submitted snapshots are private, immutable revisions.
CREATE TABLE training_reports (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id, id)
);

-- Identical retries succeed; changing any saved revision requires a new ID.
CREATE TRIGGER training_reports_immutable
BEFORE UPDATE OF payload ON training_reports
WHEN OLD.payload != NEW.payload
BEGIN
  SELECT RAISE(ABORT, 'training_immutable_conflict');
END;

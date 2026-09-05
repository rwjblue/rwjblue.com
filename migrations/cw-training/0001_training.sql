-- Private curriculum is loaded separately; never include it in this migration.
CREATE TABLE training_courses (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK (json_valid(payload))
);

CREATE TABLE training_attempts (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id, id)
);

CREATE TABLE training_materials (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id, id)
);

-- Retries may repeat an ID, but may never rewrite an earlier attempt/revision.
CREATE TRIGGER training_attempts_immutable
BEFORE UPDATE OF payload ON training_attempts
WHEN OLD.payload != NEW.payload
BEGIN
  SELECT RAISE(ABORT, 'training_immutable_conflict');
END;

CREATE TRIGGER training_materials_immutable
BEFORE UPDATE OF payload ON training_materials
WHEN OLD.payload != NEW.payload
BEGIN
  SELECT RAISE(ABORT, 'training_immutable_conflict');
END;

CREATE TABLE training_preferences (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id)
);

CREATE TABLE training_calendar_tokens (
  owner_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES training_courses(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, course_id)
);

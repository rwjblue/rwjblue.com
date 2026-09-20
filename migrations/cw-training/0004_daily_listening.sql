-- A bounded, curated instructor recording, never a public static asset.
CREATE TABLE training_audio (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL CHECK (length(payload) <= 20000),
  audio_base64 TEXT NOT NULL CHECK (length(audio_base64) <= 700000)
);

-- Small SQL chunks keep imports below D1's per-statement limit.
CREATE TABLE training_audio_imports (
  import_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (import_id, part)
);

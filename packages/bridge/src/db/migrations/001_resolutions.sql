-- 001: the resolutions table (AR27). Created one story ahead of its first writer (Story 1.6).
CREATE TABLE resolutions (
  pjid TEXT PRIMARY KEY,
  generation INTEGER NOT NULL,
  record_hash TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  clone_path TEXT,
  board_id TEXT
);

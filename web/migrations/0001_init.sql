-- LMS Studio accounts and license keys
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- One key activates the app for one account; expires_at is set on activation
-- from duration_days (0 = never expires) unless the admin fixed a date.
CREATE TABLE licenses (
  key TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  max_devices INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  activated_at INTEGER,
  expires_at INTEGER
);
CREATE INDEX licenses_user ON licenses(user_id);

CREATE TABLE devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL REFERENCES licenses(key) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  UNIQUE (license_key, device_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Failed sign-ins per username, to slow down password guessing
CREATE TABLE login_failures (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  count INTEGER NOT NULL,
  first_at INTEGER NOT NULL
);

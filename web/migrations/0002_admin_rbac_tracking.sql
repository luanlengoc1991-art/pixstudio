-- Upgrade LMS Studio auth DB: 4-tier RBAC, full session/device/usage time tracking,
-- audit activity logs, and query performance indexes.
-- Note: snapshot licenses.user_id and sessions before rebuilding users so ON DELETE
-- triggers can never drop or null existing links even when D1 keeps foreign_keys ON.
PRAGMA defer_foreign_keys = ON;

CREATE TABLE _mig_licenses_uid (
  key TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL
);
INSERT INTO _mig_licenses_uid (key, user_id)
SELECT key, user_id FROM licenses WHERE user_id IS NOT NULL;

CREATE TABLE _mig_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
INSERT INTO _mig_sessions (token_hash, user_id, device_id, created_at, expires_at)
SELECT token_hash, user_id, device_id, created_at, expires_at FROM sessions;

-- 1. Rebuild users table to expand role CHECK constraint to 4 tiers and add tracking columns
CREATE TABLE users_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'staff', 'admin', 'super_admin')),
  display_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  last_login_at INTEGER,
  last_active_at INTEGER,
  last_ip TEXT NOT NULL DEFAULT '',
  last_device TEXT NOT NULL DEFAULT '',
  last_tool TEXT NOT NULL DEFAULT '',
  login_count INTEGER NOT NULL DEFAULT 0,
  total_active_seconds INTEGER NOT NULL DEFAULT 0
);

INSERT INTO users_v2 (
  id, username, pass_hash, role, display_name, note, disabled,
  created_at, updated_at, last_login_at, last_active_at, login_count
)
SELECT
  id,
  username,
  pass_hash,
  CASE WHEN role = 'admin' THEN 'super_admin' ELSE 'user' END,
  display_name,
  note,
  disabled,
  created_at,
  created_at,
  last_login_at,
  last_login_at,
  CASE WHEN last_login_at IS NOT NULL THEN 1 ELSE 0 END
FROM users;

DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;

-- Restore any license links or active sessions touched by ON DELETE actions during DROP TABLE users
UPDATE licenses
   SET user_id = (SELECT m.user_id FROM _mig_licenses_uid m WHERE m.key = licenses.key)
 WHERE key IN (SELECT key FROM _mig_licenses_uid);

INSERT OR IGNORE INTO sessions (token_hash, user_id, device_id, created_at, expires_at)
SELECT token_hash, user_id, device_id, created_at, expires_at FROM _mig_sessions;

DROP TABLE _mig_licenses_uid;
DROP TABLE _mig_sessions;

-- 2. Extend devices with user ownership, platform, app version, IP and usage time
ALTER TABLE devices ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE devices ADD COLUMN platform TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN app_version TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN last_ip TEXT NOT NULL DEFAULT '';
ALTER TABLE devices ADD COLUMN total_active_seconds INTEGER NOT NULL DEFAULT 0;

UPDATE devices
   SET user_id = (SELECT l.user_id FROM licenses l WHERE l.key = devices.license_key)
 WHERE user_id IS NULL;

-- 3. Extend sessions with full live tracking metadata
ALTER TABLE sessions ADD COLUMN device_name TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN platform TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN app_version TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN ip TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN user_agent TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN active_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN current_tool TEXT NOT NULL DEFAULT '';

UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at = 0;

-- 4. Daily active usage aggregation per account (UTC+7 day key YYYY-MM-DD)
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- 5. System & account audit log
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  actor_id INTEGER,
  actor_username TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT ''
);

-- 6. Performance indexes for fast admin dashboard & heartbeat queries
CREATE INDEX IF NOT EXISTS licenses_status_exp ON licenses(status, expires_at);
CREATE INDEX IF NOT EXISTS devices_last_seen ON devices(last_seen DESC);
CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS sessions_last_seen ON sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS daily_usage_day ON daily_usage(day);
CREATE INDEX IF NOT EXISTS activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_actor ON activity_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_target ON activity_logs(target_type, target_id, created_at DESC);

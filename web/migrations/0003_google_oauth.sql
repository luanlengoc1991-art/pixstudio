-- Add Google OAuth linking fields to users and temporary PKCE/ticket state table.
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';

-- Backfill email for any existing account whose username is already an email address
UPDATE users
   SET email = LOWER(TRIM(username))
 WHERE username LIKE '%@%.%'
   AND (email IS NULL OR email = '');

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq
  ON users(LOWER(email))
  WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uniq
  ON users(google_sub)
  WHERE google_sub IS NOT NULL AND google_sub != '';

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  verifier TEXT NOT NULL DEFAULT '',
  nonce TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_states_exp ON oauth_states(expires_at);

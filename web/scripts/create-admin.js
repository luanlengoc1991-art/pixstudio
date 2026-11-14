// Creates (or resets) an admin account in the LMS D1 database.
//   node web/scripts/create-admin.js <username> <password> [--local]
// Same PBKDF2 format as web/functions/api/[[path]].ts.
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const [username, password, flag] = process.argv.slice(2);
if (!username || !password || password.length < 6 || !/^[A-Za-z0-9._@-]{3,64}$/.test(username)) {
  console.error("Usage: node web/scripts/create-admin.js <username> <password ≥ 6> [--local]");
  process.exit(1);
}
const iterations = 100000;
const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
const passHash = `pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`;
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const sql =
  `INSERT INTO users (username, pass_hash, role, display_name, created_at) VALUES (${q(username)}, ${q(passHash)}, 'admin', ${q(username)}, ${Date.now()}) ` +
  `ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash, role = 'admin', disabled = 0;`;
const file = path.join(os.tmpdir(), `lms-admin-${process.pid}.sql`);
fs.writeFileSync(file, sql);
try {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler@4", "d1", "execute", "lms-auth", flag === "--local" ? "--local" : "--remote", "--file", file],
    { cwd: path.join(__dirname, ".."), stdio: "inherit", shell: process.platform === "win32" },
  );
  console.log(`Admin "${username}" is ready.`);
} finally {
  fs.rmSync(file, { force: true });
}

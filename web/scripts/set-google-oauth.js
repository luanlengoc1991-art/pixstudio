// Uploads Google OAuth credentials as encrypted Cloudflare Pages secrets for "lms-studio".
// Usage:
//   node web/scripts/set-google-oauth.js <path-to-client_secret.json> [--desktop]
//   node web/scripts/set-google-oauth.js <client_id> <client_secret> [--desktop]
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const desktopOnly = args.includes("--desktop");
const positional = args.filter((a) => a !== "--desktop");

let clientId = "";
let clientSecret = "";

if (positional.length === 1 && fs.existsSync(positional[0])) {
  const raw = JSON.parse(fs.readFileSync(positional[0], "utf8"));
  const block = raw.web || raw.installed || raw;
  clientId = String(block.client_id || block.clientId || "").trim();
  clientSecret = String(block.client_secret || block.clientSecret || "").trim();
} else if (positional.length === 2) {
  clientId = positional[0].trim();
  clientSecret = positional[1].trim();
} else {
  console.error("Usage:");
  console.error("  node web/scripts/set-google-oauth.js <client_secret.json> [--desktop]");
  console.error("  node web/scripts/set-google-oauth.js <client_id> <client_secret> [--desktop]");
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.error("Missing client_id or client_secret.");
  process.exit(1);
}

const idName = desktopOnly ? "GOOGLE_DESKTOP_CLIENT_ID" : "GOOGLE_CLIENT_ID";
const secretName = desktopOnly ? "GOOGLE_DESKTOP_CLIENT_SECRET" : "GOOGLE_CLIENT_SECRET";

function putSecret(name, value) {
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler@4", "pages", "secret", "put", name, "--project-name", "lms-studio"],
    {
      cwd: path.join(__dirname, ".."),
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    },
  );
}

putSecret(idName, clientId);
putSecret(secretName, clientSecret);
console.log(`Configured ${idName} and ${secretName} on Cloudflare Pages project "lms-studio".`);

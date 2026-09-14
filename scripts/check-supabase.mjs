import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const candidates = [
  resolve(root, "apps/web/.env.local"),
  resolve(root, "apps/web/.env.example"),
  resolve(root, ".env.local"),
];

function parseEnv(filePath) {
  const env = {};
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

const source = candidates.find((file) => existsSync(file));
if (!source) {
  console.log("result=missing_env_file");
  process.exit(1);
}

const env = parseEnv(source);
const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log(`env_file=${source.endsWith(".env.local") ? ".env.local" : ".env.example"}`);
console.log(`url_configured=${Boolean(url)}`);
console.log(`anon_configured=${anon.split(".").length === 3}`);
console.log(`service_role_configured=${serviceRole.split(".").length === 3}`);

if (!url || anon.split(".").length !== 3) {
  console.log("result=env_incomplete");
  process.exit(1);
}

const headers = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
};

try {
  const health = await fetch(`${url}/auth/v1/health`);
  console.log(`auth_health_ok=${health.ok}`);
  console.log(`auth_health_status=${health.status}`);

  const shows = await fetch(`${url}/rest/v1/shows?select=slug&limit=5`, {
    headers,
  });
  console.log(`shows_http=${shows.status}`);

  if (shows.status === 401 || shows.status === 403) {
    console.log("result=auth_failed");
    process.exit(1);
  }

  if (shows.status === 404) {
    console.log("result=connected_schema_missing");
    process.exit(0);
  }

  if (!shows.ok) {
    console.log("result=connected_query_failed");
    process.exit(1);
  }

  const rows = await shows.json();
  const slugs = Array.isArray(rows) ? rows.map((row) => row.slug).filter(Boolean) : [];
  console.log(`shows_rows=${Array.isArray(rows) ? rows.length : "n/a"}`);
  console.log(`tbbt_seeded=${slugs.includes("tbbt")}`);
  console.log("result=connected");
} catch (error) {
  console.log("result=network_error");
  console.log(`error_name=${error instanceof Error ? error.name : "unknown"}`);
  process.exit(1);
}

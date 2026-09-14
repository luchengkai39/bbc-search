import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "../apps/web/.env.local");
if (!existsSync(envPath)) {
  console.log("result=missing_env");
  process.exit(1);
}

const env = {};
for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const headers = {
  apikey: anon,
  Authorization: `Bearer ${anon}`,
  Accept: "application/json",
};

const cues = await fetch(
  `${url}/rest/v1/cues?select=text_en,text_zh,media_status,clip_duration_ms&media_status=eq.ready&order=start_ms.asc&limit=8`,
  { headers },
);
console.log(`cues_http=${cues.status}`);
const rows = await cues.json();
console.log(`ready_preview=${Array.isArray(rows) ? rows.length : 0}`);
if (Array.isArray(rows)) {
  for (const row of rows) {
    console.log(`ready ${row.media_status} ${row.clip_duration_ms}ms EN=${String(row.text_en).slice(0, 48)}`);
  }
}

const count = await fetch(`${url}/rest/v1/cues?select=id&media_status=eq.ready`, {
  headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
});
console.log(`ready_count_header=${count.headers.get("content-range")}`);

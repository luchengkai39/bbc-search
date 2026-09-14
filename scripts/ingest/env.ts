import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

function parseEnvFile(filePath: string) {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

function mergedEnv() {
  return {
    ...parseEnvFile(resolve(root, "apps/web/.env.local")),
    ...parseEnvFile(resolve(root, "scripts/.env")),
  };
}

export function loadIngestEnv() {
  const merged = mergedEnv();
  const url = (merged.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRole = merged.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || serviceRole.split(".").length !== 3) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local or scripts/.env",
    );
  }
  return { root, url, serviceRole };
}

export function loadR2Env() {
  const merged = mergedEnv();
  const accountId = merged.R2_ACCOUNT_ID || "";
  const accessKeyId = merged.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = merged.R2_SECRET_ACCESS_KEY || "";
  const bucket = merged.R2_BUCKET || "bigboom";
  const endpoint = merged.R2_ENDPOINT || "";
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in scripts/.env",
    );
  }
  return { root, accountId, accessKeyId, secretAccessKey, bucket, endpoint: endpoint || undefined };
}

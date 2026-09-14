import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AlignedCue } from "./types";

const CACHE = "31536000";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAdminClient(url: string, serviceRole: string) {
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function withRetry<T>(label: string, fn: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await sleep(500 * attempt);
    }
  }
  throw new Error(`${label} failed after 3 tries: ${String(lastError)}`);
}

export async function uploadObject(
  supabase: SupabaseClient,
  bucket: "thumbs" | "clips" | "cards",
  key: string,
  filePath: string,
  contentType: string,
) {
  const body = await readFile(filePath);
  await withRetry(`upload ${bucket}/${key}`, async () => {
    const { error } = await supabase.storage.from(bucket).upload(key, body, {
      upsert: true,
      contentType,
      cacheControl: CACHE,
    });
    if (error) throw error;
  });
}

export async function ensureShow(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("shows")
    .select("id")
    .eq("slug", "tbbt")
    .single();
  if (error || !data) throw new Error("tbbt show row missing. Run db:push first.");
  return data.id as string;
}

export async function upsertEpisode(
  supabase: SupabaseClient,
  showId: string,
  season: number,
  episode: number,
  sourceLabel: string,
  durationMs: number | null,
) {
  const { data: existing } = await supabase
    .from("episodes")
    .select("id")
    .eq("show_id", showId)
    .eq("season", season)
    .eq("episode", episode)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("episodes")
      .update({ source_label: sourceLabel, duration_ms: durationMs })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("episodes")
    .insert({
      show_id: showId,
      season,
      episode,
      title_en: "",
      title_zh: "",
      source_label: sourceLabel,
      duration_ms: durationMs,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "episode insert failed");
  return data.id as string;
}

export async function findCue(
  supabase: SupabaseClient,
  episodeId: string,
  cue: AlignedCue,
) {
  const { data, error } = await supabase
    .from("cues")
    .select("id, media_status, thumb_key, clip_key")
    .eq("episode_id", episodeId)
    .eq("start_ms", cue.startMs)
    .eq("end_ms", cue.endMs)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertCue(
  supabase: SupabaseClient,
  args: {
    id: string;
    episodeId: string;
    cue: AlignedCue;
    thumbKey: string;
    clipKey: string | null;
    clipDurationMs: number | null;
    mediaStatus: "pending" | "ready" | "failed";
  },
) {
  const row = {
    id: args.id,
    episode_id: args.episodeId,
    start_ms: args.cue.startMs,
    end_ms: args.cue.endMs,
    text_en: args.cue.textEn,
    text_zh: args.cue.textZh,
    align_status: args.cue.alignStatus,
    thumb_key: args.thumbKey,
    clip_key: args.clipKey,
    clip_duration_ms: args.clipDurationMs,
    media_status: args.mediaStatus,
  };

  const { error } = await supabase.from("cues").upsert(row, {
    onConflict: "episode_id,start_ms,end_ms",
  });
  if (error) throw error;
}

export function storageKey(
  season: number,
  episode: number,
  cueId: string,
  ext: "jpg" | "mp4",
) {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `tbbt/s${s}/e${e}/${cueId}.${ext}`;
}

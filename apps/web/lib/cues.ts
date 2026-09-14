import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedOne } from "@/lib/supabase/embed";
import { shuffle, type ClipCardData } from "@/lib/clips";
import { signStorageUrls } from "@/lib/storage";

export type CuePlayable = ClipCardData & {
  startMs: number;
  endMs: number;
  clipUrl: string | null;
};

export type CueDetail = CuePlayable & {
  context: ClipCardData[];
  related: ClipCardData[];
};

export type EpisodeEmbed = {
  season: number;
  episode: number;
  title_en: string | null;
};

export type CueRow = {
  id: string;
  episode_id: string;
  start_ms: number;
  end_ms: number;
  text_en: string | null;
  text_zh: string | null;
  thumb_key: string | null;
  clip_key: string | null;
  clip_duration_ms: number | null;
  media_status: string;
  episodes: EpisodeEmbed | null;
};

type CueQueryRow = Omit<CueRow, "episodes"> & {
  episodes: EpisodeEmbed | EpisodeEmbed[] | null;
};

function toCueRow(row: CueQueryRow): CueRow {
  return { ...row, episodes: embedOne(row.episodes) };
}

function toCard(
  row: CueRow,
  thumbs: Map<string, string>,
): ClipCardData {
  return {
    id: row.id,
    textEn: row.text_en ?? "",
    textZh: row.text_zh ?? "",
    season: row.episodes?.season ?? 1,
    episode: row.episodes?.episode ?? 1,
    episodeTitleEn: row.episodes?.title_en ?? "",
    clipDurationMs: row.clip_duration_ms,
    thumbUrl: row.thumb_key ? thumbs.get(row.thumb_key) ?? null : null,
  };
}

const CUE_SELECT =
  "id, episode_id, start_ms, end_ms, text_en, text_zh, thumb_key, clip_key, clip_duration_ms, media_status, episodes!inner(season, episode, title_en)";

export const getReadyCueRow = cache(async (id: string): Promise<CueRow | null> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cues")
    .select(CUE_SELECT)
    .eq("id", id)
    .eq("media_status", "ready")
    .maybeSingle();
  if (error) throw error;
  return data ? toCueRow(data) : null;
});

export function cueCardKey(row: Pick<CueRow, "id" | "thumb_key" | "episodes">) {
  if (row.thumb_key?.endsWith(".jpg")) return row.thumb_key.replace(/\.jpg$/i, ".png");
  const season = row.episodes?.season ?? 1;
  const episode = row.episodes?.episode ?? 1;
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `tbbt/s${s}/e${e}/${row.id}.png`;
}

export const getCuePlayable = cache(async (id: string): Promise<CuePlayable | null> => {
  const cue = await getReadyCueRow(id);
  if (!cue) return null;
  const thumbKeys = cue.thumb_key ? [cue.thumb_key] : [];
  const thumbs = await signStorageUrls("thumbs", thumbKeys);
  const clips = cue.clip_key
    ? await signStorageUrls("clips", [cue.clip_key])
    : new Map<string, string>();
  return {
    ...toCard(cue, thumbs),
    startMs: cue.start_ms,
    endMs: cue.end_ms,
    clipUrl: cue.clip_key ? clips.get(cue.clip_key) ?? null : null,
  };
});

export const getCueDetail = cache(async (id: string): Promise<CueDetail | null> => {
  const cue = await getReadyCueRow(id);
  if (!cue) return null;
  const admin = createAdminClient();

  const { data: prev } = await admin
    .from("cues")
    .select(
      "id, episode_id, start_ms, end_ms, text_en, text_zh, thumb_key, clip_key, clip_duration_ms, media_status, episodes!inner(season, episode, title_en)",
    )
    .eq("episode_id", cue.episode_id)
    .eq("media_status", "ready")
    .lt("start_ms", cue.start_ms)
    .order("start_ms", { ascending: false })
    .limit(2);

  const { data: next } = await admin
    .from("cues")
    .select(
      "id, episode_id, start_ms, end_ms, text_en, text_zh, thumb_key, clip_key, clip_duration_ms, media_status, episodes!inner(season, episode, title_en)",
    )
    .eq("episode_id", cue.episode_id)
    .eq("media_status", "ready")
    .gt("start_ms", cue.start_ms)
    .order("start_ms", { ascending: true })
    .limit(2);

  const { data: siblings } = await admin
    .from("cues")
    .select(
      "id, episode_id, start_ms, end_ms, text_en, text_zh, thumb_key, clip_key, clip_duration_ms, media_status, episodes!inner(season, episode, title_en)",
    )
    .eq("episode_id", cue.episode_id)
    .eq("media_status", "ready")
    .neq("id", cue.id)
    .limit(40);

  const contextRows = [
    ...(prev ?? []).map(toCueRow).reverse(),
    ...(next ?? []).map(toCueRow),
  ];
  const relatedRows = shuffle((siblings ?? []).map(toCueRow)).slice(0, 8);
  const thumbKeys = [cue, ...contextRows, ...relatedRows]
    .map((row) => row.thumb_key)
    .filter((key): key is string => Boolean(key));
  const thumbs = await signStorageUrls("thumbs", thumbKeys);
  const clips = cue.clip_key
    ? await signStorageUrls("clips", [cue.clip_key])
    : new Map<string, string>();

  const card = toCard(cue, thumbs);
  return {
    ...card,
    startMs: cue.start_ms,
    endMs: cue.end_ms,
    clipUrl: cue.clip_key ? clips.get(cue.clip_key) ?? null : null,
    context: contextRows.map((row) => toCard(row, thumbs)),
    related: relatedRows.map((row) => toCard(row, thumbs)),
  };
});

import { shuffle, type ClipCardData } from "@/lib/clips";
import { signStorageUrls } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedOne } from "@/lib/supabase/embed";

type SearchRow = {
  id: string;
  text_en: string | null;
  text_zh: string | null;
  thumb_key: string | null;
  clip_duration_ms: number | null;
  season: number;
  episode: number;
  episode_title_en?: string | null;
};

async function signThumbs(rows: SearchRow[]): Promise<ClipCardData[]> {
  const keys = rows
    .map((row) => row.thumb_key)
    .filter((key): key is string => Boolean(key));
  const signed = await signStorageUrls("thumbs", keys);

  return rows.map((row) => ({
    id: row.id,
    textEn: row.text_en ?? "",
    textZh: row.text_zh ?? "",
    season: row.season,
    episode: row.episode,
    episodeTitleEn: row.episode_title_en ?? "",
    clipDurationMs: row.clip_duration_ms,
    thumbUrl: row.thumb_key ? signed.get(row.thumb_key) ?? null : null,
  }));
}

export async function searchClips(query: string, season: number): Promise<ClipCardData[]> {
  const admin = createAdminClient();
  const trimmed = query.trim();

  if (!trimmed) {
    const { data, error } = await admin
      .from("cues")
      .select(
        "id, text_en, text_zh, thumb_key, clip_duration_ms, episodes!inner(season, episode, title_en)",
      )
      .eq("media_status", "ready")
      .eq("episodes.season", season)
      .limit(80);

    if (error) throw error;
    const rows: SearchRow[] = (data ?? []).map((row) => {
      const episode = embedOne(row.episodes);
      return {
        id: row.id,
        text_en: row.text_en,
        text_zh: row.text_zh,
        thumb_key: row.thumb_key,
        clip_duration_ms: row.clip_duration_ms,
        season: episode?.season ?? season,
        episode: episode?.episode ?? 1,
        episode_title_en: episode?.title_en ?? "",
      };
    });
    return signThumbs(shuffle(rows).slice(0, 9));
  }

  const { data, error } = await admin.rpc("search_cues", {
    q: trimmed,
    p_season: season,
  });
  if (error) throw error;
  return signThumbs(
    (data ?? []).map((row: SearchRow) => ({
      id: row.id,
      text_en: row.text_en,
      text_zh: row.text_zh,
      thumb_key: row.thumb_key,
      clip_duration_ms: row.clip_duration_ms,
      season: row.season,
      episode: row.episode,
      episode_title_en: row.episode_title_en,
    })),
  );
}

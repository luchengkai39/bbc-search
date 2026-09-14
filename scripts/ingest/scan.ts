import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { EpisodeRef } from "./types";

const CODE = /^TBBT_S(\d{2})E(\d{2})$/i;

export function parseEpisodeCode(code: string) {
  const match = code.trim().toUpperCase().match(/^S?(\d{1,2})E(\d{1,2})$/)
    ?? code.trim().toUpperCase().match(/^TBBT_S(\d{2})E(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid episode code: ${code}. Use S01E01`);
  }
  const season = Number(match[1]);
  const episode = Number(match[2]);
  return {
    season,
    episode,
    code: `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
  };
}

export function scanEpisodes(
  root: string,
  season: number | null,
  episodeCode: string | null,
): EpisodeRef[] {
  const videoDir = join(root, "data/raw/video");
  const subDir = join(root, "data/raw/subs");
  if (!existsSync(videoDir) || !existsSync(subDir)) {
    throw new Error("Missing data/raw/video or data/raw/subs");
  }

  const wanted = episodeCode ? [parseEpisodeCode(episodeCode)] : null;
  const videos = readdirSync(videoDir).filter((name) => name.toLowerCase().endsWith(".mp4"));
  const found: EpisodeRef[] = [];

  for (const file of videos) {
    const stem = file.replace(/\.mp4$/i, "");
    const parsed = stem.toUpperCase().match(CODE);
    if (!parsed) {
      console.warn(`skip unmatched video filename: ${file}`);
      continue;
    }
    const seasonNum = Number(parsed[1]);
    const episodeNum = Number(parsed[2]);
    const code = `S${parsed[1]}E${parsed[2]}`;
    if (wanted && (wanted[0].season !== seasonNum || wanted[0].episode !== episodeNum)) continue;
    if (season != null && !wanted && seasonNum !== season) continue;

    const sourceLabel = `${stem}.mp4`;
    const enSrtPath = join(subDir, `${stem}.en.srt`);
    const zhSrtPath = join(subDir, `${stem}.zh.srt`);
    const videoPath = join(videoDir, file);
    if (!existsSync(enSrtPath) || !existsSync(zhSrtPath)) {
      console.warn(`skip ${code}: missing ${stem}.en.srt or ${stem}.zh.srt`);
      continue;
    }
    found.push({
      code,
      season: seasonNum,
      episode: episodeNum,
      stem,
      sourceLabel,
      videoKey: `raw/video/${file}`,
      enSrtKey: `raw/subs/${stem}.en.srt`,
      zhSrtKey: `raw/subs/${stem}.zh.srt`,
      videoPath,
      enSrtPath,
      zhSrtPath,
    });
  }

  found.sort((a, b) => a.season - b.season || a.episode - b.episode);
  if (wanted && found.length === 0) {
    throw new Error(`No complete file set for ${wanted[0].code} in data/raw`);
  }
  return found;
}

import { mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { alignTracks, cleanTrack, clipWindow } from "./align";
import { cutClip, cutThumb, probeDurationMs } from "./cut";
import { loadIngestEnv, loadR2Env } from "./env";
import { formatTimestamp, parseSrt } from "./parseSrt";
import { createR2, downloadRawFile, scanR2Episodes, uploadRawFile } from "./r2";
import { parseEpisodeCode, scanEpisodes } from "./scan";
import {
  createAdminClient,
  ensureShow,
  findCue,
  storageKey,
  upsertCue,
  upsertEpisode,
  uploadObject,
} from "./upload";
import type { AlignedCue, EpisodeRef, IngestOptions } from "./types";

function parseArgs(argv: string[]): IngestOptions {
  const options: IngestOptions = {
    dryRun: false,
    thumbsOnly: false,
    force: false,
    pushRaw: false,
    fromLocal: false,
    limit: null,
    skipHeadMs: 0,
    skipTailMs: 25_000,
    season: null,
    episodeCode: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--thumbs-only") options.thumbsOnly = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--push-raw") options.pushRaw = true;
    else if (arg === "--from-local") options.fromLocal = true;
    else if (arg === "--episode" && next) {
      options.episodeCode = parseEpisodeCode(next).code;
      i += 1;
    } else if (arg === "--season" && next) {
      options.season = Number(next);
      i += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number(next);
      i += 1;
    } else if (arg === "--skip-head-ms" && next) {
      options.skipHeadMs = Number(next);
      i += 1;
    } else if (arg === "--skip-tail-ms" && next) {
      options.skipTailMs = Number(next);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log(`Bigboom ingest

Raw MP4/SRT live in private R2 (raw/video, raw/subs).
ffmpeg still runs on this machine using a temporary download in data/work.

Usage:
  pnpm ingest -- --push-raw --episode S01E01
  pnpm ingest -- --episode S01E01 --dry-run
  pnpm ingest -- --episode S01E01 --limit 5
  pnpm ingest -- --episode S01E01

Source episodes stay private on R2. Derived clips stay 4 seconds max.
`);
}

function applyWindow(cues: AlignedCue[], skipHeadMs: number, skipTailMs: number, durationMs: number | null) {
  const endLimit = durationMs != null ? durationMs - skipTailMs : Number.POSITIVE_INFINITY;
  return cues.filter((cue) => cue.startMs >= skipHeadMs && cue.endMs <= endLimit);
}

async function removeIfExists(path: string) {
  if (existsSync(path)) await unlink(path).catch(() => undefined);
}

async function materializeFromR2(
  r2: ReturnType<typeof createR2>,
  ref: EpisodeRef,
  workDir: string,
  needVideo: boolean,
) {
  await mkdir(workDir, { recursive: true });
  ref.enSrtPath = join(workDir, `${ref.stem}.en.srt`);
  ref.zhSrtPath = join(workDir, `${ref.stem}.zh.srt`);
  await downloadRawFile(r2, ref.enSrtKey, ref.enSrtPath);
  await downloadRawFile(r2, ref.zhSrtKey, ref.zhSrtPath);
  if (needVideo) {
    ref.videoPath = join(workDir, `${ref.stem}.mp4`);
    console.log(`  downloading ${ref.videoKey}`);
    await downloadRawFile(r2, ref.videoKey, ref.videoPath);
  }
}

async function pushRaw(options: IngestOptions) {
  const r2env = loadR2Env();
  const r2 = createR2(r2env);
  const episodes = scanEpisodes(r2env.root, options.season, options.episodeCode);
  if (episodes.length === 0) throw new Error("No local complete set to push. Put files in data/raw first.");
  for (const episode of episodes) {
    console.log(`push ${episode.code} -> r2://${r2.bucket}`);
    await uploadRawFile(r2, episode.videoKey, episode.videoPath, "video/mp4");
    await uploadRawFile(r2, episode.enSrtKey, episode.enSrtPath, "application/x-subrip");
    await uploadRawFile(r2, episode.zhSrtKey, episode.zhSrtPath, "application/x-subrip");
  }
  console.log("raw files are on R2. You can delete data/raw copies after verifying the bucket.");
}

async function ingestEpisode(
  root: string,
  supabase: ReturnType<typeof createAdminClient> | null,
  showId: string | null,
  ref: EpisodeRef,
  options: IngestOptions,
  stagedFromR2: boolean,
) {
  const en = cleanTrack(parseSrt(ref.enSrtPath, false));
  const zh = cleanTrack(parseSrt(ref.zhSrtPath, true));
  let cues = alignTracks(en, zh);

  let durationMs: number | null = null;
  if (!options.dryRun) {
    durationMs = await probeDurationMs(ref.videoPath);
  }
  cues = applyWindow(cues, options.skipHeadMs, options.skipTailMs, durationMs);
  if (options.limit != null) cues = cues.slice(0, options.limit);

  const aligned = cues.filter((cue) => cue.alignStatus === "aligned").length;
  const enOnly = cues.filter((cue) => cue.alignStatus === "en_only").length;
  const zhOnly = cues.filter((cue) => cue.alignStatus === "zh_only").length;
  const thumbMb = (cues.length * 45) / 1024;
  const clipMb = options.thumbsOnly ? 0 : (cues.length * 120) / 1024;

  console.log(
    `${ref.code}: ${cues.length} cues (aligned=${aligned} en_only=${enOnly} zh_only=${zhOnly}) ~${(thumbMb + clipMb).toFixed(1)} MB`,
  );
  for (const cue of cues.slice(0, 8)) {
    console.log(
      `  ${formatTimestamp(cue.startMs)} ${cue.alignStatus} EN=${cue.textEn.slice(0, 60)} ZH=${cue.textZh.slice(0, 40)}`,
    );
  }

  if (options.dryRun || !supabase || !showId) return { ok: cues.length, failed: 0 };

  const episodeId = await upsertEpisode(
    supabase,
    showId,
    ref.season,
    ref.episode,
    ref.sourceLabel,
    durationMs,
  );
  const workDir = join(root, "data/work", ref.code);
  await mkdir(workDir, { recursive: true });

  let ok = 0;
  let failed = 0;
  for (const [index, cue] of cues.entries()) {
    const existing = await findCue(supabase, episodeId, cue);
    if (existing?.media_status === "ready" && !options.force) {
      ok += 1;
      continue;
    }

    const cueId = existing?.id ?? randomUUID();
    const thumbKey = storageKey(ref.season, ref.episode, cueId, "jpg");
    const clipKey = options.thumbsOnly ? null : storageKey(ref.season, ref.episode, cueId, "mp4");
    const thumbPath = join(workDir, `${cueId}.jpg`);
    const clipPath = join(workDir, `${cueId}.mp4`);

    try {
      await upsertCue(supabase, {
        id: cueId,
        episodeId,
        cue,
        thumbKey,
        clipKey,
        clipDurationMs: options.thumbsOnly ? null : clipWindow(cue.startMs, cue.endMs).clipDurationMs,
        mediaStatus: "pending",
      });
      await cutThumb(ref.videoPath, cue, thumbPath);
      await uploadObject(supabase, "thumbs", thumbKey, thumbPath, "image/jpeg");
      let clipDurationMs: number | null = null;
      if (!options.thumbsOnly && clipKey) {
        clipDurationMs = await cutClip(ref.videoPath, cue, clipPath);
        await uploadObject(supabase, "clips", clipKey, clipPath, "video/mp4");
      }
      await upsertCue(supabase, {
        id: cueId,
        episodeId,
        cue,
        thumbKey,
        clipKey,
        clipDurationMs,
        mediaStatus: "ready",
      });
      ok += 1;
      console.log(`  [${index + 1}/${cues.length}] ready ${formatTimestamp(cue.startMs)}`);
    } catch (error) {
      failed += 1;
      await upsertCue(supabase, {
        id: cueId,
        episodeId,
        cue,
        thumbKey,
        clipKey,
        clipDurationMs: null,
        mediaStatus: "failed",
      }).catch(() => undefined);
      console.error(`  [${index + 1}/${cues.length}] failed ${formatTimestamp(cue.startMs)}: ${String(error)}`);
    } finally {
      await removeIfExists(thumbPath);
      await removeIfExists(clipPath);
    }
  }

  if (stagedFromR2) {
    await removeIfExists(ref.videoPath);
    await removeIfExists(ref.enSrtPath);
    await removeIfExists(ref.zhSrtPath);
  }

  return { ok, failed };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.pushRaw) {
    if (!options.episodeCode && options.season == null) {
      throw new Error("Pass --episode S01E01 or --season 1 with --push-raw");
    }
    await pushRaw(options);
    return;
  }

  if (!options.episodeCode && options.season == null) {
    printHelp();
    process.exit(1);
  }
  if ((options.season ?? parseEpisodeCode(options.episodeCode ?? "S01E01").season) > 1 && !options.force) {
    throw new Error("Season 2+ ingest requires --force (free-tier storage cap).");
  }

  const { root, url, serviceRole } = loadIngestEnv();
  const stagedFromR2 = !options.fromLocal;
  let episodes: EpisodeRef[];
  let r2: ReturnType<typeof createR2> | null = null;

  if (options.fromLocal) {
    episodes = scanEpisodes(root, options.season, options.episodeCode);
  } else {
    const r2env = loadR2Env();
    r2 = createR2(r2env);
    episodes = await scanR2Episodes(r2, options.season, options.episodeCode);
  }
  if (episodes.length === 0) throw new Error("No episodes matched.");

  const supabase = options.dryRun ? null : createAdminClient(url, serviceRole);
  const showId = supabase ? await ensureShow(supabase) : null;

  let ok = 0;
  let failed = 0;
  for (const episode of episodes) {
    if (r2) {
      const workDir = join(root, "data/work", episode.code);
      await materializeFromR2(r2, episode, workDir, !options.dryRun);
    }
    try {
      const result = await ingestEpisode(root, supabase, showId, episode, options, stagedFromR2 && Boolean(r2));
      ok += result.ok;
      failed += result.failed;
    } finally {
      if (r2) {
        await removeIfExists(episode.videoPath);
        await removeIfExists(episode.enSrtPath);
        await removeIfExists(episode.zhSrtPath);
      }
    }
  }
  console.log(`done ok=${ok} failed=${failed} dryRun=${options.dryRun}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

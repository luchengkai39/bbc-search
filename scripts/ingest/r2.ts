import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { parseEpisodeCode } from "./scan";
import type { EpisodeRef } from "./types";

export type R2Config = {
  bucket: string;
  client: S3Client;
};

const VIDEO_PREFIX = "raw/video/";
const SUB_PREFIX = "raw/subs/";
const STEM = /^TBBT_S(\d{2})E(\d{2})$/i;

export function rawVideoKey(stem: string) {
  return `${VIDEO_PREFIX}${stem}.mp4`;
}

export function rawSubKey(stem: string, lang: "en" | "zh") {
  return `${SUB_PREFIX}${stem}.${lang}.srt`;
}

export function createR2(config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
}): R2Config {
  const endpoint =
    config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { bucket: config.bucket, client };
}

async function listPrefix(r2: R2Config, prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2.client.send(
      new ListObjectsV2Command({
        Bucket: r2.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function objectExists(r2: R2Config, key: string) {
  try {
    await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotFound" || name === "NoSuchKey") return false;
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status === 404) return false;
    throw error;
  }
}

export async function scanR2Episodes(
  r2: R2Config,
  season: number | null,
  episodeCode: string | null,
): Promise<EpisodeRef[]> {
  const wanted = episodeCode ? parseEpisodeCode(episodeCode) : null;
  const videos = (await listPrefix(r2, VIDEO_PREFIX)).filter((key) =>
    key.toLowerCase().endsWith(".mp4"),
  );
  const found: EpisodeRef[] = [];

  for (const videoKey of videos) {
    const file = videoKey.slice(VIDEO_PREFIX.length);
    const stem = file.replace(/\.mp4$/i, "");
    const parsed = stem.toUpperCase().match(STEM);
    if (!parsed) {
      console.warn(`skip unmatched R2 object: ${videoKey}`);
      continue;
    }
    const seasonNum = Number(parsed[1]);
    const episodeNum = Number(parsed[2]);
    const code = `S${parsed[1]}E${parsed[2]}`;
    if (wanted && (wanted.season !== seasonNum || wanted.episode !== episodeNum)) continue;
    if (season != null && !wanted && seasonNum !== season) continue;

    const enSrtKey = rawSubKey(stem, "en");
    const zhSrtKey = rawSubKey(stem, "zh");
    const hasEn = await objectExists(r2, enSrtKey);
    const hasZh = await objectExists(r2, zhSrtKey);
    if (!hasEn || !hasZh) {
      console.warn(`skip ${code}: missing ${enSrtKey} or ${zhSrtKey} on R2`);
      continue;
    }

    found.push({
      code,
      season: seasonNum,
      episode: episodeNum,
      stem,
      sourceLabel: `${stem}.mp4`,
      videoKey,
      enSrtKey,
      zhSrtKey,
      videoPath: "",
      enSrtPath: "",
      zhSrtPath: "",
    });
  }

  found.sort((a, b) => a.season - b.season || a.episode - b.episode);
  if (wanted && found.length === 0) {
    throw new Error(`No complete R2 set for ${wanted.code} under raw/video and raw/subs`);
  }
  return found;
}

export async function uploadRawFile(r2: R2Config, key: string, filePath: string, contentType: string) {
  const upload = new Upload({
    client: r2.client,
    params: {
      Bucket: r2.bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      CacheControl: "private, max-age=31536000",
    },
    queueSize: 3,
    partSize: 16 * 1024 * 1024,
  });
  upload.on("httpUploadProgress", (progress) => {
    if (!progress.total || !progress.loaded) return;
    const pct = Math.floor((progress.loaded / progress.total) * 100);
    if (pct === 0 || pct === 100 || pct % 20 === 0) {
      process.stdout.write(`\r  ${key} ${pct}%   `);
    }
  });
  await upload.done();
  process.stdout.write(`\r  ${key} uploaded\n`);
}

export async function downloadRawFile(r2: R2Config, key: string, destPath: string) {
  await mkdir(dirname(destPath), { recursive: true });
  const result = await r2.client.send(
    new GetObjectCommand({ Bucket: r2.bucket, Key: key }),
  );
  if (!result.Body) throw new Error(`empty R2 object: ${key}`);
  await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(destPath));
}

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { clipWindow } from "./align";
import type { AlignedCue } from "./types";

function commandExists(bin: string) {
  return existsSync(bin);
}

export function resolveFfmpeg() {
  const fromEnv = process.env.FFMPEG_PATH;
  const candidates = [
    fromEnv,
    "ffmpeg",
    join("C:", "ffmpeg", "bin", "ffmpeg.exe"),
    join("C:", "Program Files", "ffmpeg", "bin", "ffmpeg.exe"),
    join(homedir(), "scoop", "apps", "ffmpeg", "current", "bin", "ffmpeg.exe"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (candidate === "ffmpeg" || commandExists(candidate)) {
      return candidate;
    }
  }
  return "ffmpeg";
}

function run(bin: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim().split(/\r?\n/).slice(-8).join("\n") || `exit ${code}`));
    });
  });
}

export async function probeDurationMs(videoPath: string) {
  const ffmpeg = resolveFfmpeg();
  const ffprobe = ffmpeg.toLowerCase().includes("ffmpeg")
    ? ffmpeg.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1")
    : "ffprobe";
  const output = await run(ffprobe, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    videoPath,
  ]);
  const seconds = Number(output);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read duration for ${videoPath}`);
  }
  return Math.round(seconds * 1000);
}

export async function cutThumb(videoPath: string, cue: AlignedCue, outPath: string) {
  const ffmpeg = resolveFfmpeg();
  const midSec = ((cue.startMs + cue.endMs) / 2 / 1000).toFixed(3);
  await run(ffmpeg, [
    "-y",
    "-ss",
    midSec,
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=480:-2",
    "-q:v",
    "4",
    outPath,
  ]);
}

export async function cutClip(videoPath: string, cue: AlignedCue, outPath: string) {
  const ffmpeg = resolveFfmpeg();
  const window = clipWindow(cue.startMs, cue.endMs);
  await run(ffmpeg, [
    "-y",
    "-ss",
    (window.clipStartMs / 1000).toFixed(3),
    "-t",
    (window.clipDurationMs / 1000).toFixed(3),
    "-i",
    videoPath,
    "-vf",
    "scale=-2:360",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-c:a",
    "aac",
    "-b:a",
    "64k",
    "-ac",
    "2",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  return window.clipDurationMs;
}

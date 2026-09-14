import { readFileSync } from "node:fs";
import type { RawCue } from "./types";

const TIMESTAMP =
  /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function toMs(h: string, m: string, s: string, ms: string) {
  return (
    Number(h) * 3_600_000 +
    Number(m) * 60_000 +
    Number(s) * 1_000 +
    Number(ms.padEnd(3, "0").slice(0, 3))
  );
}

export function stripMarkup(text: string) {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\\[nN]/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickText(rawBlock: string, preferChinese: boolean) {
  const lines = rawBlock
    .split(/\r?\n/)
    .map((line) => stripMarkup(line))
    .filter(Boolean);

  if (preferChinese) {
    const zh = lines.filter((line) => /[\u4e00-\u9fff]/.test(line));
    if (zh.length) return zh.join(" ");
  }

  return lines.join(" ");
}

export function parseSrt(filePath: string, preferChinese = false): RawCue[] {
  const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const blocks = source.split(/\r?\n\r?\n/);
  const cues: RawCue[] = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) continue;

    const timeLine = TIMESTAMP.test(lines[0]) ? lines[0] : lines[1];
    const match = timeLine.match(TIMESTAMP);
    if (!match) continue;

    const startMs = toMs(match[1], match[2], match[3], match[4]);
    const endMs = toMs(match[5], match[6], match[7], match[8]);
    if (endMs <= startMs) continue;

    const textStart = TIMESTAMP.test(lines[0]) ? 1 : 2;
    const text = pickText(lines.slice(textStart).join("\n"), preferChinese);
    if (!text) continue;

    const prev = cues[cues.length - 1];
    if (prev && prev.startMs === startMs && prev.endMs === endMs) {
      prev.text = `${prev.text} ${text}`.trim();
      continue;
    }

    cues.push({ startMs, endMs, text });
  }

  return cues;
}

export function formatTimestamp(ms: number) {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const milli = clamped % 1_000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(milli).padStart(3, "0")}`;
}

import type { AlignedCue, RawCue } from "./types";

const DROP_SHORTER_THAN_MS = 400;
const MERGE_SHORTER_THAN_MS = 800;
const MIN_IOU = 0.3;

function duration(cue: RawCue) {
  return cue.endMs - cue.startMs;
}

function isJunk(text: string) {
  const stripped = text
    .replace(/[♪♫🎵★☆\s\-–—._,，。！？!?:：;；"'“”‘’~～\[\]\(\)（）【】]/g, "")
    .trim();
  return stripped.length === 0;
}

export function cleanTrack(cues: RawCue[]): RawCue[] {
  const kept = cues.filter((cue) => !isJunk(cue.text) && duration(cue) >= DROP_SHORTER_THAN_MS);
  const merged: RawCue[] = [];

  for (const cue of kept) {
    if (duration(cue) >= MERGE_SHORTER_THAN_MS || merged.length === 0) {
      merged.push({ ...cue });
      continue;
    }
    const prev = merged[merged.length - 1];
    prev.endMs = Math.max(prev.endMs, cue.endMs);
    prev.text = `${prev.text} ${cue.text}`.replace(/\s+/g, " ").trim();
  }

  return merged;
}

function overlapMs(a: RawCue, b: RawCue) {
  return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
}

function iou(a: RawCue, b: RawCue) {
  const overlap = overlapMs(a, b);
  const union = duration(a) + duration(b) - overlap;
  return union <= 0 ? 0 : overlap / union;
}

export function alignTracks(enCues: RawCue[], zhCues: RawCue[]): AlignedCue[] {
  const usedZh = new Set<number>();
  const aligned: AlignedCue[] = [];

  for (const en of enCues) {
    let bestIndex = -1;
    let bestIou = 0;
    for (let i = 0; i < zhCues.length; i += 1) {
      if (usedZh.has(i)) continue;
      const score = iou(en, zhCues[i]);
      if (score > bestIou) {
        bestIou = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestIou >= MIN_IOU) {
      usedZh.add(bestIndex);
      const zh = zhCues[bestIndex];
      aligned.push({
        startMs: en.startMs,
        endMs: en.endMs,
        textEn: en.text,
        textZh: zh.text,
        alignStatus: "aligned",
      });
    } else {
      aligned.push({
        startMs: en.startMs,
        endMs: en.endMs,
        textEn: en.text,
        textZh: "",
        alignStatus: "en_only",
      });
    }
  }

  for (let i = 0; i < zhCues.length; i += 1) {
    if (usedZh.has(i)) continue;
    const zh = zhCues[i];
    aligned.push({
      startMs: zh.startMs,
      endMs: zh.endMs,
      textEn: "",
      textZh: zh.text,
      alignStatus: "zh_only",
    });
  }

  aligned.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return aligned;
}

export function clipWindow(startMs: number, endMs: number) {
  const clipStartMs = Math.max(0, startMs - 200);
  const clipEndMs = Math.min(endMs + 200, clipStartMs + 4000);
  return {
    clipStartMs,
    clipEndMs,
    clipDurationMs: Math.max(1, clipEndMs - clipStartMs),
  };
}

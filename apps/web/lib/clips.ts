export type LangPref = "both" | "en" | "zh";

export type ClipCardData = {
  id: string;
  textEn: string;
  textZh: string;
  season: number;
  episode: number;
  episodeTitleEn: string;
  clipDurationMs: number | null;
  thumbUrl: string | null;
};

export function episodeLabel(season: number, episode: number, titleEn = "") {
  const code = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
  return titleEn.trim() ? `${code} ${titleEn.trim()}` : code;
}

export function formatClipSeconds(ms: number | null) {
  const seconds = Math.max(0.1, (ms ?? 1000) / 1000);
  return `${seconds.toFixed(1).replace(/\.0$/, "")}s`;
}

export function formatTimecode(ms: number) {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const prefix = h > 0 ? `${String(h).padStart(2, "0")}:` : "";
  return `${prefix}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

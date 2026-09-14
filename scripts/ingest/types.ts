export type RawCue = {
  startMs: number;
  endMs: number;
  text: string;
};

export type AlignStatus = "aligned" | "en_only" | "zh_only";

export type AlignedCue = {
  startMs: number;
  endMs: number;
  textEn: string;
  textZh: string;
  alignStatus: AlignStatus;
};

export type EpisodeRef = {
  code: string;
  season: number;
  episode: number;
  stem: string;
  sourceLabel: string;
  videoKey: string;
  enSrtKey: string;
  zhSrtKey: string;
  videoPath: string;
  enSrtPath: string;
  zhSrtPath: string;
};

export type IngestOptions = {
  dryRun: boolean;
  thumbsOnly: boolean;
  force: boolean;
  pushRaw: boolean;
  fromLocal: boolean;
  limit: number | null;
  skipHeadMs: number;
  skipTailMs: number;
  season: number | null;
  episodeCode: string | null;
};

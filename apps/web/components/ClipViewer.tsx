"use client";

import { useEffect, useState } from "react";
import { ClipPlayer } from "@/components/ClipPlayer";
import { BilingualQuote } from "@/components/BilingualQuote";
import { ShareActions } from "@/components/ShareActions";
import {
  episodeLabel,
  formatClipSeconds,
  formatTimecode,
  type ClipCardData,
  type LangPref,
} from "@/lib/clips";
import type { CuePlayable } from "@/lib/cues";

type Props = {
  clips: ClipCardData[];
  index: number;
  lang: LangPref;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export function ClipViewer({ clips, index, lang, onIndexChange, onClose }: Props) {
  const current = clips[index];
  const [cue, setCue] = useState<CuePlayable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canBrowse = clips.length > 1;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    setCue(null);
    setError(null);
    void fetch(`/api/cues/${current.id}?lite=1`)
      .then(async (response) => {
        const body = (await response.json()) as { cue?: CuePlayable; error?: string };
        if (!response.ok || !body.cue) throw new Error(body.error || "cue_failed");
        if (!cancelled) setCue(body.cue);
      })
      .catch(() => {
        if (!cancelled) setError("这段切片暂时无法播放");
      });
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (!canBrowse) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        onIndexChange(
          event.key === "ArrowLeft"
            ? (index - 1 + clips.length) % clips.length
            : (index + 1) % clips.length,
        );
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canBrowse, clips.length, index, onClose, onIndexChange]);

  if (!current) return null;

  function go(delta: number) {
    if (!canBrowse) return;
    onIndexChange((index + delta + clips.length) % clips.length);
  }

  const playable = cue ?? current;
  const label = episodeLabel(playable.season, playable.episode, playable.episodeTitleEn);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/45 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={playable.textEn || playable.textZh || "片段"}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-sm text-white hover:bg-black/70"
          aria-label="关闭"
        >
          ×
        </button>

        {canBrowse ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-[28%] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white hover:bg-black/70"
              aria-label="上一段"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-[28%] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white hover:bg-black/70"
              aria-label="下一段"
            >
              ›
            </button>
          </>
        ) : null}

        {cue?.clipUrl ? (
          <ClipPlayer key={cue.clipUrl} src={cue.clipUrl} poster={cue.thumbUrl} />
        ) : (
          <div className="aspect-video bg-neutral-200">
            {current.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
            {error ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-white">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-3 px-5 py-4">
          <p className="text-xs text-neutral-400">
            {label}
            {"startMs" in playable && typeof playable.startMs === "number"
              ? ` · ${formatTimecode(playable.startMs)}`
              : ""}
            {" · "}
            {formatClipSeconds(playable.clipDurationMs)}
            {canBrowse ? ` · ${index + 1} / ${clips.length}` : ""}
          </p>
          <BilingualQuote
            textEn={playable.textEn}
            textZh={playable.textZh}
            lang={lang}
            compact={false}
          />
          <ShareActions cueId={current.id} />
        </div>
      </div>
    </div>
  );
}

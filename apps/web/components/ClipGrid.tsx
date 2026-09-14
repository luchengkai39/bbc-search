"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { BilingualQuote } from "@/components/BilingualQuote";
import {
  episodeLabel,
  formatClipSeconds,
  type ClipCardData,
  type LangPref,
} from "@/lib/clips";

const NINE_GRID =
  "grid grid-cols-3 grid-rows-3 gap-5 h-[min(100cqh,calc((100cqw-2.5rem)*9/16+2.5rem))] w-[min(100cqw,calc((100cqh-2.5rem)*16/9+2.5rem))]";

export function ClipCard({
  clip,
  lang,
  href,
  onOpen,
  fill = false,
}: {
  clip: ClipCardData;
  lang: LangPref;
  href: string;
  onOpen?: (clip: ClipCardData) => void;
  fill?: boolean;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onOpen) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onOpen(clip);
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`relative block overflow-hidden rounded-xl bg-black text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        fill ? "h-full w-full" : "aspect-video w-full"
      }`}
    >
      {clip.thumbUrl ? (
        // Signed storage URL; not optimized to avoid exposing a public image pipeline.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clip.thumbUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      <p className="absolute left-2 top-2 z-10 max-w-[70%] truncate text-[10px] font-medium text-white drop-shadow">
        {episodeLabel(clip.season, clip.episode, clip.episodeTitleEn)}
      </p>
      <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current" aria-hidden>
          <path d="M8 5.14v13.72L19 12 8 5.14z" />
        </svg>
        {formatClipSeconds(clip.clipDurationMs)}
      </span>
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pb-2 pt-8">
        <BilingualQuote
          textEn={clip.textEn}
          textZh={clip.textZh}
          lang={lang}
          overlay
        />
      </div>
    </Link>
  );
}

function NineWrap({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center [container-type:size]">
      <div className={NINE_GRID}>{children}</div>
    </div>
  );
}

export function ClipGrid({
  clips,
  lang,
  loading,
  query = "",
  onOpen,
  fitViewport = false,
}: {
  clips: ClipCardData[];
  lang: LangPref;
  loading: boolean;
  query?: string;
  onOpen?: (clip: ClipCardData) => void;
  fitViewport?: boolean;
}) {
  const fitNine = fitViewport && (loading || clips.length <= 9);
  const gridClass = fitViewport
    ? clips.length > 9
      ? "grid h-full min-h-0 grid-cols-3 content-start gap-5 overflow-y-auto pb-2"
      : NINE_GRID
    : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3";

  const items = loading
    ? Array.from({ length: fitViewport ? 9 : 8 }).map((_, index) => (
        <div
          key={index}
          className={`overflow-hidden rounded-xl bg-neutral-800 ${fitNine ? "h-full w-full" : "aspect-video"}`}
        >
          <div className="h-full animate-pulse bg-neutral-700" />
        </div>
      ))
    : clips.map((clip) => {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const qs = params.toString();
        return (
          <ClipCard
            key={clip.id}
            clip={clip}
            lang={lang}
            href={qs ? `/c/${clip.id}?${qs}` : `/c/${clip.id}`}
            onOpen={onOpen}
            fill={fitNine}
          />
        );
      });

  if (fitNine) return <NineWrap>{items}</NineWrap>;
  return <div className={gridClass}>{items}</div>;
}

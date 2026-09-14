"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchHero } from "@/components/SearchHero";
import { ClipGrid } from "@/components/ClipGrid";
import { ClipViewer } from "@/components/ClipViewer";
import { UUID } from "@/lib/ids";
import type { ClipCardData, LangPref } from "@/lib/clips";

function parseLang(value: string | null): LangPref {
  return value === "en" || value === "zh" ? value : "both";
}

export function SearchHome() {
  const router = useRouter();
  const params = useSearchParams();
  const qParam = params.get("q") ?? "";
  const playParam = params.get("play") ?? "";
  const season = Number(params.get("season") ?? "1") || 1;
  const lang = parseLang(params.get("lang"));

  const [query, setQuery] = useState(qParam);
  const [clips, setClips] = useState<ClipCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeUrl = useCallback(
    (next: { q?: string; season?: number; lang?: LangPref; play?: string | null }) => {
      const search = new URLSearchParams(
        typeof window === "undefined" ? params.toString() : window.location.search,
      );
      if (next.q !== undefined) {
        if (next.q.trim()) search.set("q", next.q.trim());
        else search.delete("q");
      }
      if (next.season !== undefined) {
        if (next.season !== 1) search.set("season", String(next.season));
        else search.delete("season");
      }
      if (next.lang !== undefined) {
        if (next.lang !== "both") search.set("lang", next.lang);
        else search.delete("lang");
      }
      if (next.play !== undefined) {
        if (next.play && UUID.test(next.play)) search.set("play", next.play);
        else search.delete("play");
      }
      const qs = search.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [params, router],
  );

  const load = useCallback(async (q: string, seasonValue: number) => {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      if (q.trim()) search.set("q", q.trim());
      search.set("season", String(seasonValue));
      const response = await fetch(`/api/search?${search.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "search_failed");
      setClips(body.clips ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "search_failed");
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(qParam, season);
  }, [qParam, season, load]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (query.trim() === qParam.trim()) return;
      writeUrl({ q: query, play: null });
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, qParam, writeUrl]);

  const playIndex = clips.findIndex((clip) => clip.id === playParam);
  const viewing = playIndex >= 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fafafa]">
      <SearchHero
        query={query}
        season={season}
        lang={lang}
        onQueryChange={setQuery}
        onSeasonChange={(value) => writeUrl({ season: value, play: null })}
        onLangChange={(value) => writeUrl({ lang: value })}
        onSubmit={() => writeUrl({ q: query, play: null })}
        onExample={(term) => {
          setQuery(term);
          writeUrl({ q: term, play: null });
        }}
      />
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-6 pb-6">
        {error ? (
          <p className="mb-2 text-center text-sm text-red-600">搜索失败，请稍后重试。</p>
        ) : null}
        {!loading && !error && clips.length === 0 ? (
          <p className="text-center text-neutral-500">没有这句台词，换个词试试</p>
        ) : (
          <ClipGrid
            clips={clips}
            lang={lang}
            loading={loading}
            query={qParam}
            fitViewport
            onOpen={(clip) => writeUrl({ play: clip.id })}
          />
        )}
      </main>
      {viewing ? (
        <ClipViewer
          clips={clips}
          index={playIndex}
          lang={lang}
          onIndexChange={(next) => {
            const target = clips[next];
            if (target) writeUrl({ play: target.id });
          }}
          onClose={() => writeUrl({ play: null })}
        />
      ) : null}
    </div>
  );
}

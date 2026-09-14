import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClipGrid } from "@/components/ClipGrid";
import { ClipPlayer } from "@/components/ClipPlayer";
import { BilingualQuote } from "@/components/BilingualQuote";
import { ShareActions } from "@/components/ShareActions";
import { CuePager } from "@/components/CuePager";
import { getCueDetail } from "@/lib/cues";
import { searchClips } from "@/lib/search";
import { episodeLabel, formatClipSeconds, formatTimecode } from "@/lib/clips";
import { UUID } from "@/lib/ids";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "片段" };
  const cue = await getCueDetail(id);
  if (!cue) return { title: "片段" };
  const quote = cue.textEn || cue.textZh || "片段";
  return { title: quote.length > 60 ? `${quote.slice(0, 57)}…` : quote };
}

export default async function CuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q = "" } = await searchParams;
  if (!UUID.test(id)) notFound();

  const cue = await getCueDetail(id);
  if (!cue) notFound();

  const label = episodeLabel(cue.season, cue.episode, cue.episodeTitleEn);
  const query = q.trim();
  let prevId: string | null = null;
  let nextId: string | null = null;
  if (query) {
    const hits = await searchClips(query, cue.season);
    const index = hits.findIndex((hit) => hit.id === id);
    if (index >= 0 && hits.length > 1) {
      prevId = hits[(index - 1 + hits.length) % hits.length]?.id ?? null;
      nextId = hits[(index + 1) % hits.length]?.id ?? null;
    }
  }

  const backHref = query ? `/?q=${encodeURIComponent(query)}` : "/";

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-neutral-200/70 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link href="/" className="text-sm tracking-[0.2em] text-neutral-400 uppercase">
            Bigboom
          </Link>
          <Link href={backHref} className="text-sm text-neutral-600 hover:text-neutral-900">
            返回搜索
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="relative">
            {cue.clipUrl ? (
              <ClipPlayer src={cue.clipUrl} poster={cue.thumbUrl} />
            ) : (
              <div className="aspect-video bg-neutral-200">
                {cue.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cue.thumbUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
            )}
            <CuePager prevId={prevId} nextId={nextId} query={query} />
          </div>
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-neutral-500">
              {label} · {formatTimecode(cue.startMs)} · {formatClipSeconds(cue.clipDurationMs)}
            </p>
            <BilingualQuote
              textEn={cue.textEn}
              textZh={cue.textZh}
              lang="both"
              compact={false}
            />
            <ShareActions cueId={cue.id} />
          </div>
        </section>

        <aside className="rounded-xl border border-neutral-200/80 bg-white px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-800">前后句</h2>
          <ul className="space-y-3">
            {cue.context.length === 0 ? (
              <li className="text-sm text-neutral-500">没有更多上下文</li>
            ) : (
              cue.context.map((item) => (
                <li key={item.id}>
                  <Link href={`/c/${item.id}`} className="block hover:text-[#1a9b68]">
                    <p className="text-xs text-neutral-400">{formatClipSeconds(item.clipDurationMs)}</p>
                    <p className="text-sm text-neutral-900">{item.textEn || item.textZh}</p>
                    {item.textEn && item.textZh ? (
                      <p className="text-sm text-neutral-500">{item.textZh}</p>
                    ) : null}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </aside>
      </main>

      {cue.related.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-800">本集其它片段</h2>
          <ClipGrid clips={cue.related} lang="both" loading={false} />
        </section>
      ) : null}
    </div>
  );
}

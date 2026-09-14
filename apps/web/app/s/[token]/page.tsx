import Link from "next/link";
import type { Metadata } from "next";
import { ClipPlayer } from "@/components/ClipPlayer";
import { BilingualQuote } from "@/components/BilingualQuote";
import { episodeLabel, formatClipSeconds, formatTimecode } from "@/lib/clips";
import { SHARE_TOKEN } from "@/lib/ids";
import { bumpShareHit, getSharePlayable } from "@/lib/shares";

const robotsOff = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) {
    return { title: "链接已失效", robots: robotsOff };
  }
  const result = await getSharePlayable(token);
  if (result.status !== "ok") {
    return { title: "链接已失效", robots: robotsOff };
  }
  const quote = result.cue.textEn || result.cue.textZh || "片段";
  return {
    title: quote.length > 60 ? `${quote.slice(0, 57)}…` : quote,
    robots: robotsOff,
  };
}

function ExpiredShare() {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-neutral-200/70 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="text-sm tracking-[0.2em] text-neutral-400 uppercase">
            Bigboom
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-neutral-900">这个分享链接已失效</h1>
        <p className="mt-2 text-sm text-neutral-500">链接 7 天过期，或地址不正确。</p>
        <Link href="/" className="mt-6 inline-block text-[#1a9b68] hover:underline">
          去搜索更多
        </Link>
      </main>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) return <ExpiredShare />;

  const result = await getSharePlayable(token);
  if (result.status !== "ok") return <ExpiredShare />;
  await bumpShareHit(token);

  const { cue } = result;
  const label = episodeLabel(cue.season, cue.episode, cue.episodeTitleEn);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-neutral-200/70 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/" className="text-sm tracking-[0.2em] text-neutral-400 uppercase">
            Bigboom
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
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
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-neutral-500">
              {label} · {formatTimecode(cue.startMs)} · {formatClipSeconds(cue.clipDurationMs)}
            </p>
            <BilingualQuote textEn={cue.textEn} textZh={cue.textZh} lang="both" compact={false} />
            <Link href="/" className="inline-block text-sm text-[#1a9b68] hover:underline">
              去搜索更多
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

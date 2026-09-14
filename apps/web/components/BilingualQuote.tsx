import type { LangPref } from "@/lib/clips";

type Props = {
  textEn: string;
  textZh: string;
  lang: LangPref;
  compact?: boolean;
  dense?: boolean;
  overlay?: boolean;
};

export function BilingualQuote({
  textEn,
  textZh,
  lang,
  compact = true,
  dense = false,
  overlay = false,
}: Props) {
  const enTone = overlay
    ? "font-medium text-white drop-shadow"
    : lang === "zh"
      ? "text-neutral-500"
      : "font-medium text-neutral-900";
  const zhTone = overlay
    ? "text-white/90 drop-shadow"
    : lang === "en"
      ? "text-neutral-500"
      : lang === "zh"
        ? "font-medium text-neutral-900"
        : "text-neutral-500";
  const enSize = overlay || dense
    ? "text-[11px] leading-tight line-clamp-1"
    : compact
      ? "text-sm line-clamp-2"
      : "text-xl leading-snug";
  const zhSize = overlay || dense
    ? "text-[11px] leading-tight line-clamp-1"
    : compact
      ? "text-sm line-clamp-1"
      : "text-base leading-relaxed";

  return (
    <div className={dense || overlay ? "space-y-0.5" : "space-y-1"}>
      {lang !== "zh" && textEn ? (
        <p className={`${enTone} ${enSize}`}>{textEn}</p>
      ) : null}
      {lang !== "en" && textZh ? (
        <p className={`${zhTone} ${zhSize}`}>{textZh}</p>
      ) : null}
      {lang === "zh" && !textZh && textEn ? (
        <p className={`font-medium text-neutral-900 ${enSize}`}>{textEn}</p>
      ) : null}
    </div>
  );
}

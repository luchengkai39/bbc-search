import { ImageResponse } from "next/og";
import { cueCardKey, getReadyCueRow } from "@/lib/cues";
import { createAdminClient } from "@/lib/supabase/admin";
import { signStorageUrls } from "@/lib/storage";
import { episodeLabel } from "@/lib/clips";

export const CARD_SIZE = { width: 1200, height: 630 };

const FONT_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

async function loadNotoSansSc(text: string, weight: 400 | 700) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(cssUrl, { headers: { "User-Agent": FONT_UA } }).then((res) => {
    if (!res.ok) throw new Error(`font css ${res.status}`);
    return res.text();
  });
  const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!match) throw new Error("font url missing");
  const font = await fetch(match[1]);
  if (!font.ok) throw new Error(`font file ${font.status}`);
  return font.arrayBuffer();
}

function clipText(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export async function getOrCreateCueCardPng(cueId: string): Promise<Uint8Array | null> {
  const row = await getReadyCueRow(cueId);
  if (!row) return null;

  const key = cueCardKey(row);
  const admin = createAdminClient();
  const existing = await admin.storage.from("cards").download(key);
  if (existing.data) {
    return new Uint8Array(await existing.data.arrayBuffer());
  }

  const thumbs = await signStorageUrls("thumbs", row.thumb_key ? [row.thumb_key] : []);
  const thumbUrl = row.thumb_key ? thumbs.get(row.thumb_key) ?? null : null;
  const textEn = clipText(row.text_en ?? "", 140);
  const textZh = clipText(row.text_zh ?? "", 80);
  const label = episodeLabel(row.episodes?.season ?? 1, row.episodes?.episode ?? 1);
  const fontText = `${label} Bigboom ${textEn} ${textZh} 生活大爆炸`;
  const [fontRegular, fontBold] = await Promise.all([
    loadNotoSansSc(fontText, 400),
    loadNotoSansSc(fontText, 700),
  ]);

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          fontFamily: '"Noto Sans SC"',
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 360,
            background: "#111111",
            overflow: "hidden",
          }}
        >
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              width={1200}
              height={360}
              style={{ objectFit: "cover", width: 1200, height: 360 }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                background: "#2ecf8f",
              }}
            />
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "32px 48px 40px",
            gap: 12,
            height: 270,
          }}
        >
          <div style={{ display: "flex", color: "#2ecf8f", fontSize: 24, fontWeight: 700 }}>
            {label} · Bigboom
          </div>
          {textEn ? (
            <div
              style={{
                display: "flex",
                color: "#171717",
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {textEn}
            </div>
          ) : null}
          {textZh ? (
            <div style={{ display: "flex", color: "#737373", fontSize: 28, lineHeight: 1.4 }}>
              {textZh}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts: [
        { name: "Noto Sans SC", data: fontRegular, weight: 400, style: "normal" },
        { name: "Noto Sans SC", data: fontBold, weight: 700, style: "normal" },
      ],
    },
  );

  const bytes = new Uint8Array(await image.arrayBuffer());
  const uploaded = await admin.storage.from("cards").upload(key, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (uploaded.error) console.error(uploaded.error);
  return bytes;
}

export function pngResponse(bytes: Uint8Array, downloadName?: string) {
  const headers = new Headers({
    "Content-Type": "image/png",
    "Cache-Control": "private, max-age=3600",
  });
  if (downloadName) {
    headers.set("Content-Disposition", `attachment; filename="${downloadName}"`);
  }
  return new Response(Buffer.from(bytes), { headers });
}

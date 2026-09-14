import { CARD_SIZE, getOrCreateCueCardPng, pngResponse } from "@/lib/card-png";
import { SHARE_TOKEN } from "@/lib/ids";
import { getSharePlayable } from "@/lib/shares";

export const alt = "Bigboom";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function ShareOpengraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!SHARE_TOKEN.test(token)) {
    return new Response("Gone", { status: 410 });
  }
  const result = await getSharePlayable(token);
  if (result.status !== "ok") {
    return new Response("Gone", { status: 410 });
  }
  const png = await getOrCreateCueCardPng(result.share.cueId);
  if (!png) return new Response("Gone", { status: 410 });
  return pngResponse(png);
}

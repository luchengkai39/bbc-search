import { NextRequest } from "next/server";
import { getOrCreateCueCardPng, pngResponse } from "@/lib/card-png";
import { UUID } from "@/lib/ids";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID.test(id)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const png = await getOrCreateCueCardPng(id);
    if (!png) return Response.json({ error: "not_found" }, { status: 404 });
    const download = request.nextUrl.searchParams.get("download") === "1";
    return pngResponse(png, download ? `bigboom-${id.slice(0, 8)}.png` : undefined);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "card_failed" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { searchClips } from "@/lib/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const season = Number(request.nextUrl.searchParams.get("season") ?? "1");
  if (!Number.isFinite(season) || season < 1) {
    return Response.json({ error: "invalid season" }, { status: 400 });
  }

  try {
    const clips = await searchClips(q, season);
    return Response.json({ clips });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "search_failed" }, { status: 500 });
  }
}

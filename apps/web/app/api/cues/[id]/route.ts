import { NextRequest } from "next/server";
import { getCueDetail, getCuePlayable } from "@/lib/cues";
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
    const lite = request.nextUrl.searchParams.get("lite") === "1";
    const cue = lite ? await getCuePlayable(id) : await getCueDetail(id);
    if (!cue) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ cue });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "cue_failed" }, { status: 500 });
  }
}

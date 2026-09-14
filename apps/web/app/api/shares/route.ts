import { createShare } from "@/lib/shares";
import { UUID } from "@/lib/ids";

export async function POST(request: Request) {
  let cueId = "";
  try {
    const body = (await request.json()) as { cueId?: unknown };
    cueId = typeof body.cueId === "string" ? body.cueId : "";
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!UUID.test(cueId)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const share = await createShare(cueId);
    if (!share) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({
      token: share.token,
      path: `/s/${share.token}`,
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "share_failed" }, { status: 500 });
  }
}

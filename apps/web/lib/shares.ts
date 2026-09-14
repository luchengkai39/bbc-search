import { cache } from "react";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCuePlayable, getReadyCueRow, type CuePlayable } from "@/lib/cues";
import { UUID } from "@/lib/ids";

export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ShareRecord = {
  token: string;
  cueId: string;
  expiresAt: string;
};

function newToken() {
  return randomBytes(18).toString("base64url");
}

export async function createShare(cueId: string): Promise<ShareRecord | null> {
  if (!UUID.test(cueId)) return null;
  const cue = await getReadyCueRow(cueId);
  if (!cue) return null;

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("shares")
    .select("token, cue_id, expires_at")
    .eq("cue_id", cueId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return {
      token: existing.token,
      cueId: existing.cue_id,
      expiresAt: existing.expires_at,
    };
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS).toISOString();
  const { data, error } = await admin
    .from("shares")
    .insert({ token, cue_id: cueId, expires_at: expiresAt })
    .select("token, cue_id, expires_at")
    .single();
  if (error) throw error;
  return { token: data.token, cueId: data.cue_id, expiresAt: data.expires_at };
}

export const lookupShare = cache(async (token: string): Promise<ShareRecord | null> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("shares")
    .select("token, cue_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return { token: data.token, cueId: data.cue_id, expiresAt: data.expires_at };
});

export async function getSharePlayable(
  token: string,
): Promise<{ status: "ok"; share: ShareRecord; cue: CuePlayable } | { status: "invalid" }> {
  const share = await lookupShare(token);
  if (!share) return { status: "invalid" };
  const cue = await getCuePlayable(share.cueId);
  if (!cue) return { status: "invalid" };
  return { status: "ok", share, cue };
}

export async function bumpShareHit(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("shares").select("hit_count").eq("token", token).maybeSingle();
  if (!data) return;
  const { error } = await admin
    .from("shares")
    .update({ hit_count: (data.hit_count ?? 0) + 1 })
    .eq("token", token);
  if (error) console.error(error);
}

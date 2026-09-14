import { createAdminClient } from "@/lib/supabase/admin";

export async function signStorageUrls(
  bucket: "thumbs" | "clips" | "cards",
  keys: string[],
  expiresSec = 3600,
) {
  const unique = [...new Set(keys.filter(Boolean))];
  const signed = new Map<string, string>();
  if (unique.length === 0) return signed;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrls(unique, expiresSec);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
  }
  return signed;
}

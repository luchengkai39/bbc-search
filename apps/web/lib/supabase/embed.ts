/** Supabase embeds a many-to-one join as T or T[]. Normalize to one row. */
export function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

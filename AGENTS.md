# Bigboom

Yarn-style bilingual quote search for *The Big Bang Theory*. Original MP4/SRT live in a **private R2** bucket. Ingest downloads them to `data/work` only while ffmpeg runs, then deletes the copies. Supabase holds cue metadata and short derived clips.

Full implementation handbook (Chinese): [`实现手册.md`](./实现手册.md).

## Layers

| Layer | Path | Allowed | Forbidden |
| --- | --- | --- | --- |
| L1 ingest | `scripts/ingest/` | ffmpeg, temp download from R2, Service Role upload | committing media, keeping source episodes on disk |
| L2 derived | Supabase buckets `thumbs` `clips` `cards` | JPEG thumbs, ≤4s 360p mp4, share PNGs | serving full episodes |
| L2 source | R2 `raw/video` `raw/subs` | private originals | public bucket, listing on the website |
| L3 data | `supabase/migrations/` `packages/db/` | cue rows, storage keys, search | local disk paths, base64 media |
| L4 API | `apps/web/app/api/` | signed URLs (1h), search, shares | ffmpeg, exposing Service Role / R2 keys |
| L5 UI | `apps/web/app/` `apps/web/components/` | search grid, player, share page | card autoplay, public clip dumps |

## Layout

```
apps/web/                 Next.js App Router
packages/db/              Drizzle schema
scripts/ingest/           local CLI only
supabase/migrations/      SQL source
data/work/                gitignored temp (deleted after each episode)
```

R2 object keys:

```
raw/video/TBBT_S01E01.mp4
raw/subs/TBBT_S01E01.en.srt
raw/subs/TBBT_S01E01.zh.srt
```

## Secrets

- Client may use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` and all `R2_*` keys only in `scripts/.env` / server env. Never `NEXT_PUBLIC_`.

## Product guards

- Index clips max 4 seconds. MVP does not recut on the server.
- Share pages are `noindex`; R2 raw prefix and Supabase buckets are private.
- Free-tier derived ingest: Season 1 visuals only until Pro.
- Do not scrape or host unlicensed episode files. Do not make the raw bucket public.

## Commands

```bash
pnpm ingest -- --push-raw --episode S01E01
pnpm ingest -- --episode S01E01 --dry-run
pnpm ingest -- --episode S01E01 --limit 5
```

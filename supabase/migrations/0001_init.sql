-- Bigboom L3: metadata only. Storage keys, never local disk paths or source video.
-- Cost: full-series dialogue is tens of MB. Visuals live in L2 buckets, not these tables.
-- Idempotent: a failed remote push may have created types/tables before the function.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

do $$ begin
  create type public.align_status as enum ('aligned', 'en_only', 'zh_only');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.media_status as enum ('pending', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_en text not null,
  title_zh text not null
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  season integer not null,
  episode integer not null,
  title_en text not null default '',
  title_zh text not null default '',
  duration_ms integer,
  -- Filename only, e.g. TBBT_S01E01.mp4. Never a drive path.
  source_label text,
  constraint episodes_show_season_episode_uidx unique (show_id, season, episode)
);

create table if not exists public.cues (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  start_ms integer not null,
  end_ms integer not null,
  text_en text not null default '',
  text_zh text not null default '',
  align_status public.align_status not null default 'aligned',
  -- L2 object keys, e.g. tbbt/s01/e01/{cue_id}.jpg
  thumb_key text,
  clip_key text,
  clip_duration_ms integer,
  media_status public.media_status not null default 'pending',
  search_en tsvector generated always as (
    to_tsvector('english', coalesce(text_en, ''))
  ) stored,
  created_at timestamptz not null default now(),
  constraint cues_episode_span_uidx unique (episode_id, start_ms, end_ms),
  constraint cues_span_check check (end_ms > start_ms),
  constraint cues_clip_duration_check check (
    clip_duration_ms is null
    or (clip_duration_ms > 0 and clip_duration_ms <= 4000)
  )
);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  cue_id uuid not null references public.cues (id) on delete cascade,
  expires_at timestamptz not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists cues_episode_start_idx on public.cues (episode_id, start_ms);
create index if not exists cues_search_en_gin_idx on public.cues using gin (search_en);
create index if not exists cues_text_en_trgm_idx on public.cues using gin (text_en extensions.gin_trgm_ops);
create index if not exists cues_text_zh_trgm_idx on public.cues using gin (text_zh extensions.gin_trgm_ops);
create index if not exists cues_ready_idx on public.cues (episode_id) where media_status = 'ready';
create index if not exists shares_token_expires_idx on public.shares (expires_at);

comment on table public.shows is 'Show catalog. MVP has a single TBBT row.';
comment on table public.episodes is 'Episode metadata. source_label is a filename, not a filesystem path.';
comment on table public.cues is 'Aligned bilingual lines bound to L2 thumb/clip keys by cue id.';
comment on table public.shares is 'Private share tokens. Anon may read unexpired rows only; writes are service_role.';
comment on column public.cues.thumb_key is 'Private Storage key in bucket thumbs.';
comment on column public.cues.clip_key is 'Private Storage key in bucket clips. Null when thumbs-only.';

-- Input param cannot be named season/episode: RETURNS TABLE already exposes those as OUT params.
create or replace function public.search_cues(q text, p_season integer default null)
returns table (
  id uuid,
  episode_id uuid,
  start_ms integer,
  end_ms integer,
  text_en text,
  text_zh text,
  align_status public.align_status,
  thumb_key text,
  clip_key text,
  clip_duration_ms integer,
  season integer,
  episode integer,
  episode_title_en text,
  episode_title_zh text
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  q_trim text := trim(both from coalesce(q, ''));
  q_like text;
  tsquery_en tsquery;
begin
  if q_trim = '' then
    return;
  end if;

  q_like := '%' || replace(replace(replace(q_trim, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  begin
    tsquery_en := websearch_to_tsquery('english', q_trim);
  exception
    when others then
      tsquery_en := plainto_tsquery('english', q_trim);
  end;

  return query
  select
    c.id,
    c.episode_id,
    c.start_ms,
    c.end_ms,
    c.text_en,
    c.text_zh,
    c.align_status,
    c.thumb_key,
    c.clip_key,
    c.clip_duration_ms,
    e.season,
    e.episode,
    e.title_en,
    e.title_zh
  from public.cues c
  inner join public.episodes e on e.id = c.episode_id
  where c.media_status = 'ready'
    and (p_season is null or e.season = p_season)
    and (
      (tsquery_en is not null and c.search_en @@ tsquery_en)
      or c.text_en ilike q_like escape '\'
      or c.text_zh ilike q_like escape '\'
      or similarity(c.text_en, q_trim) > 0.2
      or similarity(c.text_zh, q_trim) > 0.2
    )
  order by
    greatest(
      coalesce(ts_rank(c.search_en, coalesce(tsquery_en, ''::tsquery)), 0),
      similarity(c.text_en, q_trim),
      similarity(c.text_zh, q_trim)
    ) desc,
    c.start_ms asc
  limit 48;
end;
$$;

grant usage on schema extensions to anon, authenticated, service_role;
grant execute on function public.search_cues(text, integer) to anon, authenticated, service_role;

alter table public.shows enable row level security;
alter table public.episodes enable row level security;
alter table public.cues enable row level security;
alter table public.shares enable row level security;

drop policy if exists shows_select_all on public.shows;
drop policy if exists episodes_select_all on public.episodes;
drop policy if exists cues_select_ready on public.cues;
drop policy if exists shares_select_unexpired on public.shares;

create policy shows_select_all on public.shows
  for select to anon, authenticated using (true);

create policy episodes_select_all on public.episodes
  for select to anon, authenticated using (true);

create policy cues_select_ready on public.cues
  for select to anon, authenticated using (media_status = 'ready');

create policy shares_select_unexpired on public.shares
  for select to anon, authenticated using (expires_at > now());

-- Anon/authenticated have no insert/update/delete. service_role bypasses RLS (L1 ingest, L4 share writes).

grant select on table public.shows, public.episodes, public.cues, public.shares
  to anon, authenticated;

insert into public.shows (slug, title_en, title_zh)
values ('tbbt', 'The Big Bang Theory', '生活大爆炸')
on conflict (slug) do nothing;

-- L2: derived media only. Private buckets; browsers use 1-hour signed URLs from L4.
-- No storage.objects SELECT policy on purpose: anon cannot list or download unsigned.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('thumbs', 'thumbs', false, 524288, array['image/jpeg']::text[]),
  ('clips', 'clips', false, 2097152, array['video/mp4']::text[]),
  ('cards', 'cards', false, 1048576, array['image/png']::text[])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

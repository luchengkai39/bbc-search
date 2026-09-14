-- Acceptance: insert one ready cue, search_cues('bazinga' / '巴津加') must return it.
-- Run after migrations: npx supabase db query --local -f supabase/tests/search_cues.sql

with show as (
  select id from public.shows where slug = 'tbbt'
),
ep as (
  insert into public.episodes (show_id, season, episode, title_en, title_zh, source_label)
  select id, 1, 1, 'Pilot', '试播集', 'TBBT_S01E01.mp4'
  from show
  on conflict on constraint episodes_show_season_episode_uidx do update
    set title_en = excluded.title_en,
        title_zh = excluded.title_zh,
        source_label = excluded.source_label
  returning id
),
upserted as (
  insert into public.cues (
    episode_id, start_ms, end_ms, text_en, text_zh,
    align_status, thumb_key, clip_key, clip_duration_ms, media_status
  )
  select
    ep.id, 12000, 14500,
    'Bazinga!', '巴津加！',
    'aligned',
    'tbbt/s01/e01/test-bazinga.jpg',
    'tbbt/s01/e01/test-bazinga.mp4',
    2500,
    'ready'
  from ep
  on conflict on constraint cues_episode_span_uidx do update
    set text_en = excluded.text_en,
        text_zh = excluded.text_zh,
        media_status = 'ready'
  returning id
)
select id from upserted;

select id, text_en, text_zh, season, episode
from public.search_cues('bazinga', 1);

select id, text_en, text_zh
from public.search_cues('巴津加', 1);

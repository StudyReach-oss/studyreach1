-- Historique des passages de robots IA (écrit par middleware.js).
-- Lecture/écriture réservées au service_role : RLS activée, AUCUNE policy
-- pour anon/authenticated → invisible depuis le frontend.

create table if not exists public.ai_bot_visits (
  id          bigint generated always as identity primary key,
  visited_at  timestamptz not null default now(),
  bot         text        not null,   -- ex. OAI-SearchBot, ChatGPT-User, GPTBot...
  path        text        not null,
  user_agent  text,
  country     text
);

create index if not exists ai_bot_visits_visited_at_idx on public.ai_bot_visits (visited_at desc);
create index if not exists ai_bot_visits_bot_visited_at_idx on public.ai_bot_visits (bot, visited_at desc);
create index if not exists ai_bot_visits_path_idx on public.ai_bot_visits (path);

alter table public.ai_bot_visits enable row level security;
revoke all on public.ai_bot_visits from anon, authenticated;

-- Vue de lecture rapide : passages par jour, par bot.
create or replace view public.ai_bot_visits_daily
with (security_invoker = true) as
select date_trunc('day', visited_at)::date as day, bot, count(*) as visits, count(distinct path) as pages
from public.ai_bot_visits
group by 1, 2
order by 1 desc, 2;
revoke all on public.ai_bot_visits_daily from anon, authenticated;

-- Exemple : pages les plus lues par OAI-SearchBot / ChatGPT-User sur 30 jours
-- select bot, path, count(*) from ai_bot_visits
-- where bot in ('OAI-SearchBot','ChatGPT-User') and visited_at > now() - interval '30 days'
-- group by 1,2 order by 3 desc;

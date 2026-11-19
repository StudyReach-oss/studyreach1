-- Compteur anonyme d'usage des outils gratuits (aucune donnée personnelle : outil, événement, type d'étude, date).
-- Insertion seule pour le public (clé anon) ; lecture réservée au dashboard / service role.
create table if not exists public.outils_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tool text not null check (tool in ('generateur-consentement')),
  event text not null check (event in ('generate','copy','pdf','docx','txt','print')),
  mode text check (mode in ('academique','marketing'))
);

alter table public.outils_events enable row level security;

revoke all on public.outils_events from anon, authenticated;
grant insert on public.outils_events to anon;

drop policy if exists "outils_events_insert_public" on public.outils_events;
create policy "outils_events_insert_public" on public.outils_events
  for insert to anon with check (true);

comment on table public.outils_events is 'Compteur anonyme d''usage des outils gratuits StudyReach. Insertion seule pour le public (RLS).';

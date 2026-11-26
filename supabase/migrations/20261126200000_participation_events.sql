-- Trace par participant de ce qu'il voit / fait sur l'écran de soumission d'une étude à lien externe.
-- Insertion seule pour l'utilisateur connecté (sur ses propres lignes) ; lecture réservée au dashboard / service role.
create table if not exists public.participation_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  study_id bigint not null,
  participant_id uuid not null default auth.uid(),
  event text not null check (event in ('done_modal_shown','submit_clicked','later_clicked','finish_confirm_shown','reminder_sent','reminder_used')),
  resumed boolean not null default false
);

create index if not exists participation_events_study_participant_idx
  on public.participation_events (study_id, participant_id, created_at);

alter table public.participation_events enable row level security;

revoke all on public.participation_events from anon, authenticated;
grant insert on public.participation_events to authenticated;

drop policy if exists "participation_events_insert_own" on public.participation_events;
create policy "participation_events_insert_own" on public.participation_events
  for insert to authenticated with check (participant_id = auth.uid());

comment on table public.participation_events is 'Événements de l''écran de soumission (fenêtre affichée, soumettre, plus tard, rappel). Insertion seule sur ses propres lignes (RLS).';

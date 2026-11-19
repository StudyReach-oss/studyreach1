-- Emails collectés par le générateur de consentement RGPD (public/generateur-consentement.html).
-- Insertion seule pour le public (clé anon) ; lecture réservée au service role / dashboard.
-- Déjà appliquée sur le projet bwaoxwfkqqpqvtpynwzh : fichier ajouté pour garder l'historique.
create table if not exists public.leads_outils (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  mode text check (mode in ('academique','marketing')),
  optin boolean not null default false,
  consent_text text not null check (char_length(consent_text) between 1 and 2000),
  source text not null default 'generateur-consentement'
);

alter table public.leads_outils enable row level security;

revoke all on public.leads_outils from anon, authenticated;
grant insert on public.leads_outils to anon;

drop policy if exists "leads_outils_insert_public" on public.leads_outils;
create policy "leads_outils_insert_public" on public.leads_outils
  for insert to anon with check (true);

comment on table public.leads_outils is 'Emails collectés par les outils gratuits StudyReach. Insertion seule pour le public (RLS), lecture réservée au service role.';

-- Infos RGPD affichées au participant avant de commencer (écran « Avant de participer »).
-- Colonnes ajoutées à studies ; publish_study les prend automatiquement (toute colonne existante de p_study).
-- À APPLIQUER AVANT de déployer le front : STUDIES_SAFE_COLUMNS les sélectionne.
alter table public.studies
  add column if not exists data_contact_email text check (data_contact_email is null or char_length(data_contact_email) <= 200),
  add column if not exists data_retention text check (data_retention is null or data_retention in ('3 mois','6 mois','1 an','2 ans','5 ans')),
  add column if not exists data_recording boolean not null default false,
  add column if not exists data_shared boolean not null default false;

grant select (data_contact_email, data_retention, data_recording, data_shared) on public.studies to anon, authenticated;

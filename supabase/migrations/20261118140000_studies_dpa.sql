-- Trace de l'acceptation de la clause de sous-traitance (CGU art. 7) à la publication d'une étude.
-- publish_study prend la colonne automatiquement ; les droits insert/update de studies sont au niveau table.
alter table public.studies add column if not exists dpa_accepted_at timestamptz;

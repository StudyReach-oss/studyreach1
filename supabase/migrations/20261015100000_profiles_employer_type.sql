-- Sous-catégorie d'employeur pour les participants salariés (Entreprise / Université/labo / Agence/Cabinet)
alter table public.profiles add column if not exists employer_type text;

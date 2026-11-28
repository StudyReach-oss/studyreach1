-- Colonne utilisée par App.jsx (PATCH {onboarded:true} à la fermeture du tour de bienvenue).
-- Absente en prod : chaque PATCH renvoyait 400 (PGRST204).
-- default true : les comptes existants ne revoient pas le tour.
alter table public.profiles
  add column if not exists onboarded boolean not null default true;

-- Étude test offerte : gratuite pour le chercheur, non rémunérée pour les participants.
-- Colonne additive (default false) : aucun impact sur les études existantes.
alter table public.studies add column if not exists is_test boolean not null default false;

-- Limites imposées côté base (pas seulement côté interface) :
-- coût 0, 5 ou 10 min, 1 à 5 participants, pas d'entretien IA.
alter table public.studies drop constraint if exists studies_test_limits;
alter table public.studies add constraint studies_test_limits check (
  not is_test or (
    coalesce(cost_per_participant, 0) = 0
    and max_participants between 1 and 5
    and duration in ('5 min', '10 min')
    and coalesce(ai, false) = false
    and coalesce(link_ai, false) = false
  )
);

-- Une seule étude test par chercheur.
create unique index if not exists studies_one_test_per_researcher
  on public.studies (researcher_id) where is_test;

-- Lecture de la colonne par les participants (droits par colonne sur studies).
grant select (is_test) on public.studies to anon, authenticated;

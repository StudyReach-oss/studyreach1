-- Étude Boost : accès anticipé réel aux nouvelles études rémunérées.
-- Un participant qui a terminé (ou soumis) une Étude Boost voit et reçoit chaque
-- nouvelle étude rémunérée BOOST_EARLY_ACCESS_MIN minutes avant les autres.
-- Tout est appliqué par la base (RLS + triggers) : l'application ne peut pas l'oublier.
-- ⚠️ À appliquer AVANT de déployer le nouveau App.jsx (il lit la colonne early_access_until).

-- 1) Durée de l'accès anticipé : un seul endroit à modifier (garder la même valeur
--    que BOOST_EARLY_ACCESS_MIN dans App.jsx, qui sert aux emails et aux libellés).
create or replace function public.boost_early_access_minutes()
 returns integer
 language sql
 immutable
as $$ select 10 $$;

-- 2) Fin de la fenêtre d'accès anticipé, par étude (null = pas de fenêtre).
alter table public.studies add column if not exists early_access_until timestamptz;
grant select (early_access_until) on public.studies to anon, authenticated;

create or replace function public.set_study_early_access()
 returns trigger
 language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.early_access_until := case
      when coalesce(new.is_test, false) then null
      else now() + make_interval(mins => public.boost_early_access_minutes())
    end;
  elsif coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    -- un chercheur ne peut pas modifier ni supprimer la fenêtre après coup
    new.early_access_until := old.early_access_until;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_study_early_access on public.studies;
create trigger trg_set_study_early_access
  before insert or update on public.studies
  for each row execute function public.set_study_early_access();

-- 3) Règle de visibilité : pendant la fenêtre, seules les personnes "Boost" voient l'étude.
--    Inchangé : chercheur (ses études), admin, has_joined_study(id).
drop policy if exists "Studies are viewable by authenticated users" on public.studies;
create policy "Studies are viewable by authenticated users" on public.studies as PERMISSIVE for SELECT to authenticated
  using (
    (
      status = 'active'::text
      and not is_researcher()
      and (not is_test or not has_done_free_study())
      and (early_access_until is null or early_access_until <= now() or has_done_free_study())
    )
    or auth.uid() = researcher_id
    or is_admin()
    or has_joined_study(id)
  );

-- 3 bis) Visiteurs non connectés (anon) : même règle, sinon la clé publique permettrait
--        de lire une étude pendant la fenêtre sans être Boost.
drop policy if exists "Active studies are publicly viewable" on public.studies;
create policy "Active studies are publicly viewable" on public.studies as PERMISSIVE for SELECT to anon
  using (status = 'active'::text and (early_access_until is null or early_access_until <= now()));

-- 4) Badge Boost côté chercheur : on fige sur la participation si le participant
--    avait le Boost au moment où il a rejoint l'étude.
create or replace function public.participant_has_boost(p_participant_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select exists (
    select 1
    from public.participations pa
    join public.studies s on s.id = pa.study_id
    where pa.participant_id = p_participant_id
      and pa.status in ('completed', 'pending_validation')
      and s.is_test
  );
$$;
revoke all on function public.participant_has_boost(uuid) from public, anon, authenticated;
grant execute on function public.participant_has_boost(uuid) to service_role;

alter table public.participations add column if not exists is_boost boolean not null default false;

create or replace function public.set_participation_boost()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.is_boost := public.participant_has_boost(new.participant_id);
  else
    new.is_boost := old.is_boost; -- non modifiable après coup
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_participation_boost on public.participations;
create trigger trg_set_participation_boost
  before insert or update on public.participations
  for each row execute function public.set_participation_boost();

-- 5) Pour les emails : la liste des participants Boost, réservée aux chercheurs/admin.
create or replace function public.boost_participant_ids()
 returns uuid[]
 language sql
 stable
 security definer
 set search_path to 'public'
as $$
  select case
    when public.is_researcher() or public.is_admin() then (
      select coalesce(array_agg(distinct pa.participant_id), '{}'::uuid[])
      from public.participations pa
      join public.studies s on s.id = pa.study_id
      where s.is_test and pa.status in ('completed', 'pending_validation')
    )
    else '{}'::uuid[]
  end;
$$;
revoke all on function public.boost_participant_ids() from public, anon;
grant execute on function public.boost_participant_ids() to authenticated, service_role;

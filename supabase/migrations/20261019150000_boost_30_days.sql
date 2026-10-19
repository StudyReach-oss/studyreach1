-- Boost : l'avant-première dure 30 jours (au lieu de "à vie").
-- Un participant est Boost s'il a terminé ou soumis une Étude Boost il y a moins de 30 jours.
-- Chaque nouvelle Étude Boost terminée repart pour 30 jours (la date la plus récente compte).
-- ⚠️ À appliquer AVANT de déployer le nouveau App.jsx.

-- 1) Durée du Boost : un seul endroit à modifier.
create or replace function public.boost_duration_days()
 returns integer
 language sql
 immutable
as $$ select 30 $$;

-- 2) Le participant connecté est-il Boost en ce moment ? (utilisé par les règles RLS)
create or replace function public.has_done_free_study()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.participations pa
    join public.studies s on s.id = pa.study_id
    where pa.participant_id = auth.uid()
      and pa.status in ('completed', 'pending_validation')
      and s.is_test
      and coalesce(pa.completed_at, pa.created_at) > now() - make_interval(days => public.boost_duration_days())
  );
$function$;

revoke all on function public.has_done_free_study() from public, anon;
grant execute on function public.has_done_free_study() to authenticated, service_role;

-- 3) Visibilité : les Études Boost restent visibles pour tous (les études déjà faites sont
--    déjà masquées par l'application), ce qui permet de renouveler le Boost avant la fin des 30 jours.
--    Avant-première : seules les personnes Boost voient une étude rémunérée pendant la fenêtre.
drop policy if exists "Studies are viewable by authenticated users" on public.studies;
create policy "Studies are viewable by authenticated users" on public.studies as PERMISSIVE for SELECT to authenticated
  using (
    (
      status = 'active'::text
      and not is_researcher()
      and (early_access_until is null or early_access_until <= now() or has_done_free_study())
    )
    or auth.uid() = researcher_id
    or is_admin()
    or has_joined_study(id)
  );

-- 4) Badge Boost côté chercheur (figé à l'inscription à l'étude) : Boost actif à cette date.
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
      and coalesce(pa.completed_at, pa.created_at) > now() - make_interval(days => public.boost_duration_days())
  );
$$;
revoke all on function public.participant_has_boost(uuid) from public, anon, authenticated;
grant execute on function public.participant_has_boost(uuid) to service_role;

-- 5) Emails : liste des participants Boost actifs (chercheurs/admin uniquement).
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
      where s.is_test
        and pa.status in ('completed', 'pending_validation')
        and coalesce(pa.completed_at, pa.created_at) > now() - make_interval(days => public.boost_duration_days())
    )
    else '{}'::uuid[]
  end;
$$;
revoke all on function public.boost_participant_ids() from public, anon;
grant execute on function public.boost_participant_ids() to authenticated, service_role;

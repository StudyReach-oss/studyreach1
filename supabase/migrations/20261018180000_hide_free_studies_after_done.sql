-- Étude offerte : un participant qui en a déjà terminé une ne la voit plus jamais
-- (ni liste, ni notification) quand une nouvelle étude offerte est publiée.
-- Le masquage est fait par la base elle-même (RLS) : l'application n'a plus
-- besoin de vérifier quoi que ce soit, et ne peut pas l'oublier.

-- Vrai si l'utilisateur connecté a déjà terminé (ou soumis à validation) une étude test.
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
  );
$function$;

revoke all on function public.has_done_free_study() from public, anon;
grant execute on function public.has_done_free_study() to authenticated, service_role;

-- Même règle qu'avant, avec une condition de plus : une étude test active n'est
-- visible que si le participant n'en a pas déjà terminé une.
-- Inchangé : chercheur (ses études), admin, et has_joined_study(id) — le participant
-- continue donc de voir son ancienne étude test dans son historique.
drop policy if exists "Studies are viewable by authenticated users" on public.studies;
create policy "Studies are viewable by authenticated users" on public.studies as PERMISSIVE for SELECT to authenticated
  using (
    (
      status = 'active'::text
      and not is_researcher()
      and (not is_test or not has_done_free_study())
    )
    or auth.uid() = researcher_id
    or is_admin()
    or has_joined_study(id)
  );

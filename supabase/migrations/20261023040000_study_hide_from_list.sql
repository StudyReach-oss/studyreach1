-- Retirer une étude FERMÉE de la liste « Mes études » sans rien perdre.
--
-- Pourquoi pas un DELETE : participations, interviews, slots et video_recordings ont
-- ON DELETE CASCADE vers studies → supprimer l'étude effacerait les preuves de
-- paiement des participants, les rapports IA, les enregistrements, etc.
-- On masque donc l'étude de la liste ; elle reste visible dans l'onglet « Historique ».

alter table public.studies
  add column if not exists hidden_by_researcher_at timestamptz;

-- get_my_studies() fait « select * » → la nouvelle colonne est renvoyée au chercheur
-- (anon/authenticated n'ont pas de droit SELECT direct sur cette colonne : voulu).
create or replace function public.get_my_studies()
 returns setof studies
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select *
  from public.studies
  where researcher_id = auth.uid();
$function$;

-- Masque / réaffiche une étude. Uniquement ses propres études ET uniquement si fermée.
create or replace function public.hide_closed_study(p_study_id bigint, p_hidden boolean default true)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;

  update public.studies
     set hidden_by_researcher_at = case when p_hidden then now() else null end
   where id = p_study_id
     and researcher_id = auth.uid()
     and status = 'closed';

  if not found then
    raise exception 'Étude introuvable ou pas encore fermée';
  end if;
end;
$function$;

revoke all on function public.hide_closed_study(bigint, boolean) from public, anon;
grant execute on function public.hide_closed_study(bigint, boolean) to authenticated, service_role;

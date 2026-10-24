-- Archivage d'une étude par le chercheur (déjà appliquée en prod, version 20261023165951).
-- Fichier ajouté pour réaligner le dépôt avec la base.

alter table public.studies add column if not exists archived_at timestamptz;

create or replace function public.set_study_archived(p_study_id bigint, p_archived boolean default true)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rows integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.studies
     set archived_at = case when p_archived then now() else null end
   where id = p_study_id
     and researcher_id = auth.uid()
     and (not p_archived or coalesce(status, 'active') not in ('active', 'pending_payment'));

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$function$;

revoke all on function public.set_study_archived(bigint, boolean) from public, anon;
grant execute on function public.set_study_archived(bigint, boolean) to authenticated, service_role;

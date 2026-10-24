-- Motif de refus d'une participation (saisi par le chercheur, facultatif).
alter table public.participations add column if not exists rejection_reason text;

-- Nouvelle signature (motif optionnel) : on remplace l'ancienne pour éviter toute ambiguïté d'appel.
drop function if exists public.refund_reject_participation(bigint);

create or replace function public.refund_reject_participation(
  p_participation_id bigint,
  p_reason text default null
)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_part participations%rowtype;
  v_study studies%rowtype;
  v_wallet numeric;
begin
  select * into v_part from participations where id = p_participation_id for update;
  if not found then
    raise exception 'Participation introuvable';
  end if;

  select * into v_study from studies
   where id = v_part.study_id and researcher_id = auth.uid();
  if not found then
    raise exception 'Non autorise';
  end if;

  if v_part.paid = true then
    raise exception 'Participation deja validee et creditee';
  end if;

  if v_part.auto_validated = true then
    raise exception 'Participation deja auto-validee : paiement garanti, refus impossible';
  end if;

  if v_part.status = 'rejected' then
    select wallet into v_wallet from profiles where id = auth.uid();
    return v_wallet;
  end if;

  update participations
     set status = 'rejected',
         rejection_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
   where id = p_participation_id;
  update interviews set status = 'rejected'
   where study_id = v_part.study_id and participant_id = v_part.participant_id
     and status = 'pending_validation';

  perform set_config('app.wallet_op','1',true);
  update profiles set wallet = round((coalesce(wallet,0) + coalesce(v_study.cost_per_participant,0))::numeric,2)
   where id = auth.uid();

  select wallet into v_wallet from profiles where id = auth.uid();
  return v_wallet;
end;
$function$;

revoke all on function public.refund_reject_participation(bigint, text) from public, anon;
grant execute on function public.refund_reject_participation(bigint, text) to authenticated, service_role;

-- Remboursement à la clôture d'une étude : ne rembourser que si le budget a réellement été bloqué
-- (étude test gratuite ou jamais financée => aucun crédit de portefeuille).
-- Version identique à celle appliquée en prod (20261021074505), ajoutée ici pour réaligner le dépôt.

create or replace function public.refund_study_close(p_study_id bigint)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_study studies%rowtype;
  v_validated int;
  v_rejected int;
  v_refund_slots int;
  v_refund numeric;
  v_wallet numeric;
begin
  select * into v_study from studies
   where id = p_study_id and researcher_id = auth.uid() for update;
  if not found then
    raise exception 'Etude introuvable ou non autorisee';
  end if;

  if v_study.status = 'closed' then
    select wallet into v_wallet from profiles where id = auth.uid();
    return v_wallet;
  end if;

  select count(*) into v_validated from participations
    where study_id = p_study_id and (paid = true or auto_validated = true);
  select count(*) into v_rejected from participations
    where study_id = p_study_id and status in ('rejected','abandoned');

  v_refund_slots := greatest(0, coalesce(v_study.max_participants,0) - v_validated - v_rejected);
  v_refund := round((v_refund_slots * coalesce(v_study.cost_per_participant,0))::numeric, 2);

  if not coalesce(v_study.budget_blocked, false) then
    v_refund := 0;
  end if;

  update studies set status = 'closed' where id = p_study_id;
  update participations set status = 'rejected'
   where study_id = p_study_id and status in ('pending_validation','joined','interview')
     and auto_validated is distinct from true;

  if v_refund > 0 then
    perform set_config('app.wallet_op','1',true);
    update profiles set wallet = round((coalesce(wallet,0) + v_refund)::numeric,2)
     where id = auth.uid();
  end if;

  select wallet into v_wallet from profiles where id = auth.uid();
  return v_wallet;
end;
$function$;

-- Garde-fou sur les champs financiers de public.studies.
--
-- PROBLÈME : la policy "Researchers can update their own studies" autorise le chercheur à
-- modifier N'IMPORTE QUELLE colonne de sa propre étude, sans trigger de protection. Or
-- api/payout.js calcule le montant du retrait d'un participant à partir de
-- studies.cost_per_participant AU MOMENT du retrait. Un chercheur pouvait donc :
--   - passer cost_per_participant à une grosse valeur APRÈS le blocage du budget (ou sur
--     l'étude test gratuite, en repassant is_test à false), valider un second compte
--     participant, puis le faire retirer : l'argent sort du solde Stripe plateforme
--     sans avoir jamais été encaissé ;
--   - se mettre budget_blocked = true lui-même (UPDATE ou INSERT direct) pour que la
--     fonction block_study_budget() ne débite jamais son portefeuille.
--
-- CORRECTIF : trigger BEFORE INSERT/UPDATE.
--   1) budget_blocked ne peut être positionné à true QUE par les fonctions serveur qui
--      posent app.wallet_op = '1' (block_study_budget, activation par virement) ou par
--      le service_role / un admin.
--   2) cost_per_participant, max_participants, ai, is_test sont figés dès que le budget
--      est bloqué ou que l'étude est une étude test.
--
-- Rien ne change pour le service_role, les admins, ni les modifications d'une étude
-- non financée (brouillon, en attente de paiement).

create or replace function public.guard_study_money_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Serveur (webhook, crons, edge functions) et sessions sans JWT (SQL editor) : autorisé.
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.budget_blocked, false) then
      raise exception 'budget_blocked ne peut pas etre defini directement';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.budget_blocked is distinct from old.budget_blocked
     and coalesce(current_setting('app.wallet_op', true), '') <> '1' then
    raise exception 'Modification directe de budget_blocked non autorisee';
  end if;

  if (coalesce(old.budget_blocked, false) or coalesce(old.is_test, false))
     and (
       new.cost_per_participant is distinct from old.cost_per_participant
       or new.max_participants is distinct from old.max_participants
       or new.ai is distinct from old.ai
       or new.is_test is distinct from old.is_test
     ) then
    raise exception 'Cout, nombre de participants, IA et mode test non modifiables une fois le budget bloque';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_study_money_fields on public.studies;
create trigger trg_guard_study_money_fields
  before insert or update on public.studies
  for each row execute function public.guard_study_money_fields();

-- Même politique d'accès que les autres fonctions de garde du schéma.
grant execute on function public.guard_study_money_fields() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- À LANCER À LA MAIN dans le SQL Editor (lecture seule) avant/après :
--
-- a) Retraits déjà possibles sur des études non financées (devrait renvoyer 0 ligne) :
--    select p.id, p.study_id, s.cost_per_participant, s.is_test, s.budget_blocked
--      from public.participations p
--      join public.studies s on s.id = p.study_id
--     where p.paid = true and p.paid_to_bank = false and s.budget_blocked = false;
--
-- b) Coûts suspects : études dont le coût est très supérieur à la moyenne :
--    select id, researcher_id, cost_per_participant, max_participants, is_test, budget_blocked
--      from public.studies order by cost_per_participant desc limit 20;
-- ---------------------------------------------------------------------

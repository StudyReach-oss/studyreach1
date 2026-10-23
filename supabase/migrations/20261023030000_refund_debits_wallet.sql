-- Remboursement Stripe d'une recharge → débit du portefeuille.
--
-- Cas couverts (appelée UNIQUEMENT par api/webhook.js, event charge.refunded, via service_role) :
--   • remboursement (total ou partiel) d'une recharge par carte ;
--   • remboursement d'une recharge par virement (vers la banque ou vers le solde client Stripe) ;
--   • remboursement d'un excédent / virement sans commande converti en recharge.
--
-- Principes :
--   • IDEMPOTENT et basé sur l'état : on compare le cumul remboursé côté Stripe (charge.amount_refunded)
--     à ce qui a déjà été débité (somme des lignes 'recharge_refund' du même PaymentIntent). Un event rejoué,
--     reçu en double ou dans le désordre ne débite jamais deux fois.
--   • Jamais de solde négatif : on débite au maximum le solde disponible. Si le chercheur a déjà dépensé
--     l'argent (études financées), le manque est renvoyé dans 'shortfall' pour alerte admin.
--   • Le verrou sur la ligne profiles sérialise deux events simultanés.
--   • Lignes de transactions : type 'recharge_refund', amount = montant réellement débité,
--     total = montant remboursé traité (débit + manque).

create or replace function public.debit_wallet_for_refund(
  p_payment_intent_id text,
  p_total_refunded numeric,
  p_charge_id text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tx public.transactions%rowtype;
  v_wallet numeric;
  v_done numeric;
  v_todo numeric;
  v_debit numeric;
  v_short numeric;
begin
  if p_payment_intent_id is null or p_payment_intent_id = '' or p_total_refunded is null or p_total_refunded <= 0 then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- La recharge d'origine (carte, virement ou excédent) : sans elle, ce remboursement ne concerne pas le portefeuille.
  select * into v_tx
    from public.transactions
   where type = 'recharge' and stripe_payment_intent_id = p_payment_intent_id;
  if not found then
    return jsonb_build_object('status', 'not_a_recharge');
  end if;

  -- Verrou sur le profil (sérialise les events simultanés).
  select wallet into v_wallet from public.profiles where id = v_tx.user_id for update;
  if not found then
    return jsonb_build_object('status', 'no_profile', 'user_id', v_tx.user_id);
  end if;

  select coalesce(sum(total), 0) into v_done
    from public.transactions
   where type = 'recharge_refund' and stripe_payment_intent_id = p_payment_intent_id;

  -- On ne reprend jamais plus que ce qui a été crédité à l'origine.
  v_todo := round(least(p_total_refunded, v_tx.amount) - v_done, 2);
  if v_todo <= 0 then
    return jsonb_build_object('status', 'duplicate');
  end if;

  v_debit := least(greatest(coalesce(v_wallet, 0), 0), v_todo);
  v_short := round(v_todo - v_debit, 2);

  insert into public.transactions
    (user_id, type, amount, total, status, description, stripe_session_id, stripe_payment_intent_id, created_at)
  values
    (v_tx.user_id, 'recharge_refund', v_debit, v_todo, 'completed',
     'Remboursement Stripe d''une recharge' ||
       case when v_short > 0 then ' (solde insuffisant : ' || to_char(v_short, 'FM999999990.00') || '€ non repris)' else '' end,
     p_charge_id, p_payment_intent_id, now());

  if v_debit > 0 then
    perform set_config('app.wallet_op', '1', true);
    update public.profiles
       set wallet = round((coalesce(wallet, 0) - v_debit)::numeric, 2)
     where id = v_tx.user_id;
  end if;

  return jsonb_build_object(
    'status', 'debited',
    'user_id', v_tx.user_id,
    'refunded', v_todo,
    'debited', v_debit,
    'shortfall', v_short
  );
end;
$function$;

revoke all on function public.debit_wallet_for_refund(text, numeric, text) from public, anon, authenticated;
grant execute on function public.debit_wallet_for_refund(text, numeric, text) to service_role;

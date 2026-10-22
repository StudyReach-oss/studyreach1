-- Correctifs sécurité argent :
--   1) Un chercheur ne peut plus « défaire » un paiement participant (paid true -> false) ni toucher
--      à paid_to_bank : seul le service_role (api/payout.js) le peut. Il ne peut plus non plus marquer
--      « payée » une participation déjà rejetée / abandonnée (sinon double sortie d'argent : participant
--      payé + chercheur remboursé).
--   2) Crédit de recharge ATOMIQUE : insertion de la transaction + crédit du portefeuille dans UNE
--      seule transaction SQL (plus de risque « transaction loggée mais wallet jamais crédité »).
--
-- À appliquer AVANT de déployer api/webhook.js.

-- ---------------------------------------------------------------------------
-- 1) Garde-fou sur les champs de paiement des participations
-- ---------------------------------------------------------------------------
create or replace function public.guard_participation_payment_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Serveur (payout.js, webhooks, crons) : tout est permis.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Aucun champ de paiement modifié : rien à contrôler.
  if new.paid is not distinct from old.paid
     and new.paid_to_bank is not distinct from old.paid_to_bank
     and new.paid_at is not distinct from old.paid_at then
    return new;
  end if;

  -- paid_to_bank : réservé au serveur (retrait participant). Jamais modifiable depuis le navigateur.
  if new.paid_to_bank is distinct from old.paid_to_bank then
    raise exception 'paid_to_bank non modifiable directement';
  end if;

  -- Seul le chercheur propriétaire de l'étude peut valider une participation.
  if not exists (
    select 1 from public.studies s
    where s.id = new.study_id and s.researcher_id = auth.uid()
  ) then
    raise exception 'Modification du statut de paiement non autorisee';
  end if;

  -- Une validation (paid) est définitive : on ne peut pas la retirer, ni changer la date.
  if coalesce(old.paid, false) = true
     and (new.paid is distinct from old.paid or new.paid_at is distinct from old.paid_at) then
    raise exception 'Une participation validee ne peut plus etre modifiee';
  end if;

  -- Pas de validation d'une participation rejetée / abandonnée (elle a déjà été remboursée).
  if coalesce(new.paid, false) = true
     and coalesce(old.paid, false) = false
     and (old.status in ('rejected','abandoned','expired_unclaimed')
          or new.status in ('rejected','abandoned','expired_unclaimed')) then
    raise exception 'Validation impossible : participation rejetee ou abandonnee';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2) Crédit de recharge atomique (appelé uniquement par api/webhook.js, service_role)
--    Retourne : 'credited' | 'duplicate' | 'no_profile'
--    - duplicate  : ce PaymentIntent a déjà été crédité (idempotence via uniq_recharge_payment_intent)
--    - no_profile : compte introuvable → rien n'est enregistré (transaction annulée)
-- ---------------------------------------------------------------------------
create or replace function public.credit_wallet_recharge(
  p_user_id uuid,
  p_amount numeric,
  p_session_id text,
  p_payment_intent_id text,
  p_description text default 'Recharge portefeuille (Stripe)'
)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inserted int;
  v_updated int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_payment_intent_id is null or p_payment_intent_id = '' then
    raise exception 'payment_intent requis pour une recharge idempotente';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    return 'no_profile';
  end if;

  insert into public.transactions
    (user_id, type, amount, total, status, description, stripe_session_id, stripe_payment_intent_id, created_at)
  values
    (p_user_id, 'recharge', p_amount, p_amount, 'completed', p_description, p_session_id, p_payment_intent_id, now())
  on conflict (stripe_payment_intent_id)
    where type = 'recharge' and stripe_payment_intent_id is not null
  do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return 'duplicate';
  end if;

  perform set_config('app.wallet_op', '1', true);
  update public.profiles
     set wallet = round((coalesce(wallet, 0) + p_amount)::numeric, 2)
   where id = p_user_id;
  get diagnostics v_updated = row_count;

  -- Si le crédit n'a pas eu lieu, on annule TOUT (y compris la transaction insérée ci-dessus).
  if v_updated = 0 then
    raise exception 'Credit du portefeuille impossible (profil %)', p_user_id;
  end if;

  return 'credited';
end;
$function$;

revoke all on function public.credit_wallet_recharge(uuid, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.credit_wallet_recharge(uuid, numeric, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- À LANCER À LA MAIN (lecture seule) pour voir si la faille a déjà été exploitée :
--   participants dont un retrait existe mais dont la participation a été remise à non payée.
--   select p.id, p.study_id, p.participant_id, p.status, p.paid, p.paid_to_bank
--     from public.participations p
--    where p.paid = false
--      and exists (select 1 from public.transactions t
--                   where t.type = 'payout' and t.participant_id = p.participant_id
--                     and t.description like '%' || p.id::text || '%');
-- ---------------------------------------------------------------------------

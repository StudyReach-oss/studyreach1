-- Mise à jour finale de credit_wallet_recharge : ajoute le libellé de la ligne de facture
-- (ex. « Excédent de virement – crédit portefeuille ») et la colonne invoices.description.
-- Sans danger si 20261023000000 a déjà été appliquée OU non : cette migration remplace la fonction dans les deux cas.
-- ⚠️ À appliquer AVANT de déployer le nouveau api/webhook.js, et à déployer le webhook juste après.

-- 0) Une seule facture par PaymentIntent (garde-fou). Ne bloque pas la migration si des doublons existent déjà.
do $$
begin
  create unique index if not exists uniq_invoice_payment_intent
    on public.invoices (stripe_payment_intent_id)
    where stripe_payment_intent_id is not null;
exception when others then
  raise notice 'Index uniq_invoice_payment_intent non créé (doublons existants ?) : %', sqlerrm;
end $$;

-- 0bis) Libellé de la ligne de facture (ex. « Excédent de virement – crédit portefeuille »).
--       Vide = libellé par défaut « Recharge de portefeuille StudyReach » côté application.
alter table public.invoices add column if not exists description text;

-- 1) Nouvelle fonction (l'ancienne signature est supprimée)
drop function if exists public.credit_wallet_recharge(uuid, numeric, text, text, text);
drop function if exists public.credit_wallet_recharge(uuid, numeric, text, text, text, text, text, text);
drop function if exists public.credit_wallet_recharge(uuid, numeric, text, text, text, text, text, text, text);

create or replace function public.credit_wallet_recharge(
  p_user_id uuid,
  p_amount numeric,
  p_session_id text,
  p_payment_intent_id text,
  p_description text default 'Recharge portefeuille (Stripe)',
  p_payment_method text default 'card',
  p_po_number text default null,
  p_date_label text default null,
  p_invoice_label text default null
)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inserted int;
  v_updated int;
  v_prof public.profiles%rowtype;
  v_invoice_id text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;
  if p_payment_intent_id is null or p_payment_intent_id = '' then
    raise exception 'payment_intent requis pour une recharge idempotente';
  end if;

  select * into v_prof from public.profiles where id = p_user_id;
  if not found then
    return 'no_profile';
  end if;

  -- Idempotence : une seule recharge par PaymentIntent.
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

  -- Crédit du portefeuille
  perform set_config('app.wallet_op', '1', true);
  update public.profiles
     set wallet = round((coalesce(wallet, 0) + p_amount)::numeric, 2)
   where id = p_user_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Credit du portefeuille impossible (profil %)', p_user_id;
  end if;

  -- Facture : le compteur séquentiel est incrémenté DANS cette même transaction.
  -- Si quoi que ce soit échoue plus bas, tout est annulé (y compris le numéro) : aucun trou.
  v_invoice_id := public.next_invoice_number();
  insert into public.invoices
    (id, researcher_id, date, amount_cents, amount_display, status, stripe_payment_intent_id,
     researcher_name, researcher_company, researcher_email, payment_method, po_number, description)
  values
    (v_invoice_id, p_user_id,
     coalesce(p_date_label, to_char(now() at time zone 'Europe/Paris', 'DD/MM/YYYY')),
     round(p_amount * 100)::int,
     to_char(p_amount, 'FM999999990.00') || '€',
     'Payée', p_payment_intent_id,
     nullif(trim(coalesce(v_prof.first_name, '') || ' ' || coalesce(v_prof.last_name, '')), ''),
     v_prof.company, v_prof.email,
     coalesce(p_payment_method, 'card'),
     p_po_number, nullif(trim(coalesce(p_invoice_label, '')), ''));

  return 'credited';
end;
$function$;

revoke all on function public.credit_wallet_recharge(uuid, numeric, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.credit_wallet_recharge(uuid, numeric, text, text, text, text, text, text, text) to service_role;

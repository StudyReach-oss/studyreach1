-- Correctifs paiement par virement (suite de 20261020100000_bank_transfer_payments.sql)
-- ⚠️ À appliquer AVANT de déployer le nouveau code (api/ + App.jsx).
--
--   1) statut 'cancelled' : le chercheur peut retirer de sa liste un virement qu'il ne fera pas
--      (si l'argent arrive quand même, le webhook crédite le portefeuille normalement)
--   2) amount_remaining / overpaid_amount : virement incomplet / excédent visibles côté chercheur
--   3) numérotation SÉQUENTIELLE des factures (F-AAAA-00001…), au lieu d'un suffixe du PaymentIntent

-- 1) Statut « cancelled »
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.bank_transfer_orders'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.bank_transfer_orders drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.bank_transfer_orders
  add constraint bank_transfer_orders_status_check
  check (status in ('pending_checkout','awaiting_transfer','paid','failed','expired','cancelled'));

-- 2) Infos virement partiel / excédent (écrites par le webhook, lues par le chercheur via la RLS existante)
alter table public.bank_transfer_orders add column if not exists amount_remaining numeric(10,2);
alter table public.bank_transfer_orders add column if not exists overpaid_amount numeric(10,2);

-- 3) Numérotation séquentielle des factures (un compteur par année, sans trou tant que l'insertion réussit)
create table if not exists public.invoice_counters (
  year int primary key,
  last_value int not null default 0
);
alter table public.invoice_counters enable row level security;
revoke all on public.invoice_counters from public, anon, authenticated;

create or replace function public.next_invoice_number()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  y int := extract(year from (now() at time zone 'Europe/Paris'))::int;
  n int;
begin
  insert into public.invoice_counters (year, last_value) values (y, 1)
  on conflict (year) do update set last_value = public.invoice_counters.last_value + 1
  returning last_value into n;
  return 'F-' || y || '-' || lpad(n::text, 5, '0');
end;
$function$;
revoke all on function public.next_invoice_number() from public, anon, authenticated;
grant execute on function public.next_invoice_number() to service_role;

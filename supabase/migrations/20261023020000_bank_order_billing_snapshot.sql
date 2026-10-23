-- Infos de facturation FIGÉES sur chaque commande de virement : une facture émise ne change plus si le chercheur
-- modifie ensuite son adresse / sa TVA. Les anciennes commandes restent à NULL (le site retombe sur les infos actuelles).
-- Purement additif : aucune donnée existante n'est modifiée.
alter table public.bank_transfer_orders
  add column if not exists billing_name text,
  add column if not exists billing_address text,
  add column if not exists billing_vat_number text,
  add column if not exists billing_siret text;

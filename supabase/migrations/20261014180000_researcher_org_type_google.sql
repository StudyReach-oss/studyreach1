-- Inscription chercheur : type de structure + inscription via Google.
-- À exécuter une fois (SQL editor Supabase ou `supabase db push`).
-- Prérequis dashboard : Authentication > Providers > Google activé, et
-- https://www.getstudyreach.com/ dans Authentication > URL Configuration > Redirect URLs.

alter table public.profiles add column if not exists org_type text
  check (org_type is null or org_type in ('company','agency','univ','free'));

-- false = compte créé via Google, « Dernière étape » pas encore validée.
-- Default true : tous les comptes existants restent inchangés.
alter table public.profiles add column if not exists profile_completed boolean not null default true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update auth.users set email_confirmed_at = now() where id = new.id;
  insert into public.profiles (id, email, first_name, last_name, role, company, org_type, profile_completed, profession, profession_other, wallet, utm_source, utm_medium, utm_campaign, referrer_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'given_name', split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1), ''),
    coalesce(new.raw_user_meta_data->>'last_name', new.raw_user_meta_data->>'family_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'researcher'),
    new.raw_user_meta_data->>'company',
    nullif(new.raw_user_meta_data->>'org_type', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'google',
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'profession_other',
    0,
    new.raw_user_meta_data->>'utm_source',
    new.raw_user_meta_data->>'utm_medium',
    new.raw_user_meta_data->>'utm_campaign',
    new.raw_user_meta_data->>'referrer_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

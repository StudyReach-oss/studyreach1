-- Durcissement sécurité espace chercheur (audit du 23/10/2026)
--   1) publish_study : publication ATOMIQUE (création + créneaux + débit + activation en 1 transaction)
--   2) queue_study_notifications : matching + mise en file d'e-mails CÔTÉ SERVEUR
--   3) profiles_select_scoped : un chercheur ne lit plus TOUS les participants (fuite RGPD)
--   4) studies : suppression limitée aux études non payées (plus de cascade sur participations / preuves)
--   5) guard_participation_payment_fields : on ne paie que depuis pending_validation (ou auto-validé)
--   6) Fonctions de trigger retirées de l'API RPC, search_path figé partout
--
-- ORDRE DE DÉPLOIEMENT : appliquer cette migration AVANT le nouveau App.jsx.
-- (Le nouveau App.jsx dépend de publish_study et queue_study_notifications.)
-- Reste à faire à la main dans le dashboard Supabase : Auth > Passwords > activer
-- « Leaked password protection ».

-- ---------------------------------------------------------------------------
-- 1) Publication atomique
-- ---------------------------------------------------------------------------
create or replace function public.publish_study(
  p_study jsonb,
  p_slots jsonb default '[]'::jsonb,
  p_slot_capacity integer default 1
)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_cols text;
  v_id bigint;
  v_wallet numeric;
  v_cap integer := greatest(1, coalesce(p_slot_capacity, 1));
begin
  if v_uid is null then
    raise exception 'Non authentifie';
  end if;
  if not public.is_researcher() then
    raise exception 'Reserve aux chercheurs';
  end if;

  -- Colonnes autorisées = colonnes réelles de studies, hors champs pilotés par le serveur.
  select string_agg(quote_ident(k), ',')
    into v_cols
    from jsonb_object_keys(p_study) k
   where k in (select column_name from information_schema.columns
                where table_schema = 'public' and table_name = 'studies')
     and k not in ('id','researcher_id','status','budget_blocked','created_at',
                   'global_synthesis','early_access_until');
  if v_cols is null then
    raise exception 'Etude vide';
  end if;

  execute format(
    'insert into public.studies (researcher_id, status, %1$s)
     select $2, ''pending_payment'', %1$s from jsonb_populate_record(null::public.studies, $1)
     returning id', v_cols)
    into v_id using p_study, v_uid;

  if jsonb_typeof(coalesce(p_slots, '[]'::jsonb)) = 'array' and jsonb_array_length(p_slots) > 0 then
    insert into public.slots (study_id, datetime, taken)
    select v_id, (s.value #>> '{}')::timestamptz, false
      from jsonb_array_elements(p_slots) s
      cross join generate_series(1, v_cap);
  end if;

  -- Lève 'Solde insuffisant' => TOUT est annulé (étude + créneaux), aucune étude orpheline.
  v_wallet := public.block_study_budget(v_id);

  update public.studies set status = 'active'
   where id = v_id and researcher_id = v_uid and status = 'pending_payment';

  return jsonb_build_object('id', v_id, 'wallet', v_wallet);
end;
$function$;
revoke all on function public.publish_study(jsonb, jsonb, integer) from public, anon;
grant execute on function public.publish_study(jsonb, jsonb, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Matching côté serveur (port de computeMatchScore + inStudyZone du front)
-- ---------------------------------------------------------------------------
create or replace function public._crit_ok(p_crit jsonb, p_val jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $$
  select case
    when p_crit is null or jsonb_typeof(p_crit) = 'null' then true
    when jsonb_typeof(p_crit) = 'string' and p_crit #>> '{}' = '' then true
    when jsonb_typeof(p_crit) = 'boolean' and p_crit = 'false'::jsonb then true
    when jsonb_typeof(p_crit) = 'array' and jsonb_array_length(p_crit) = 0 then true
    when jsonb_typeof(p_crit) = 'array' and jsonb_typeof(p_val) = 'array'
      then exists (select 1 from jsonb_array_elements(p_crit) c
                    where c in (select v from jsonb_array_elements(p_val) v))
    when jsonb_typeof(p_crit) = 'array' and jsonb_typeof(p_val) = 'string'
      then p_crit @> jsonb_build_array(p_val)
    when jsonb_typeof(p_crit) = 'boolean' and jsonb_typeof(p_val) = 'boolean'
      then p_crit = p_val
    when jsonb_typeof(p_crit) = 'string' and jsonb_typeof(p_val) = 'string'
      then p_crit = p_val
    else false
  end;
$$;

create or replace function public._match_score(p_tc jsonb, p_profile jsonb)
 returns integer
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  score numeric := 0;
  total numeric := 0;
  r record;
  age integer;
  amin integer := nullif(nullif(p_tc->>'age_min',''),'0')::integer;
  amax integer := nullif(nullif(p_tc->>'age_max',''),'0')::integer;
  cities text[];
  pcity text := lower(coalesce(p_profile->>'city',''));
begin
  if p_tc is null or jsonb_typeof(p_tc) <> 'object' then return 100; end if;

  if amin is not null or amax is not null then
    total := total + 3;
    age := case when p_profile->>'birth_date' is null then null
      else floor(extract(epoch from (now() - (p_profile->>'birth_date')::timestamptz)) / 86400 / 365)::integer end;
    if age is null or age = 0 then score := score + 3;
    elsif (amin is null or age >= amin) and (amax is null or age <= amax) then score := score + 3;
    end if;
  end if;

  for r in
    select * from (values
      ('genre',2),('country',1),('status_pro',2),('sector',2),('education',1),
      ('devices',2),('tech_level',1),('has_camera',2),('languages',2),('mobile',1),
      ('long_term',1),('smoker',1),('alcohol',1),('income',1),('has_car',1),
      ('financial_products',1),('family_status',1),('housing_status',1),('themes',2)
    ) as t(k, w)
  loop
    total := total + r.w;
    if public._crit_ok(p_tc->r.k, p_profile->r.k) then score := score + r.w; end if;
  end loop;

  if coalesce(trim(p_tc->>'city'),'') <> '' then
    total := total + 1;
    select array_agg(lower(trim(c))) filter (where trim(c) <> '')
      into cities from unnest(string_to_array(p_tc->>'city', ',')) c;
    if exists (select 1 from unnest(coalesce(cities, '{}')) c
                where position(c in pcity) > 0 or position(pcity in c) > 0) then
      score := score + 1;
    end if;
  end if;

  if total = 0 then return 100; end if;
  return round(score / total * 100)::integer;
end;
$function$;

create or replace function public._in_study_zone(p_tc jsonb, p_profile jsonb)
 returns boolean
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  cities text[];
  pc text := lower(trim(coalesce(p_profile->>'city','')));
begin
  if p_tc is null or coalesce((p_tc->>'zone_restrict')::boolean, false) = false then return true; end if;
  if coalesce(trim(p_tc->>'country'),'') <> ''
     and lower(trim(coalesce(p_profile->>'country',''))) <> lower(trim(p_tc->>'country')) then
    return false;
  end if;
  if coalesce(trim(p_tc->>'city'),'') <> '' then
    select array_agg(lower(trim(c))) filter (where trim(c) <> '')
      into cities from unnest(string_to_array(p_tc->>'city', ',')) c;
    if pc = '' or not exists (select 1 from unnest(coalesce(cities,'{}')) c
                               where position(c in pc) > 0 or position(pc in c) > 0) then
      return false;
    end if;
  end if;
  return true;
end;
$function$;

-- Appelée par le chercheur après publication : met en file les e-mails des participants
-- correspondants. Le chercheur ne voit JAMAIS la liste ni leurs données : il reçoit un nombre.
create or replace function public.queue_study_notifications(
  p_study_id bigint,
  p_study_price numeric default null,
  p_study_type_label text default null
)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  s public.studies%rowtype;
  v_n integer;
begin
  select * into s from public.studies
   where id = p_study_id and researcher_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'Etude introuvable, non active ou non autorisee';
  end if;
  if coalesce(s.is_test, false) then
    return 0; -- l'e-mail « étude offerte » a son propre circuit
  end if;

  insert into public.study_email_queue (study_id, participant_id, study_price, study_type_label)
  select s.id, p.id, p_study_price, p_study_type_label
    from public.profiles p
   where p.role = 'participant'
     and p.email is not null
     and coalesce(p.suspended, false) = false
     and public._in_study_zone(s.target_criteria, to_jsonb(p))
     and public._match_score(s.target_criteria, to_jsonb(p)) >= 60
  on conflict (study_id, participant_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
revoke all on function public.queue_study_notifications(bigint, numeric, text) from public, anon;
grant execute on function public.queue_study_notifications(bigint, numeric, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Fuite RGPD : plus de lecture globale des participants par un chercheur
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles as PERMISSIVE for SELECT to public
  using (
    auth.uid() = id
    or is_admin()
    or exists (select 1 from participations pa join studies s on s.id = pa.study_id
                where s.researcher_id = auth.uid() and pa.participant_id = profiles.id)
    or exists (select 1 from participations pa join studies s on s.id = pa.study_id
                where pa.participant_id = auth.uid() and s.researcher_id = profiles.id)
  );

-- ---------------------------------------------------------------------------
-- 4) Suppression d'étude : uniquement une étude jamais payée et sans participation
-- ---------------------------------------------------------------------------
drop policy if exists "Researchers can delete their own studies" on public.studies;
create policy "Researchers can delete their own unpaid studies" on public.studies
  as PERMISSIVE for DELETE to authenticated
  using (
    auth.uid() = researcher_id
    and status = 'pending_payment'
    and coalesce(budget_blocked, false) = false
    and not exists (select 1 from public.participations pa where pa.study_id = studies.id)
  );

-- ---------------------------------------------------------------------------
-- 5) Paiement : seulement depuis pending_validation (ou auto-validé J14)
-- ---------------------------------------------------------------------------
create or replace function public.guard_participation_payment_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if new.paid is not distinct from old.paid
     and new.paid_to_bank is not distinct from old.paid_to_bank
     and new.paid_at is not distinct from old.paid_at then
    return new;
  end if;

  if new.paid_to_bank is distinct from old.paid_to_bank then
    raise exception 'paid_to_bank non modifiable directement';
  end if;

  if not exists (
    select 1 from public.studies s
    where s.id = new.study_id and s.researcher_id = auth.uid()
  ) then
    raise exception 'Modification du statut de paiement non autorisee';
  end if;

  if coalesce(old.paid, false) = true
     and (new.paid is distinct from old.paid or new.paid_at is distinct from old.paid_at) then
    raise exception 'Une participation validee ne peut plus etre modifiee';
  end if;

  if coalesce(new.paid, false) = true and coalesce(old.paid, false) = false then
    if old.status in ('rejected','abandoned','expired_unclaimed')
       or new.status in ('rejected','abandoned','expired_unclaimed') then
      raise exception 'Validation impossible : participation rejetee ou abandonnee';
    end if;
    -- Nouveau : on ne paie que ce qui est réellement soumis à validation.
    if old.status is distinct from 'pending_validation'
       and coalesce(old.auto_validated, false) = false then
      raise exception 'Validation impossible : la participation n''est pas en attente de validation';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6) Fonctions de trigger : plus appelables en RPC ; search_path figé partout
-- ---------------------------------------------------------------------------
revoke execute on function public.guard_interview_terminal_status() from public, anon, authenticated;
revoke execute on function public.guard_participation_payment_fields() from public, anon, authenticated;
revoke execute on function public.guard_participation_terminal_status() from public, anon, authenticated;
revoke execute on function public.guard_profile_wallet() from public, anon, authenticated;
revoke execute on function public.set_validation_deadline() from public, anon, authenticated;
do $$
begin
  if to_regprocedure('public.guard_study_money_fields()') is not null then
    execute 'revoke execute on function public.guard_study_money_fields() from public, anon, authenticated';
  end if;
end $$;

-- Fige le search_path de toute fonction du schéma public qui n'en a pas (hors extensions).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
  end loop;
end $$;

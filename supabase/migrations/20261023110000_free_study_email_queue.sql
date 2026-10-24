-- Étude offerte (is_test) : e-mails de notification via la file serveur.
-- Même circuit que les études payantes (matching serveur + pg_cron), avec en plus l'exclusion
-- des participants ayant déjà terminé une étude offerte (règle identique à has_done_free_study).
-- À appliquer APRÈS 20261023100000_security_hardening.sql.

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

  insert into public.study_email_queue (study_id, participant_id, study_price, study_type_label)
  select s.id, p.id, case when coalesce(s.is_test,false) then 0 else p_study_price end, p_study_type_label
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

create or replace function public.send_due_study_emails()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  r record;
  v_count integer := 0;
begin
  -- Étude plus active, ou participant sans email / plus participant : on n'envoie rien.
  update public.study_email_queue q
     set sent_at = now(), skipped = true
   where q.sent_at is null
     and q.send_after <= now()
     and (
       not exists (select 1 from public.studies s where s.id = q.study_id and s.status = 'active')
       or not exists (select 1 from public.profiles p where p.id = q.participant_id and p.role = 'participant' and p.email is not null)
       or (
         exists (select 1 from public.studies s2 where s2.id = q.study_id and s2.is_test)
         and exists (
           select 1 from public.participations pa
             join public.studies st on st.id = pa.study_id
            where pa.participant_id = q.participant_id
              and pa.status in ('completed','pending_validation')
              and st.is_test
              and coalesce(pa.completed_at, pa.created_at) > now() - make_interval(days => public.boost_duration_days())
         )
       )
     );

  for r in
    select q.id, p.email, p.first_name, s.title, s.theme, s.duration, q.study_price, q.study_type_label
      from public.study_email_queue q
      join public.studies s on s.id = q.study_id
      join public.profiles p on p.id = q.participant_id
     where q.sent_at is null
       and q.send_after <= now()
     order by q.send_after, q.id
     limit 3
     for update of q skip locked
  loop
    perform net.http_post(
      url     := 'https://bwaoxwfkqqpqvtpynwzh.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3YW94d2ZrcXFwcXZ0cHlud3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2OTEzMDEsImV4cCI6MjA5NjI2NzMwMX0.utS5lj2nI-Bs0efelpaj9LHT3B_MSib5Ro8ESIz1-q8'
      ),
      body := jsonb_build_object(
        'type', 'new_study_match',
        'data', jsonb_build_object(
          'email', r.email,
          'first_name', coalesce(r.first_name, ''),
          'study_title', r.title,
          'study_theme', coalesce(r.theme, ''),
          'study_duration', coalesce(r.duration, ''),
          'study_price', r.study_price,
          'study_type', coalesce(r.study_type_label, '')
        )
      ),
      timeout_milliseconds := 15000
    );
    update public.study_email_queue set sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function public.send_due_study_emails() from public, anon, authenticated;
grant execute on function public.send_due_study_emails() to service_role;

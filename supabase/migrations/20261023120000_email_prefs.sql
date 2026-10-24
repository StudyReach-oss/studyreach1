-- Préférences d'e-mail du chercheur (cases « Notifications e-mail » des Paramètres).
-- Les Edge Functions d'envoi (send-email, notify-*) doivent lire profiles.email_prefs
-- avant d'envoyer : clés new_participant, study_completed, recharge, product_news.
alter table public.profiles
  add column if not exists email_prefs jsonb not null
  default '{"new_participant":true,"study_completed":true,"recharge":true,"product_news":true}'::jsonb;

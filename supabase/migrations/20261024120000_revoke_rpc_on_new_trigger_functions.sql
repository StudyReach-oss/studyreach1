-- Déjà appliquée en prod. Fichier ajouté pour réaligner le dépôt avec la base.
-- Retire l'accès public (RPC) à deux fonctions de déclenchement.
revoke execute on function public.set_participation_boost() from public, anon, authenticated;
revoke execute on function public.set_study_email_queue_send_after() from public, anon, authenticated;

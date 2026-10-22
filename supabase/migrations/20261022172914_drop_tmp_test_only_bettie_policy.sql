-- Policy temporaire de test : rendait lisibles par anon/authenticated toutes les études (id < 900000000),
-- y compris brouillons, études en attente de paiement et études sous accès anticipé Boost.
drop policy if exists "tmp_test_only_bettie" on public.studies;

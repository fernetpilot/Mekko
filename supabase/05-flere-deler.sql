-- Mekkoo – flere deler på samme servicebesøk.
-- Nytt felt servicepunkter (liste). Eksisterende verdi i servicepunkt kopieres over.
-- Det gamle feltet servicepunkt beholdes inntil videre. Kjøres manuelt i Supabase SQL Editor.

alter table public.vedlikehold
  add column if not exists servicepunkter text[] not null default '{}';

update public.vedlikehold
  set servicepunkter = array[servicepunkt]
  where servicepunkt is not null
    and servicepunkter = '{}';

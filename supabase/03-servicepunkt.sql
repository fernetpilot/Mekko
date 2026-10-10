-- Mekkoo – hvilket servicepunkt en registrering gjelder (f.eks. motorolje).
-- Kjøres manuelt i Supabase SQL Editor. Ingen ny RLS trengs: eksisterende
-- policyer på vedlikehold dekker det nye feltet.

alter table public.vedlikehold
  add column if not exists servicepunkt text
  check (servicepunkt is null or char_length(servicepunkt) <= 40);

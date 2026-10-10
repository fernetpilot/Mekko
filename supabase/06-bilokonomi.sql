-- Mekkoo – biløkonomi: kjøpspris, kjøpsdato og kilometerstand ved kjøp.
-- Kjøres manuelt i Supabase SQL Editor. Eksisterende tilgangsregler på «biler» gjelder også disse feltene.

alter table public.biler
  add column if not exists kjopspris numeric(12, 2) check (kjopspris >= 0),
  add column if not exists kjopsdato date,
  add column if not exists kjops_km  integer check (kjops_km >= 0);

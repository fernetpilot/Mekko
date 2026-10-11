-- Mekkoo – sommer- og vinterdekk hver for seg (alder og mønsterdybde per sesong).
-- Kjør etter 04-slitasje.sql. Kopierer eksisterende dekk over til riktig sesong.
-- De gamle kolonnene (dekk_type, dekk_montert, dekk_mm, dekk_maalt) brukes ikke lenger
-- og kan slettes når vi er sikre på at alt er kopiert.

alter table public.biler
  add column if not exists dekk_sommer_montert date,
  add column if not exists dekk_sommer_mm       numeric(3, 1) check (dekk_sommer_mm >= 0),
  add column if not exists dekk_sommer_maalt    date,
  add column if not exists dekk_vinter_montert  date,
  add column if not exists dekk_vinter_mm       numeric(3, 1) check (dekk_vinter_mm >= 0),
  add column if not exists dekk_vinter_maalt    date;

update public.biler
   set dekk_sommer_montert = dekk_montert,
       dekk_sommer_mm      = dekk_mm,
       dekk_sommer_maalt   = dekk_maalt
 where dekk_type = 'sommer';

update public.biler
   set dekk_vinter_montert = dekk_montert,
       dekk_vinter_mm      = dekk_mm,
       dekk_vinter_maalt   = dekk_maalt
 where dekk_type = 'vinter';

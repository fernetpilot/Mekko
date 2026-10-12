-- Mekkoo – dekksett: sommer- og vinterdekk per bil, og hvilket sett som står på.
-- Kjøres manuelt i Supabase SQL Editor. Trygt å kjøre flere ganger.
-- De gamle feltene dekk_type, dekk_montert, dekk_mm og dekk_maalt på biler beholdes inntil videre,
-- og kopieres over til et dekksett som står på bilen.

-- Hvor bilen mest kjøres: piggdekksesongen er lengre i Nordland, Troms og Finnmark
alter table public.biler
  add column if not exists dekk_region text not null default 'sor' check (dekk_region in ('sor', 'nord'));

create table if not exists public.dekksett (
  id               uuid primary key default gen_random_uuid(),
  bil_id           uuid not null references public.biler (id) on delete cascade,
  eier_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type             text not null check (type in ('sommer', 'vinter')),
  pigg             boolean not null default false,
  dimensjon        text check (char_length(dimensjon) <= 40),
  produksjonsaar   integer check (produksjonsaar between 1980 and 2100),
  monsterdybde_mm  numeric(3, 1) check (monsterdybde_mm >= 0 and monsterdybde_mm <= 20),
  maalt            date,
  lagring          text check (char_length(lagring) <= 100),
  pa_bilen         boolean not null default false,
  montert          date,
  notat            text check (char_length(notat) <= 300),
  opprettet        timestamptz not null default now()
);

create index if not exists dekksett_bil on public.dekksett (bil_id);
-- Bare ett dekksett kan stå på bilen om gangen
create unique index if not exists dekksett_ett_pa_bilen on public.dekksett (bil_id) where pa_bilen;

alter table public.dekksett enable row level security;

drop policy if exists "Egne dekksett: les" on public.dekksett;
drop policy if exists "Egne dekksett: legg til" on public.dekksett;
drop policy if exists "Egne dekksett: endre" on public.dekksett;
drop policy if exists "Egne dekksett: slett" on public.dekksett;

create policy "Egne dekksett: les" on public.dekksett
  for select using (eier_id = auth.uid());
create policy "Egne dekksett: legg til" on public.dekksett
  for insert with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Egne dekksett: endre" on public.dekksett
  for update using (eier_id = auth.uid())
  with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Egne dekksett: slett" on public.dekksett
  for delete using (eier_id = auth.uid());

-- Dekk som allerede er registrert på bilen blir et dekksett som står på
insert into public.dekksett (bil_id, eier_id, type, monsterdybde_mm, maalt, montert, pa_bilen)
select b.id, b.eier_id, b.dekk_type, b.dekk_mm, b.dekk_maalt, b.dekk_montert, true
from public.biler b
where b.dekk_type is not null
  and not exists (select 1 from public.dekksett d where d.bil_id = b.id);

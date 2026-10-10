-- Mekkoo – slitasjedeler: dekk på bilen, og utsettelser (snooze) av varsler.
-- Kjøres manuelt i Supabase SQL Editor.

alter table public.biler
  add column if not exists dekk_type     text check (dekk_type in ('sommer', 'vinter')),
  add column if not exists dekk_montert  date,
  add column if not exists dekk_mm       numeric(3, 1) check (dekk_mm >= 0),
  add column if not exists dekk_maalt    date;

create table if not exists public.utsettelser (
  id            uuid primary key default gen_random_uuid(),
  bil_id        uuid not null references public.biler (id) on delete cascade,
  eier_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  punkt         text not null check (char_length(punkt) <= 40),
  til_km        integer check (til_km >= 0),
  til_dato      date,
  ved_oljeskift boolean not null default false,
  fra_dato      date not null default current_date,
  opprettet     timestamptz not null default now()
);

create index if not exists utsettelser_bil on public.utsettelser (bil_id, punkt);

alter table public.utsettelser enable row level security;

create policy "Egne utsettelser: les" on public.utsettelser
  for select using (eier_id = auth.uid());
create policy "Egne utsettelser: legg til" on public.utsettelser
  for insert with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Egne utsettelser: slett" on public.utsettelser
  for delete using (eier_id = auth.uid());

-- Mekkoo – tilstandsrapport: selgerens egenvurdering per bil (tilstandsgrader og egenerklæring).
-- Kjøres manuelt i Supabase SQL Editor. Trygt å kjøre flere ganger.
-- Alt annet i rapporten (historikk, EU-kontroll, dekk) regnes ut når rapporten lages.

create table if not exists public.tilstandsrapporter (
  bil_id     uuid primary key references public.biler (id) on delete cascade,
  eier_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 20000),
  oppdatert  timestamptz not null default now()
);

alter table public.tilstandsrapporter enable row level security;

drop policy if exists "Egne tilstandsrapporter: les" on public.tilstandsrapporter;
drop policy if exists "Egne tilstandsrapporter: legg til" on public.tilstandsrapporter;
drop policy if exists "Egne tilstandsrapporter: endre" on public.tilstandsrapporter;
drop policy if exists "Egne tilstandsrapporter: slett" on public.tilstandsrapporter;

create policy "Egne tilstandsrapporter: les" on public.tilstandsrapporter
  for select using (eier_id = auth.uid());
create policy "Egne tilstandsrapporter: legg til" on public.tilstandsrapporter
  for insert with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Egne tilstandsrapporter: endre" on public.tilstandsrapporter
  for update using (eier_id = auth.uid())
  with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Egne tilstandsrapporter: slett" on public.tilstandsrapporter
  for delete using (eier_id = auth.uid());

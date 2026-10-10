-- Mekkoo – databaseskjema for Supabase
-- Kjøres én gang i Supabase: SQL Editor → New query → lim inn alt → Run.
--
-- Prinsipp: hver rad har en eier (eier_id). Row Level Security (RLS) gjør at
-- en innlogget bruker bare kan lese og endre sine egne rader – også om noen
-- prøver å gå rundt nettsiden og snakke med databasen direkte.

-- ---------------------------------------------------------------------------
-- Biler
-- ---------------------------------------------------------------------------
create table public.biler (
  id                  uuid primary key default gen_random_uuid(),
  eier_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kjennemerke         text not null check (kjennemerke ~ '^[A-ZÆØÅ0-9]{2,7}$'),
  kallenavn           text check (char_length(kallenavn) <= 40),
  -- Hentet fra Vegvesenets API ved registrering, kan oppdateres senere
  merke               text,
  modell              text,
  forstegangsregistrert date,
  eu_kontrollfrist    date,
  -- Brukerens egne opplysninger
  kilometerstand      integer check (kilometerstand >= 0),
  kilometerstand_dato date,
  opprettet           timestamptz not null default now(),
  unique (eier_id, kjennemerke)
);

-- ---------------------------------------------------------------------------
-- Vedlikehold: én rad per ting som er gjort på bilen
-- (oljeskift, bremser, dekkskift, EU-kontroll, service, annet)
-- ---------------------------------------------------------------------------
create table public.vedlikehold (
  id             uuid primary key default gen_random_uuid(),
  bil_id         uuid not null references public.biler (id) on delete cascade,
  eier_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  komponent      text not null check (komponent in
                   ('motor', 'bremser', 'dekk', 'eu_kontroll', 'service', 'annet')),
  -- Hvilket servicepunkt (public/js/servicepunkter.js), f.eks. 'motorolje'. Null = ikke spesifisert.
  servicepunkt   text check (servicepunkt is null or char_length(servicepunkt) <= 40),
  dato           date not null,
  kilometerstand integer check (kilometerstand >= 0),
  kostnad        numeric(10, 2) check (kostnad >= 0),
  utfort_av      text check (char_length(utfort_av) <= 100),
  notat          text check (char_length(notat) <= 1000),
  opprettet      timestamptz not null default now()
);

create index vedlikehold_bil_dato on public.vedlikehold (bil_id, komponent, dato desc);

-- ---------------------------------------------------------------------------
-- Tilgangsregler (RLS)
-- ---------------------------------------------------------------------------
alter table public.biler       enable row level security;
alter table public.vedlikehold enable row level security;

create policy "Egne biler: les"    on public.biler for select using (eier_id = auth.uid());
create policy "Egne biler: legg til" on public.biler for insert with check (eier_id = auth.uid());
create policy "Egne biler: endre"  on public.biler for update using (eier_id = auth.uid()) with check (eier_id = auth.uid());
create policy "Egne biler: slett"  on public.biler for delete using (eier_id = auth.uid());

-- Vedlikehold kan bare knyttes til en bil brukeren selv eier.
create policy "Eget vedlikehold: les" on public.vedlikehold for select using (eier_id = auth.uid());
create policy "Eget vedlikehold: legg til" on public.vedlikehold for insert with check (
  eier_id = auth.uid()
  and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
);
create policy "Eget vedlikehold: endre" on public.vedlikehold for update
  using (eier_id = auth.uid())
  with check (
    eier_id = auth.uid()
    and exists (select 1 from public.biler b where b.id = bil_id and b.eier_id = auth.uid())
  );
create policy "Eget vedlikehold: slett" on public.vedlikehold for delete using (eier_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Dokumenter (kvitteringer m.m.) – samme innhold som 02-dokumenter.sql
-- ---------------------------------------------------------------------------
-- Lagringsplass (bucket): privat, maks 10 MB per fil, bare JPEG, PNG og PDF
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumenter', 'dokumenter', false, 10485760,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

create policy "Egne dokumentfiler: les"
  on storage.objects for select to authenticated
  using (bucket_id = 'dokumenter' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Egne dokumentfiler: last opp"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumenter' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Egne dokumentfiler: slett"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dokumenter' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ---------------------------------------------------------------------------
-- Tabell med informasjon om hver fil
-- ---------------------------------------------------------------------------
create table public.dokumenter (
  id             uuid primary key default gen_random_uuid(),
  vedlikehold_id uuid not null references public.vedlikehold (id) on delete cascade,
  eier_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  filsti         text not null unique,
  filnavn        text not null check (char_length(filnavn) <= 200),
  mimetype       text not null check (mimetype in ('image/jpeg', 'image/png', 'application/pdf')),
  storrelse      integer check (storrelse >= 0),
  opprettet      timestamptz not null default now(),
  -- Filen må ligge i eierens egen mappe
  check (filsti like eier_id::text || '/%')
);

create index dokumenter_vedlikehold on public.dokumenter (vedlikehold_id);

alter table public.dokumenter enable row level security;

create policy "Egne dokumenter: les" on public.dokumenter for select using (eier_id = auth.uid());
create policy "Egne dokumenter: legg til" on public.dokumenter for insert with check (
  eier_id = auth.uid()
  and exists (select 1 from public.vedlikehold v where v.id = vedlikehold_id and v.eier_id = auth.uid())
);
create policy "Egne dokumenter: slett" on public.dokumenter for delete using (eier_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Brukeren kan slette sin egen konto (personvern: retten til sletting).
-- Biler, vedlikehold og dokumentrader slettes automatisk via "on delete cascade".
-- Selve filene i lagringen slettes av nettsiden før denne funksjonen kalles.
-- ---------------------------------------------------------------------------
create function public.slett_min_konto()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.slett_min_konto() from public, anon;
grant execute on function public.slett_min_konto() to authenticated;

-- Mekkoo – dokumenter (kvitteringer, serviceordrer o.l.) knyttet til vedlikehold
-- Kjøres ÉN gang i Supabase: SQL Editor → New query → lim inn alt → Run.
-- (Innholdet er også lagt inn i schema.sql, så nye prosjekter får alt fra én fil.)
--
-- Filene ligger i en PRIVAT bucket, i mappen <bruker-id>/<vedlikehold-id>/.
-- Tilgangsreglene under sørger for at en bruker bare kan lese, laste opp og
-- slette filer i sin egen mappe.

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

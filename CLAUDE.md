# Mekko – prosjektkontekst for Claude

## Hva vi lager
En mobilvennlig nettside som regner ut hvor mye man maksimalt kan laste en tilhenger med i Norge,
og viser **hvilken grense som begrenser**: (1) førerkortet, (2) bilens tilhengerkapasitet eller
(3) tilhengerens egen kapasitet. Bil og henger slås opp på skiltnummer via Statens vegvesens API.

Langsiktig visjon: en plattform for å holde oversikt over bilen (service, EU-kontroll, dekkskift,
årshjul, senere bompenger, kjøregodtgjørelse, verdi, regnskap) og en iOS-app. **Ikke i v1.**

## Hvem vi er
Tre personer uten erfaring med webutvikling. Forklar kort, velg alltid den enkleste løsningen
som fungerer, og si ifra hvis noe vi ber om er tidkrevende eller risikabelt.
Effektivitet før perfeksjon – vi vil lansere en fungerende første versjon raskt.

## Teknologivalg (ikke endre uten å spørre)
- Ren HTML, CSS og JavaScript. Ingen rammeverk, ingen byggesteg.
- Hosting: Netlify. Nettsiden ligger i `public/`.
- Backend: kun én serverløs funksjon (`netlify/functions/kjoretoy.mjs`) som skjuler API-nøkkelen.
- Innlogging og database: Supabase (supabase-js fra CDN). Skjema og tilgangsregler i `supabase/schema.sql`.
  Endringer i skjemaet kjøres manuelt i Supabase SQL Editor – oppdater filen samtidig.
- Mobil først, men skal fungere på PC. Skal kunne bli iOS-app senere.

## Struktur
- `public/` – nettsiden (det brukeren ser)
- `public/index.html` – forsiden: bilhold-siden med 3D-bil (Three.js fra CDN). Kode og stil i `public/bilhold/`.
  Viser foreløpig bare eksempeldata. Siden er åpen for alle; «Logg inn»-knapper (`data-logg-inn`) står
  i headeren, på kortene og etter kalkulatorsvaret. De skjules når `<html>` har klassen `innlogget`
  (settes av et skript øverst i `<head>` hvis det finnes en lagret Supabase-økt).
  Trykk på en «Logg inn»-knapp: kameraet zoomer inn på sjiraffen, så åpnes `/min-side`, der det samme
  sjiraffhodet er bakgrunn (`public/bilhold/js/sjiraff-bakgrunn.js`). `?modus=ny-konto` åpner «Opprett konto».
  Trykk på tilhengeren (eller knappen øverst) åpner tilhengerkalkulatoren på samme side
  (`public/bilhold/js/lastkalkulator.js`): skiltoppslag og maks last med `beregnMaksLast`, samme regler
  som `/kalkulator`, pluss en rask førerkort-sjekk med vekter fra vognkortet (`sjekkForerkort`).
  Innlogget: hover/trykk på bilen «skanner» den (glasset blir gjennomsiktig, sjiraff kjører, tre svevende knapper:
  Mine biler, Service og EU-kontroll, Vedlikehold). «Åpne bilen din» nederst på bilen åpner panelet «Bilen din»
  (`#bil-panel`, første bil) med samme kameraanimasjon som kalkulatoren. Begge panelene lukkes ved å scrolle opp
  eller trykke utenfor teksten.
  Personikonet åpner «Min profil»-menyen (`public/bilhold/js/profilmeny.js`): Mine biler, Registrer vedlikehold, Mine kvitteringer (kommer), Logg ut.
  Bjella ved siden av viser varsler. Reglene ligger i `public/js/varsler.js` (ren logikk, testet):
  foreløpig bare EU-kontroll; service og slitasje i % skal legges til der.
- `public/kalkulator.html` – tilhengerkalkulatoren (v1), nås på `/kalkulator`. Lenkes ikke lenger fra forsiden,
  men brukes hvis JavaScript/3D ikke virker.
- `public/js/beregning.js` – all beregningslogikk. Ren funksjon: tall inn, resultat ut.
  Ingen DOM, ingen nettverkskall. Skal kunne gjenbrukes i en app.
- `public/js/kjoretoy.js` – henter vekter, EU-kontrollfrist m.m. ut av API-svaret.
- `public/min-side.html` + `public/js/min-side.js` – innlogging (e-post og passord) og Mine biler:
  per bil vises vedlikeholdshistorikk og alle kjøretøydata fra Vegvesenet (hentes når seksjonen åpnes).
- `public/registrer-vedlikehold.html` + `public/js/registrer-vedlikehold.js` – egen side for å registrere vedlikehold
  (`?bil=<id>` forhåndsvelger bil). Krever innlogging.
- `public/js/kjoretoydetaljer.js` – gjør API-svaret om til lesbare seksjoner. Feltoversikt: `docs/api-felter.md`.
- Dokumenter (kvitteringer, serviceordrer): `public/js/dokumenter.js`. Privat Supabase-bucket `dokumenter`,
  filsti `<bruker-id>/<vedlikehold-id>/…`, tabell `dokumenter` (se `supabase/02-dokumenter.sql`).
  Bilder gjøres om til JPEG og skaleres ned før opplasting. Filer slettes av nettsiden før radene slettes.
- `public/importer-historikk.html` + `public/js/importer-historikk.js` – import av mange hendelser på én gang:
  regneark (Excel/CSV, lest i nettleseren med SheetJS fra CDN) og dokumenter → redigerbare forslag → «Importer».
  Tolkingen (kolonner, norske datoer/tall, type, dubletter) ligger i `public/js/import-historikk.js` (ren, testet).
  Overskrifter matches delvis («Arbeidsnotater», «Totalbeløp»), ukjente kolonner gjenkjennes på innhold,
  og kolonner som ikke brukes legges i notatet. PDF-er med tekst leses med pdf.js (legacy-utgaven, med
  reserve uten arbeider) fra CDN og tolkes av
  `tolkKvitteringstekst` (dato, km, «Å betale», verksted). PDF-er med mange hendelser (servicehefte, historikk-
  utskrift: hver hendelse starter med en dato) deles opp av `tolkHendelsesliste`. Dubletter velges bort som standard.
  Hendelser uten dato blir liggende til de fylles ut.
  Mal: `public/mal/servicehistorikk-mal.csv`. Neste steg: KI-tolking av skannede PDF-er og bilder (krever API-nøkkel og personvernavklaring).
- `public/servicehefte.html` + `public/js/servicehefte.js` – historikk med vedlegg for én bil (`?bil=<id>`).
  Hendelser og enkeltvedlegg kan slettes der. PDF lages i nettleseren med pdf-lib fra CDN:
  `public/js/servicehefte-pdf.js` (ren funksjon). Formatet er foreløpig.
- `public/js/supabase.js` – Supabase-klienten (URL + publishable key).
- `public/service-og-eu.html` + `public/js/service-og-eu.js` – EU-kontroll, service og slitasje de neste 12 mnd (`?bil=<id>`, ellers første bil). Krever innlogging.
- `public/vedlikehold.html` + `public/js/vedlikehold-oversikt.js` – alt vedlikehold per år med kostnad og vedlegg. Felles: `public/js/dashboard-side.js`, `public/css/dashboard.css`; ren logikk i `public/js/dashboard.js` (testet).
- `public/js/bilstatus.js` – rene hjelpefunksjoner: EU-status, datoer, km.
- `tests/` – tester for beregningen, basert på testcasene i regelverksdokumentet
- `netlify/functions/` – proxy mot Vegvesenet
- `docs/eksempeldata/` – ekte JSON-svar fra Vegvesenet (uten personopplysninger)

## Regler som alltid gjelder
- **API-nøkkelen skal ALDRI inn i koden eller repoet.** Den ligger som miljøvariabel `SVV_API_KEY`
  i Netlify og i en lokal `.env` (som er gitignored).
- Nettsiden kaller kun `/api/kjoretoy?kjennemerke=...`, aldri Vegvesenet direkte.
- Regelverket (førerkortgrenser m.m.) kommer fra gruppens regelverksdokument, kontrollert mot
  vegvesen.no. Ikke gjett på grenseverdier – spør hvis noe mangler.
- Resultatsiden skal alltid ha en ansvarsfraskrivelse og henvise til vognkort og vegvesen.no.
- Endringer i `public/js/beregning.js` skal ha tester, og `npm test` skal passere før commit.
- Skriv brukertekster på norsk bokmål.

- Supabase: bare **publishable key** i koden. Secret key / service_role skal ALDRI inn i repoet.
  All tilgang styres av RLS i `supabase/schema.sql` – nye tabeller må ha RLS og policyer.
- Personopplysninger (e-post, skilt koblet til person): lagre bare det som trengs, og la brukeren slette.

## Vegvesenets API
- `GET https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=XX12345`
- Header: `SVV-Authorization: Apikey <nøkkel>`
- Statuskoder: 200 OK, 400 ugyldig forespørsel, 403 ugyldig nøkkel, 429 kvote brukt opp (50 000/døgn).
- Data ligger under `kjoretoydataListe[0]`, tekniske data under
  `godkjenning.tekniskGodkjenning.tekniskeData`. Sjekk feltnavn mot filene i `docs/eksempeldata/`.

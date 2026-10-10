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
  Viser foreløpig bare eksempeldata. Har en knapp øverst til kalkulatoren.
  Krever innlogging: uten lagret Supabase-økt sendes brukeren til `/min-side?neste=/` (skript øverst i `<head>`).
  Kalkulatoren er åpen uten innlogging.
  Personikonet åpner «Min profil»-menyen (`public/bilhold/js/profilmeny.js`): Mine biler, Mine kvitteringer (kommer), Logg ut.
- `public/kalkulator.html` – tilhengerkalkulatoren (v1), nås på `/kalkulator`
- `public/js/beregning.js` – all beregningslogikk. Ren funksjon: tall inn, resultat ut.
  Ingen DOM, ingen nettverkskall. Skal kunne gjenbrukes i en app.
- `public/js/kjoretoy.js` – henter vekter, EU-kontrollfrist m.m. ut av API-svaret.
- `public/min-side.html` + `public/js/min-side.js` – innlogging (e-post og passord), mine biler og vedlikehold.
- `public/js/supabase.js` – Supabase-klienten (URL + publishable key).
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

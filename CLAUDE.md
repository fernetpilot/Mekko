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
- Mobil først, men skal fungere på PC. Skal kunne bli iOS-app senere.

## Struktur
- `public/` – nettsiden (det brukeren ser)
- `public/js/beregning.js` – all beregningslogikk. Ren funksjon: tall inn, resultat ut.
  Ingen DOM, ingen nettverkskall. Skal kunne gjenbrukes i en app.
- `public/js/kjoretoy.js` – henter vektene ut av API-svaret.
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

## Vegvesenets API
- `GET https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=XX12345`
- Header: `SVV-Authorization: Apikey <nøkkel>`
- Statuskoder: 200 OK, 400 ugyldig forespørsel, 403 ugyldig nøkkel, 429 kvote brukt opp (50 000/døgn).
- Data ligger under `kjoretoydataListe[0]`, tekniske data under
  `godkjenning.tekniskGodkjenning.tekniskeData`. Sjekk feltnavn mot filene i `docs/eksempeldata/`.

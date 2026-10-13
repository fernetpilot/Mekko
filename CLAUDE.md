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
  Kortene (Motorrom, Bremseanlegg, Dekk og hjul) viser eksempeldata for utloggede. Innlogget fyller
  `public/bilhold/js/forside-kort.js` dem med status for valgt bil (ren logikk i `public/js/forside.js`, testet)
  og lenker til riktig fane i «Bilen din». Bilene hentes med `public/bilhold/js/bil-data.js`. Siden er åpen for alle; «Logg inn»-knapper (`data-logg-inn`) står
  i headeren, på kortene og etter kalkulatorsvaret. De skjules når `<html>` har klassen `innlogget`
  (settes av et skript øverst i `<head>` hvis det finnes en lagret Supabase-økt).
  Trykk på en «Logg inn»-knapp: kameraet zoomer inn på sjiraffen, så åpnes `/min-side`, der det samme
  sjiraffhodet er bakgrunn (`public/bilhold/js/sjiraff-bakgrunn.js`). `?modus=ny-konto` åpner «Opprett konto».
  Trykk på tilhengeren (eller knappen øverst) åpner tilhengerkalkulatoren på samme side
  (`public/bilhold/js/lastkalkulator.js`): skiltoppslag og maks last med `beregnMaksLast`, samme regler
  som `/kalkulator`, pluss en rask førerkort-sjekk med vekter fra vognkortet (`sjekkForerkort`).
  Innlogget: hover/trykk på bilen «skanner» den (glasset blir gjennomsiktig, sjiraff kjører, fem svevende knapper som holdes fra hverandre:
  Mine biler, Service og EU-kontroll, Vedlikehold). «Åpne bilen din» nederst på bilen åpner panelet «Bilen din»
  (`#bil-panel`) med samme kameraanimasjon som kalkulatoren. Begge panelene lukkes ved å scrolle opp
  eller trykke utenfor teksten.
  «Bilen din» er stedet der alt om bilen samles (`public/bilhold/js/bilen-din.js`): bilbytte (skilt øverst),
  nøkkeltall og faner Oversikt, Service og EU, Vedlikehold, Dekk, Økonomi og Bildata. Adressen er
  `/?bil=<id>&fane=<fane>#bilen-din` (lag den med `bilLenke` i `bilstatus.js`); alle lenker dit åpner panelet
  uten å laste siden på nytt. «Mine biler» (profilmenyen, svevende knapp, toppknappen på undersidene) og varslene
  leder hit. Fanene ligger i egne filer i `public/bilhold/js/` (`fane-service.js`, `fane-vedlikehold.js`, `fane-dekk.js`,
  `fane-okonomi.js`; felles byggeklosser i `bil-visning.js`). Etter en lagring kaller fanen `ctx.oppdater()`, som henter
  bilene på nytt. De gamle sidene `/service-og-eu`, `/vedlikehold`, `/dekk` og `/bilokonomi` sender bare videre til riktig fane.
  Panelene («Bilen din» og kalkulatoren) går opp til headeren med luft øverst (`.bil-luft`). Når man blar ned,
  zoomer kameraet ut (`scene.settSideBunn`) så veien alltid slutter der teksten begynner, til vogntoget er en smal
  stripe under headeren; fanene i «Bilen din» stopper rett under veien (`--vei-bunn`). «+ Legg til bil» blir en
  tekstboks i bilraden (skiltoppslag og lagring i `public/js/ny-bil.js`, brukt også av Min side).
  Innlogget får 3D-bilen fargen den er registrert med hos Vegvesenet (`public/js/bilfarge.js`, testet; huskes i
  nettleseren per skilt), og motor/bremser/dekk lyser i kortets statusfarge når kameraet zoomer inn.
  Svake telefoner får en lett 3D-versjon (lav oppløsning, ingen skygger, 30 fps): slås på av lite minne/datasparing
  eller hvis de første sekundene går tregt. `?lett` i adressen tvinger den på.
  Personikonet åpner «Min profil»-menyen (`public/bilhold/js/profilmeny.js`): Mine biler, Registrer vedlikehold, Dekk og dekkskift, Biløkonomi, Mine kvitteringer (kommer), Logg ut.
  Bjella ved siden av viser varsler. Reglene ligger i `public/js/varsler.js` (ren logikk, testet):
  EU-kontroll, service og dekkskift; servicepunkter som aldri er registrert gir ett samlet «bør sjekkes»-varsel per bil.
  Er ett girkassepunkt registrert, etterlyses ikke den andre girtypen (`aktuellePunkter` i `servicepunkter.js`).
  Slitasje i % skal legges til der.
- `public/kalkulator.html` – tilhengerkalkulatoren (v1), nås på `/kalkulator`. Lenkes ikke lenger fra forsiden,
  men brukes hvis JavaScript/3D ikke virker.
- `public/js/beregning.js` – all beregningslogikk. Ren funksjon: tall inn, resultat ut.
  Ingen DOM, ingen nettverkskall. Skal kunne gjenbrukes i en app.
- `public/js/kjoretoy.js` – henter vekter, EU-kontrollfrist m.m. ut av API-svaret.
- `public/min-side.html` + `public/js/min-side.js` – innlogging (e-post og passord) og Mine biler:
  per bil vises vedlikeholdshistorikk og alle kjøretøydata fra Vegvesenet (hentes når seksjonen åpnes).
- `public/registrer-vedlikehold.html` + `public/js/registrer-vedlikehold.js` – egen side for å registrere vedlikehold
  (`?bil=<id>` forhåndsvelger bil). Krever innlogging.
  `?endre=<id>` endrer en registrering som finnes fra før (fyller inn skjemaet, vedlegg kan fjernes) og har «Slett registreringen».
  Vedlikehold-fanen har en «Endre»-knapp på hver jobb som leder hit.
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
- Økonomi-fanen (`fane-okonomi.js`): kjøpspris/-dato/-km (felt på `biler`, se `supabase/06-bilokonomi.sql`), nøkkeltall,
  kakediagram per utgiftspost, stolper per år, akkumulert kurve og grovt verdianslag. Beregningene ligger i
  `public/js/bilokonomi.js` (ren, testet); antakelsene for verdianslaget er samlet i `VERDI_ANTAKELSER` og kan justeres der.
  Øverst i fanen er et sammenleggbart periodefilter (lukket som standard, trykk på linjen åpner/lukker; måned og år, hurtigvalg Alt/Siden kjøp/Siste 12 mnd/I år/I fjor). Standard er hele
  historikken fra første hendelse (`standardPeriode`); `oppsummer(hendelser, { periode })` regner bare den perioden.
  Nøkkeltall, kake, stolper (per måned når perioden er ≤ 24 mnd, ellers per år), kurve og tabeller følger filteret;
  markedsverdi, «Totalkostnad siden kjøp» og «Investert totalt» gjelder alltid siden kjøp.
  Diagramfarger (`--serie-*`) står på `#bil-panel` i `public/bilhold/css/bilhold.css`.
- **Kategorier og deler på hendelser: `public/js/kategorier.js` er eneste kilde** (ren, testet).
  `kategorierFor(h)`, `hendelseTittel(h)` og `kostnadPerKategori(h)` brukes av fanen Vedlikehold, Mine biler,
  serviceheftet (nett og PDF), importen og biløkonomien, så de alltid viser det samme. Kategoriene er de i
  `servicekatalog.js` + «EU-kontroll» og «Service (uten spesifiserte deler)». Uten lagrede deler gjettes de
  (`servicepunkt-gjetting.js`, regler for vanlige ord og skrivemåter i fritekst). Er bare «Ekstra service»/«Annet» lagret,
  gjettes delene fra notatet likevel, så kostnaden ikke havner i «Annet». Kostnad på besøk med flere kategorier fordeles likt; «Annet» får bare andel alene.
  Visning: `public/js/kategori-visning.js` + `public/css/kategorier.css`. Ikke lag egne kategorilister andre steder.
- `public/personvern.html` – personvernerklæring, lenket diskret nederst på forsiden og i profilmenyen.
- `public/js/supabase.js` – Supabase-klienten (URL + publishable key).
- Service og EU-fanen (`fane-service.js`): EU-kontroll, service og slitasje de neste 12 mnd. Vedlikehold-fanen
  (`fane-vedlikehold.js`): alt vedlikehold per år med kostnad og vedlegg. Ren logikk i `public/js/dashboard.js` (testet).
  Nederst i Service og EU: «Fulgt etter boka?» – per del alle utførte jobber mot anbefalt intervall (stolper i % av
  intervallet). Trykk på en del i listene over åpner den. Ren logikk i `public/js/etter-boka.js` (testet).
- Dekk-fanen (`fane-dekk.js`): sommer- og vinterdekksett (tabell `dekksett`,
  se `supabase/07-dekksett.sql`), hvilket sett som står på, og «Registrer dekkskift» (lagres også som vedlikehold
  med komponent `dekk`). Reglene ligger i `public/js/dekk.js` (ren, testet): piggdekkperioden (sør/nord, påske),
  når det bør byttes (`dekkskift`) og alder/mønster per sett (`vurderSett`). Dekkskift vises i slitasjelisten,
  årshjulet og varslene. `public/js/dekk-data.js` henter dekksettene og tåler at tabellen mangler.
- Servicekatalog: `public/js/servicekatalog.js` – alle deler som kan registreres på et besøk, i 11 kategorier + Annet
  (ren data, testet). Id-ene for punkter med intervall (`servicepunkter.js`, `slitasje.js`) er de samme.
  Bærearmer registreres per hjul og lagres som `<id>@fv|fh|bv|bh`; bruk `punktNavn(id)` for visning.
  Velgeren (sammenleggbar seksjon per kategori) er `public/js/punktvelger.js`, brukt på Registrer vedlikehold og i Mine biler.
  Velgeren viser bare deler som passer bilen (`passerBil`): drivstoff og drift (drivaksler) fra Vegvesenet via
  `bilEgenskaper` i `kjoretoy.js`, girkasse hvis API-et har den, luftfjæring fra en modelliste. «Vis alle deler» viser resten.
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

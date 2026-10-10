# Felter i Vegvesenets kjøretøy-API

Kartlagt fra ekte oppslag 10.10.2026 (BR67285 personbil, NZ7887 tilhenger).
Alle stier er relative til `kjoretoydataListe[0]`. Tekniske data ligger under
`godkjenning.tekniskGodkjenning.tekniskeData` (forkortet `td.` under).
Mange felt er kodeobjekter `{ kodeVerdi, kodeNavn, kodeBeskrivelse }` – vis `kodeNavn`.
Felt kan være tomme lister for enkelte kjøretøy.

Brukes i: `public/js/kjoretoy.js` (beregning, Min side) og `public/js/kjoretoydetaljer.js` (visning).

## Identitet og registrering
- `kjoretoyId.kjennemerke` – «BR 67285» (med mellomrom – normaliser før lagring)
- `kjoretoyId.understellsnummer` – VIN
- `forstegangsregistrering.registrertForstegangNorgeDato`
- `godkjenning.forstegangsGodkjenning.forstegangRegistrertDato` – første registrering totalt
- `godkjenning.forstegangsGodkjenning.bruktimport.{importland.landNavn, kilometerstand, tidligereUtenlandskKjennemerke}`
- `registrering.registreringsstatus` (kode), `registrering.registrertForstegangPaEierskap`, `registrering.kjoringensArt` (kode)
- `kjennemerke[].kjennemerketype` (kode)

## EU-kontroll
- `periodiskKjoretoyKontroll.kontrollfrist`, `periodiskKjoretoyKontroll.sistGodkjent`

## Klassifisering
- `godkjenning.tekniskGodkjenning.kjoretoyklassifisering.{beskrivelse, tekniskKode, kjoretoyAvgiftsKode, spesielleKjennetegn}`
  – `tekniskKode.kodeVerdi`: M1/M1G personbil, N1 varebil, O1–O4 tilhenger
- `godkjenning.tekniskGodkjenning.godkjenningsundertype` (kode)

## Tekniske data
- `td.generelt.{merke[].merke, handelsbetegnelse[], typebetegnelse}`
- `td.vekter.{egenvekt, nyttelast, tillattTotalvekt, tillattTilhengervektMedBrems, tillattTilhengervektUtenBrems, tillattVogntogvekt, tillattVertikalKoplingslast}`
- `td.motorOgDrivverk.{hybridKategori, maksimumHastighet[], motor[].slagvolum, motor[].drivstoff[].{drivstoffKode, maksNettoEffekt (kW)}}`
- `td.miljodata.{euroKlasse, miljoOgdrivstoffGruppe[].{drivstoffKodeMiljodata, forbrukOgUtslipp[].{co2BlandetKjoring, forbrukBlandetKjoring, utslippNOxMgPrKm, partikkelfilterFabrikkmontert}, lyd.standstoy}}`
- `td.dekkOgFelg.akselDekkOgFelgKombinasjon[].akselDekkOgFelg[].{akselId, dekkdimensjon, belastningskodeDekk, hastighetskodeDekk, felgdimensjon, innpress, tvilling}`
- `td.akslinger.{antallAksler, akselGruppe[].akselListe.aksel[].{avstandTilNesteAksling, sporvidde, drivAksel, tekniskTillattAkselLast}}`
- `td.dimensjoner.{lengde, bredde}` (mm)
- `td.persontall.{sitteplasserTotalt, sitteplasserForan}`
- `td.karosseriOgLasteplan.{rFarge[], antallDorer[], kjoringSide}`
- `td.tilhengerkopling.kopling[].{type, fabrikantKopling, belastningSverdi}` (fylt ut på tilhengere)
- `td.bremser.tilhengerBremseforbindelse[]`

## Finnes ikke i API-et
Eieropplysninger, kilometerstand (utenom ved import), servicehistorikk,
resultater/anmerkninger fra EU-kontroll, verdi/pris.

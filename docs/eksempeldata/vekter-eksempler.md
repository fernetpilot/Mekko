# Eksempler på vektdata fra Vegvesenets API

Hentet via `/api/kjoretoy` 10.10.2026. Alle vekter i kg.
Sti i svaret: `kjoretoydataListe[0].godkjenning.tekniskGodkjenning.tekniskeData.vekter`

## Bil: BR67285 – Land Rover Discovery 3 (personbil, teknisk kode M1G)

```json
{
  "egenvekt": 2560,
  "nyttelast": 595,
  "tillattTilhengervektMedBrems": 3500,
  "tillattTilhengervektUtenBrems": 750,
  "tillattTotalvekt": 3230,
  "tillattVertikalKoplingslast": 150,
  "tillattVogntogvekt": 6730,
  "vogntogvektAvhBremsesystem": []
}
```

## Henger: NZ7887 – Temared Tara Pluss/3 (påhengsvogn, teknisk kode O2)

```json
{
  "egenvekt": 832,
  "egenvektMinimum": 832,
  "nyttelast": 2668,
  "tillattTotalvekt": 3500,
  "tillattVertikalKoplingslast": 150,
  "vogntogvektAvhBremsesystem": []
}
```

Henger har i tillegg `tekniskeData.tilhengerkopling.kopling[0]` (kulehanske 50 mm, belastning 150).

## Observasjoner for beregningen
- Bil og henger skilles på `kjoretoyklassifisering.tekniskKode.kodeVerdi` (M1/M1G = personbil, O1/O2 = tilhenger).
- Hengeren har ikke eget felt for om den har brems. `bremser.tilhengerBremseforbindelse` er tom for begge.
  Teknisk kode O2 (750–3500 kg) tilsier bremset henger – bekreft dette i regelverksdokumentet.
- Hengere har ikke `tillattTilhengervektMedBrems` eller `tillattVogntogvekt` – disse finnes bare på bilen.
- Nyttelast er oppgitt direkte, men regnes også ut som tillattTotalvekt − egenvekt.

import { test } from "node:test";
import assert from "node:assert/strict";
import { kjoretoyDetaljer } from "../public/js/kjoretoydetaljer.js";

// Utdrag av ekte svar for BR67285 (feltnavn fra oppslag 10.10.2026)
const svar = {
  kjoretoydataListe: [{
    kjoretoyId: { kjennemerke: "BR 67285", understellsnummer: "SALLAAA648A481340" },
    forstegangsregistrering: { registrertForstegangNorgeDato: "2008-07-01" },
    registrering: {
      registreringsstatus: { kodeNavn: "Påregistrert", kodeVerdi: "REGISTRERT" },
      registrertForstegangPaEierskap: "2025-11-09T20:26:01.198+01:00",
      kjoringensArt: { kodeNavn: "Egentransport" },
    },
    periodiskKjoretoyKontroll: { kontrollfrist: "2028-06-03", sistGodkjent: "2026-05-28" },
    godkjenning: {
      forstegangsGodkjenning: {
        forstegangRegistrertDato: "2008-03-28",
        bruktimport: { importland: { landNavn: "SVERIGE" } },
      },
      tekniskGodkjenning: {
        godkjenningsundertype: { kodeNavn: "Godkjenning av ombygget kjøretøy" },
        kjoretoyklassifisering: { beskrivelse: "Personbil", spesielleKjennetegn: "Terrenggående", tekniskKode: { kodeNavn: "Personbil (terreng)", kodeVerdi: "M1G" } },
        tekniskeData: {
          generelt: { merke: [{ merke: "LAND ROVER" }], handelsbetegnelse: ["DISCOVERY 3"], typebetegnelse: "LA" },
          vekter: { egenvekt: 2560, nyttelast: 595, tillattTotalvekt: 3230, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750, tillattVogntogvekt: 6730, tillattVertikalKoplingslast: 150, vogntogvektAvhBremsesystem: [] },
          motorOgDrivverk: { hybridKategori: { kodeNavn: "Ingen" }, maksimumHastighet: [180], motor: [{ slagvolum: 2720, drivstoff: [{ drivstoffKode: { kodeNavn: "Diesel" }, maksNettoEffekt: 140 }] }] },
          miljodata: {
            euroKlasse: { kodeNavn: "Euro 4L" },
            miljoOgdrivstoffGruppe: [{ forbrukOgUtslipp: [{ co2BlandetKjoring: 270, forbrukBlandetKjoring: 10.2, partikkelfilterFabrikkmontert: true, utslippNOxMgPrKm: 344 }], lyd: { standstoy: 78 } }],
          },
          dekkOgFelg: { akselDekkOgFelgKombinasjon: [{ akselDekkOgFelg: [
            { akselId: 1, dekkdimensjon: "235/70R17", belastningskodeDekk: "97", hastighetskodeDekk: "S", felgdimensjon: "7,0JX17", innpress: "53", tvilling: false },
            { akselId: 2, dekkdimensjon: "235/70R17", belastningskodeDekk: "97", hastighetskodeDekk: "S", felgdimensjon: "7,0JX17", innpress: "53", tvilling: false },
          ] }, { akselDekkOgFelg: [] }] },
          dimensjoner: { lengde: 4840, bredde: 1920 },
          akslinger: { antallAksler: 2, akselGruppe: [{ akselListe: { aksel: [{ avstandTilNesteAksling: 2890, sporvidde: 1605 }] } }] },
          persontall: { sitteplasserTotalt: 5 },
          karosseriOgLasteplan: { rFarge: [{ kodeNavn: "Svart" }], antallDorer: [] },
          tilhengerkopling: { kopling: [] },
        },
      },
    },
  }],
};

const finn = (seksjoner, tittel) => Object.fromEntries(seksjoner.find((s) => s.tittel === tittel)?.rader ?? []);

test("seksjonene finnes i fast rekkefølge, tomme seksjoner utelates", () => {
  const titler = kjoretoyDetaljer(svar).map((s) => s.tittel);
  assert.deepEqual(titler, ["Registrering", "EU-kontroll", "Kjøretøy", "Motor og miljø", "Vekter", "Dekk og felg", "Mål og aksler"]);
});

test("verdier formateres med enheter og norske datoer", () => {
  const s = kjoretoyDetaljer(svar);
  assert.equal(finn(s, "Registrering")["Understellsnummer (VIN)"], "SALLAAA648A481340");
  assert.equal(finn(s, "Registrering")["Bruktimportert fra"], "SVERIGE");
  assert.equal(finn(s, "EU-kontroll")["Sist godkjent"], "28. mai 2026");
  assert.equal(finn(s, "Registrering")["Nåværende eier siden"], "9. nov. 2025");
  assert.equal(finn(s, "Motor og miljø")["Effekt"], "140 kW (190 hk)");
  assert.equal(finn(s, "Motor og miljø")["Partikkelfilter fra fabrikk"], "Ja");
  assert.equal(finn(s, "Vekter")["Tilhengervekt med brems"], "3 500 kg");
  assert.equal(finn(s, "Kjøretøy")["Farge"], "Svart");
});

test("tomme felt vises ikke", () => {
  const s = kjoretoyDetaljer(svar);
  assert.equal("Antall dører" in finn(s, "Kjøretøy"), false);
  assert.equal(s.some((x) => x.tittel === "Tilhengerkopling"), false);
});

test("dekk vises per aksel med antall godkjente kombinasjoner", () => {
  const dekk = finn(kjoretoyDetaljer(svar), "Dekk og felg");
  assert.equal(dekk["Aksel 1"], "235/70R17 97S, felg 7,0JX17, ET53");
  assert.equal(dekk["Godkjente kombinasjoner"], "2");
});

test("tomt eller ugyldig svar gir tom liste", () => {
  assert.deepEqual(kjoretoyDetaljer({}), []);
  assert.deepEqual(kjoretoyDetaljer(null), []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lagTilstandsrapport, kjoretoyFakta, tomEgenvurdering, lesEgenvurdering, OMRADER, SPORSMAL, TILSTANDSGRADER,
} from "../public/js/tilstandsrapport.js";

const idag = new Date("2026-10-27T12:00:00Z");

// Utdrag av ekte svar for BR67285
const api = {
  kjoretoydataListe: [{
    kjoretoyId: { kjennemerke: "BR 67285", understellsnummer: "SALLAAA648A481340" },
    forstegangsregistrering: { registrertForstegangNorgeDato: "2008-07-01" },
    registrering: { registrertForstegangPaEierskap: "2025-11-09T20:26:01.198+01:00" },
    periodiskKjoretoyKontroll: { kontrollfrist: "2028-06-03", sistGodkjent: "2026-05-28" },
    godkjenning: {
      forstegangsGodkjenning: { forstegangRegistrertDato: "2008-03-28", bruktimport: { importland: { landNavn: "SVERIGE" } } },
      tekniskGodkjenning: {
        tekniskeData: {
          generelt: { merke: [{ merke: "LAND ROVER" }], handelsbetegnelse: ["DISCOVERY 3"] },
          vekter: { tillattTilhengervektMedBrems: 3500 },
          motorOgDrivverk: { motor: [{ slagvolum: 2720, drivstoff: [{ drivstoffKode: { kodeNavn: "Diesel" }, maksNettoEffekt: 140 }] }] },
          miljodata: { euroKlasse: { kodeNavn: "Euro 4L" } },
          persontall: { sitteplasserTotalt: 5 },
          karosseriOgLasteplan: { rFarge: [{ kodeNavn: "Svart" }] },
        },
      },
    },
  }],
};

const bil = {
  id: "b1", kjennemerke: "BR67285", merke: "LAND ROVER", modell: "DISCOVERY 3", kilometerstand: 281345,
  forstegangsregistrert: "2008-03-28",
  vedlikehold: [
    { id: "1", dato: "2026-08-15", komponent: "service", kilometerstand: 279618, kostnad: 3200, servicepunkter: ["motorolje", "oljefilter"], dokumenter: [{ filnavn: "a.pdf" }] },
    { id: "2", dato: "2026-05-06", komponent: "annet", kilometerstand: 275159, kostnad: 5400, servicepunkter: ["hjullager"], notat: "Hjullager høyre bak" },
    { id: "3", dato: "2017-06-16", komponent: "bremser", kilometerstand: 174159, kostnad: 5100, servicepunkter: ["bremseklosser"] },
    { id: "4", dato: "2010-05-05", komponent: "service", kilometerstand: 33528, kostnad: 1137, servicepunkter: ["motorolje", "oljefilter"] },
  ],
  dekksett: [{ type: "vinter", pigg: false, dimensjon: "235/70R17", produksjonsaar: 2018, monsterdybde_mm: 2.5, pa_bilen: true }],
};

test("kjøretøyfakta fra Vegvesenet", () => {
  const f = kjoretoyFakta(api);
  assert.equal(f.understellsnummer, "SALLAAA648A481340");
  assert.equal(f.effekt, "140 kW (190 hk)");
  assert.equal(f.slagvolum, "2,7 liter");
  assert.equal(f.farge, "Svart");
  assert.equal(f.euSistGodkjent, "2026-05-28");
  assert.equal(f.bruktimportFra, "SVERIGE");
  assert.equal(f.eierSiden, "2025-11-09");
  assert.deepEqual(kjoretoyFakta(null), {});
});

test("rapporten samler EU, historikk, utbedringer og dekk", () => {
  const r = lagTilstandsrapport({ bil, kjoretoy: kjoretoyFakta(api), idag });
  assert.equal(r.bil.kjennemerke, "BR67285");
  assert.equal(r.eu.status, "ok");
  assert.equal(r.historikk.antall, 4);
  assert.equal(r.historikk.forste, "2010-05-05");
  assert.equal(r.historikk.antallVedlegg, 1);
  assert.equal(r.historikk.totalKostnad, 14837);
  assert.equal(r.historikk.sisteService.dato, "2026-08-15");
  // Bare ikke-rutine de siste fem årene: hjullageret, ikke bremsene fra 2017 eller oljeskiftet
  assert.deepEqual(r.utbedringer.map((u) => u.dato), ["2026-05-06"]);
  assert.equal(r.utbedringer[0].kostnad, 5400);
  // Vinterdekk med 2,5 mm får en merknad (grensene står i dekk.js)
  assert.equal(r.dekk.length, 1);
  assert.ok(r.dekk[0].tekst.length > 0);
  // Områdene viser siste arbeid fra historikken
  const styring = r.omrader.find((o) => o.id === "styring");
  assert.equal(styring.sisteArbeid.dato, "2026-05-06");
  assert.equal(styring.tg, "TGIU");
  assert.ok(r.sammendrag.some((s) => s.type === "pluss" && s.tekst.startsWith("EU-godkjent")));
});

test("kostnader kan skjules", () => {
  const egen = { ...tomEgenvurdering(), visKostnader: false };
  const r = lagTilstandsrapport({ bil, egen, idag });
  assert.equal(r.historikk.totalKostnad, null);
  assert.equal(r.utbedringer[0].kostnad, null);
});

test("selgerens vurdering og egenerklæring kommer med, og avvik løftes fram i sammendraget", () => {
  const egen = lesEgenvurdering({
    omrader: { bremser: { tg: "TG2", kommentar: "Skiver bak bør byttes" }, motor: { tg: "TG1" }, tull: { tg: "TG0" } },
    svar: { kollisjon: { svar: "ja", utdyp: "Bulk i bakdør, reparert 2020" }, nokler: { svar: "2" } },
  });
  const r = lagTilstandsrapport({ bil, egen, idag });
  const bremser = r.omrader.find((o) => o.id === "bremser");
  assert.equal(bremser.tg, "TG2");
  assert.equal(bremser.kommentar, "Skiver bak bør byttes");
  assert.equal(r.egenerklaering.find((e) => e.id === "nokler").svar, "2");
  assert.equal(r.egenerklaering.find((e) => e.id === "royk").svar, "Ikke besvart");
  assert.ok(r.sammendrag.some((s) => s.type === "obs" && s.tekst.includes("TG2") && s.tekst.includes("Bremser")));
  assert.ok(r.sammendrag.some((s) => s.type === "obs" && s.tekst === "Har vært kollisjonsskadet: Bulk i bakdør, reparert 2020"));
});

test("lesEgenvurdering tåler tomme og ugyldige data", () => {
  const e = lesEgenvurdering({ omrader: { motor: { tg: "TG9" } } });
  assert.equal(e.omrader.motor.tg, "TGIU");
  assert.equal(Object.keys(e.omrader).length, OMRADER.length);
  assert.deepEqual(lesEgenvurdering(null), tomEgenvurdering());
  assert.equal(TILSTANDSGRADER.length, 5);
  assert.ok(SPORSMAL.find((s) => s.id === "kollisjon"));
});

test("uten historikk sier rapporten det rett ut", () => {
  const r = lagTilstandsrapport({ bil: { kjennemerke: "AB12345", vedlikehold: [] }, idag });
  assert.ok(r.sammendrag.some((s) => s.type === "obs" && s.tekst.includes("Ingen vedlikeholdshistorikk")));
  assert.equal(r.etterBoka.maalt, 0);
});

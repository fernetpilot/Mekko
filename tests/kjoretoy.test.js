import { test } from "node:test";
import assert from "node:assert/strict";
import { hentKjoretoy, normaliserSkilt } from "../public/js/kjoretoy.js";

test("normaliserSkilt fjerner mellomrom og godtar bare gyldige skilt", () => {
  assert.equal(normaliserSkilt("br 67 285"), "BR67285");
  assert.equal(normaliserSkilt("BR-67285"), "BR67285");
  assert.equal(normaliserSkilt("x"), null);
  assert.equal(normaliserSkilt("ABCD12345"), null);
});

// Utdrag av ekte svar for BR67285 (feltnavn bekreftet mot API-et 10.10.2026)
const svar = {
  kjoretoydataListe: [{
    kjoretoyId: { kjennemerke: "BR 67285" },
    forstegangsregistrering: { registrertForstegangNorgeDato: "2008-07-01" },
    periodiskKjoretoyKontroll: { kontrollfrist: "2028-06-03", sistGodkjent: "2026-05-28" },
    godkjenning: {
      forstegangsGodkjenning: { forstegangRegistrertDato: "2008-03-28" },
      tekniskGodkjenning: {
        kjoretoyklassifisering: { beskrivelse: "Personbil", tekniskKode: { kodeVerdi: "M1G" } },
        tekniskeData: {
          generelt: { merke: [{ merke: "LAND ROVER" }], handelsbetegnelse: ["DISCOVERY 3"] },
          vekter: { egenvekt: 2560 },
        },
      },
    },
  }],
};

test("hentKjoretoy leser EU-kontroll og førstegangsregistrering", () => {
  const k = hentKjoretoy(svar);
  assert.equal(k.euKontrollfrist, "2028-06-03");
  assert.equal(k.euSistGodkjent, "2026-05-28");
  assert.equal(k.forstegangsregistrert, "2008-03-28");
  assert.equal(k.erTilhenger, false);
  assert.equal(k.merke, "LAND ROVER");
});

test("hentKjoretoy tåler at EU-kontroll mangler", () => {
  const uten = structuredClone(svar);
  delete uten.kjoretoydataListe[0].periodiskKjoretoyKontroll;
  assert.equal(hentKjoretoy(uten).euKontrollfrist, null);
});

import { tryggFilnavn, erPdf } from "../public/js/dokumenter.js";

test("tryggFilnavn lager trygge filnavn for lagring", () => {
  assert.equal(tryggFilnavn("Kvittering Bilxtra (1).jpg"), "Kvittering_Bilxtra_1_.jpg");
  assert.equal(tryggFilnavn("Ørsta bremser æå.pdf"), "Orsta_bremser_aea.pdf");
  assert.equal(tryggFilnavn("../../hemmelig"), ".._.._hemmelig");
  assert.equal(tryggFilnavn(""), "fil");
  assert.equal(tryggFilnavn("a".repeat(200) + ".pdf").length, 80);
});

test("erPdf kjenner igjen PDF på type eller filendelse", () => {
  assert.equal(erPdf({ type: "application/pdf", name: "x" }), true);
  assert.equal(erPdf({ type: "", name: "ordre.PDF" }), true);
  assert.equal(erPdf({ type: "image/jpeg", name: "bilde.jpg" }), false);
});

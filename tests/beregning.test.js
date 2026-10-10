import { test } from "node:test";
import assert from "node:assert/strict";
import { beregnMaksLast, sjekkForerkort, kreverForerkort } from "../public/js/beregning.js";
import { hentKjoretoy } from "../public/js/kjoretoy.js";

// Ekte data hentet fra API-et (docs/eksempeldata/vekter-eksempler.md)
const discovery = {
  egenvekt: 2560, tillattTotalvekt: 3230,
  tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750,
  tillattVogntogvekt: 6730, tillattVertikalKoplingslast: 150,
};
const tara = { egenvekt: 832, tillattTotalvekt: 3500, tillattVertikalKoplingslast: 150 };

// Konstruerte eksempler
const golf = {
  egenvekt: 1300, tillattTotalvekt: 1800,
  tillattTilhengervektMedBrems: 1500, tillattTilhengervektUtenBrems: 650,
  tillattVogntogvekt: 3300, tillattVertikalKoplingslast: 75,
};
const lettHenger = { egenvekt: 180, tillattTotalvekt: 750, tillattVertikalKoplingslast: 75 };
const middelsHenger = { egenvekt: 350, tillattTotalvekt: 1500, tillattVertikalKoplingslast: 100 };
const varebilTung = { ...discovery, tillattTotalvekt: 3600 };

// --- Førerkort (§ 3-5 og § 3-11) -------------------------------------------

test("B: henger på 750 kg er alltid lov", () => {
  assert.equal(sjekkForerkort(3230, 750, "B").ok, true);
});

test("B: sum over 3500 kg er ikke lov", () => {
  assert.equal(sjekkForerkort(1800, 1800, "B").ok, false);
});

test("B: sum på nøyaktig 3500 kg er lov", () => {
  assert.equal(sjekkForerkort(1800, 1700, "B").ok, true);
});

test("B96: sum inntil 4250 kg er lov", () => {
  assert.equal(sjekkForerkort(2500, 1750, "B96").ok, true);
  assert.equal(sjekkForerkort(2500, 1751, "B96").ok, false);
});

test("BE: henger inntil 3500 kg er lov", () => {
  assert.equal(sjekkForerkort(3230, 3500, "BE").ok, true);
  assert.equal(sjekkForerkort(3230, 3501, "BE").ok, false);
});

test("Bil over 3500 kg dekkes ikke av B, B96 eller BE", () => {
  for (const k of ["B", "B96", "BE"]) assert.equal(sjekkForerkort(3600, 750, k).ok, false);
});

test("Maks registrert hengervekt for B med Discovery er 750 kg", () => {
  assert.equal(sjekkForerkort(3230, 3500, "B").maksHengerTotalvekt, 750);
  assert.equal(sjekkForerkort(3230, 3500, "B96").maksHengerTotalvekt, 1020);
});

test("Discovery + Tara krever BE", () => {
  assert.equal(kreverForerkort(3230, 3500), "BE");
});

// --- Hele beregningen ------------------------------------------------------

test("Discovery + Tara med BE: maks 2668 kg, hengeren begrenser", () => {
  const r = beregnMaksLast({ bil: discovery, henger: tara, forerkort: "BE" });
  assert.equal(r.lovlig, true);
  assert.equal(r.maksLast, 2668);
  assert.equal(r.begrensning, "henger");
  assert.equal(r.maksKuletrykk, 150);
});

test("Discovery + Tara med B: ikke lov, førerkortet begrenser", () => {
  const r = beregnMaksLast({ bil: discovery, henger: tara, forerkort: "B" });
  assert.equal(r.lovlig, false);
  assert.equal(r.maksLast, 0);
  assert.equal(r.begrensning, "forerkort");
  assert.equal(r.forerkort.kreves, "BE");
});

test("Golf + middels henger med BE: bilens tilhengervekt begrenser", () => {
  const r = beregnMaksLast({ bil: golf, henger: middelsHenger, forerkort: "BE", bilFaktiskVekt: 1500 });
  // henger: 1150, bil: 1500-350=1150, vogntog: 3300-1500-350=1450
  assert.equal(r.maksLast, 1150);
});

test("Fullastet bil: vogntogvekten begrenser", () => {
  const bil = { ...golf, tillattTilhengervektMedBrems: 2000, tillattVogntogvekt: 3200 };
  const r = beregnMaksLast({ bil, henger: middelsHenger, forerkort: "BE" });
  // henger: 1150, bil: 2000-350=1650, vogntog: 3200-1800-350=1050
  assert.equal(r.maksLast, 1050);
  assert.equal(r.begrensning, "vogntog");
  assert.equal(r.advarsler.length, 1);
});

test("Lett henger uten brems bruker bilens tilhengervekt uten brems", () => {
  const r = beregnMaksLast({ bil: golf, henger: lettHenger, forerkort: "B", bilFaktiskVekt: 1500 });
  // henger: 570, bil uten brems: 650-180=470
  assert.equal(r.harBrems, false);
  assert.equal(r.maksLast, 470);
  assert.equal(r.begrensning, "bil");
});

test("Bil uten tilhengervekt kan ikke trekke henger", () => {
  const bil = { ...golf, tillattTilhengervektMedBrems: null, tillattTilhengervektUtenBrems: null };
  const r = beregnMaksLast({ bil, henger: lettHenger, forerkort: "B" });
  assert.equal(r.maksLast, 0);
  assert.equal(r.begrensning, "bil");
});

test("Bil over 3500 kg: ikke lov med BE", () => {
  const r = beregnMaksLast({ bil: varebilTung, henger: lettHenger, forerkort: "BE" });
  assert.equal(r.lovlig, false);
  assert.equal(r.forerkort.kreves, null);
});

// --- Uttrekk fra API-svar --------------------------------------------------

test("hentKjoretoy leser vekter og kjenner igjen tilhenger", () => {
  const svar = {
    kjoretoydataListe: [{
      kjoretoyId: { kjennemerke: "NZ7887" },
      godkjenning: { tekniskGodkjenning: {
        kjoretoyklassifisering: { beskrivelse: "Påhengsvogn", tekniskKode: { kodeVerdi: "O2" } },
        tekniskeData: {
          generelt: { merke: [{ merke: "TEMARED" }], handelsbetegnelse: ["Tara Pluss/3"] },
          vekter: tara,
        },
      } },
    }],
  };
  const k = hentKjoretoy(svar);
  assert.equal(k.erTilhenger, true);
  assert.equal(k.merke, "TEMARED");
  assert.equal(k.vekter.tillattTotalvekt, 3500);
  assert.equal(k.vekter.tillattVogntogvekt, null);
});

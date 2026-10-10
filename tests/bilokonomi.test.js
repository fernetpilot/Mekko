import { test } from "node:test";
import assert from "node:assert/strict";
import { oppsummer, estimerVerdi, VERDI_ANTAKELSER } from "../public/js/bilokonomi.js";

const idag = new Date(2026, 9, 11);
const hendelser = [
  { dato: "2019-04-02", komponent: "service", kostnad: 6000, kilometerstand: 98000 },   // før kjøp
  { dato: "2022-03-01", komponent: "service", kostnad: 5000, kilometerstand: 120000 },
  { dato: "2022-03-01", komponent: "bremser", kostnad: 3000, kilometerstand: 120000 },
  { dato: "2023-11-01", komponent: "dekk", kostnad: 8000, kilometerstand: 135000 },
  { dato: "2024-05-28", komponent: "eu_kontroll", kostnad: 1000, kilometerstand: 140000 },
  { dato: "2025-06-10", komponent: "annet", kostnad: null, kilometerstand: 150000 },
  { dato: "2026-01-15", komponent: "motor", kostnad: 2000, kilometerstand: 158000 },
];

test("oppsummer: bare kostnader etter kjøp, fordelt på kategori", () => {
  const o = oppsummer(hendelser, { kjopsdato: "2022-01-01", kjopsKm: 118000, kmNaa: 160000, idag });
  assert.equal(o.total, 19000);
  assert.deepEqual(o.perKategori, { service: 5000, motor: 2000, bremser: 3000, dekk: 8000, eu_kontroll: 1000, annet: 0 });
  assert.equal(o.kategorier.length, 5);
  assert.equal(o.antallMedKostnad, 5);
  assert.equal(o.antallUtenKostnad, 1);
  assert.equal(o.kmKjort, 42000);
  assert.ok(Math.abs(o.perKm - 19000 / 42000) < 1e-9);
});

test("oppsummer: alle år med, også år uten kostnad, og akkumulert kurve", () => {
  const o = oppsummer(hendelser, { kjopsdato: "2022-01-01", idag });
  assert.deepEqual(o.perAr.map((p) => p.ar), [2022, 2023, 2024, 2025, 2026]);
  assert.deepEqual(o.perAr.map((p) => p.sum), [8000, 8000, 1000, 0, 2000]);
  assert.deepEqual(o.akkumulert.map((p) => p.sum), [0, 8000, 16000, 17000, 19000]);
  assert.equal(o.akkumulert[0].dato, "2022-01-01");
  assert.ok(Math.abs(o.snittPerAr - 19000 / o.ar) < 1e-9 && o.ar > 4.7 && o.ar < 4.8);
});

test("oppsummer uten kjøpsdato bruker hele historikken", () => {
  const o = oppsummer(hendelser, { idag });
  assert.equal(o.total, 25000);
  assert.equal(o.start, "2019-04-02");
});

test("oppsummer uten data", () => {
  const o = oppsummer([], { idag });
  assert.equal(o.total, 0);
  assert.equal(o.snittPerAr, null);
  assert.equal(o.perKm, null);
  assert.deepEqual(o.perAr, []);
});

test("verdianslag: verditap, km og utbedringer", () => {
  const v = estimerVerdi({
    kjopspris: 300000, kjopsdato: "2022-01-01", kjopsKm: 118000, kmNaa: 160000,
    forstegangsregistrert: "2008-03-28", hendelser, idag,
  });
  // Bilen var 13+ år ved kjøp: 6 % per år i ~4,8 år ≈ 0,743
  const grunn = 300000 * (1 - 0.06) ** ((idag - new Date(2022, 0, 1)) / (365.25 * 86400000));
  assert.ok(Math.abs(v.steg[1].verdi - (grunn - 300000)) < 1);
  // 42 000 km mot normalt ~71 700 km: kjørt mindre enn normalt → faktor over 1
  assert.ok(v.steg[2].verdi > 0);
  // Utbedringer siste 3 år: dekk 8 000 (bremser 2022 er eldre enn 3 år) → 30 % = 2 400
  assert.equal(Math.round(v.steg[3].verdi), 2400);
  assert.equal(v.verdi % 1000, 0);
  assert.ok(v.lav < v.verdi && v.verdi < v.hoy);
});

test("verdianslag: ny bil taper mer per år, og verdien går ikke under gulvet", () => {
  const ny = estimerVerdi({ kjopspris: 500000, kjopsdato: "2024-10-11", forstegangsregistrert: "2024-10-11", idag });
  // 2 år à 15 %: 500 000 × 0,85² = 361 250
  assert.ok(Math.abs(ny.verdi - 361000) <= 1000);
  const gammel = estimerVerdi({ kjopspris: 50000, kjopsdato: "1990-01-01", forstegangsregistrert: "1980-01-01", idag });
  assert.equal(gammel.verdi, 50000 * VERDI_ANTAKELSER.gulvAndel);
});

test("verdianslag krever kjøpspris og kjøpsdato", () => {
  assert.equal(estimerVerdi({ kjopspris: 0, kjopsdato: "2022-01-01", idag }), null);
  assert.equal(estimerVerdi({ kjopspris: 100000, idag }), null);
});

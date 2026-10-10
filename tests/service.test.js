// Tester for servicefrister. Kjører med: npm test
// Regelen: det som kommer først (km eller måned) gjelder.

import { test } from "node:test";
import assert from "node:assert/strict";
import { beregnServicefrist, leggTilMåneder } from "../public/js/service.js";

const OLJE = { id: "motorolje", navn: "Motorolje", kmIntervall: 10000, manederIntervall: 12 };
const KJOLEVAESKE = { id: "kjolevaeske", navn: "Kjølevæske", kmIntervall: null, manederIntervall: 60 };

test("legger til måneder og holder seg innenfor måneden", () => {
  assert.equal(leggTilMåneder("2025-01-15", 12), "2026-01-15");
  assert.equal(leggTilMåneder("2025-01-31", 1), "2025-02-28");
  assert.equal(leggTilMåneder("2024-01-31", 1), "2024-02-29");
  assert.equal(leggTilMåneder("2025-11-10", 3), "2026-02-10");
});

test("uten registrering er status ukjent", () => {
  const res = beregnServicefrist({ punkt: OLJE, sist: null, idag: "2025-06-01", kmNaa: 105000 });
  assert.equal(res.status, "ukjent");
});

test("langt unna begge frister gir ok", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2025-06-01",
    kmNaa: 104000,
  });
  assert.equal(res.status, "ok");
  assert.equal(res.neste.km, 110000);
  assert.equal(res.gjenstaar.km, 6000);
  assert.equal(res.neste.dato, "2026-01-01");
});

test("km-fristen nær gir snart", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2025-06-01",
    kmNaa: 109500,
  });
  assert.equal(res.status, "snart");
  assert.equal(res.gjenstaar.km, 500);
});

test("passert km-frist gir forfalt, selv om datoen er god", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2025-06-01",
    kmNaa: 110200,
  });
  assert.equal(res.status, "forfalt");
});

test("passert datofrist gir forfalt, selv om km er god", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2026-02-01",
    kmNaa: 103000,
  });
  assert.equal(res.status, "forfalt");
});

test("snart på dato når det er under 90 dager igjen", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2025-12-15",
    kmNaa: 102000,
  });
  assert.equal(res.status, "snart");
  assert.equal(res.gjenstaar.dager, 17);
});

test("uten kilometerstand brukes bare datoen", () => {
  const res = beregnServicefrist({
    punkt: OLJE,
    sist: { dato: "2025-01-01", km: 100000 },
    idag: "2025-06-01",
    kmNaa: null,
  });
  assert.equal(res.status, "ok");
  assert.equal(res.gjenstaar.km, null);
});

test("punkt uten kmIntervall bruker bare måneder", () => {
  const res = beregnServicefrist({
    punkt: KJOLEVAESKE,
    sist: { dato: "2020-03-10", km: null },
    idag: "2025-06-01",
    kmNaa: 150000,
  });
  assert.equal(res.status, "forfalt");
  assert.equal(res.neste.dato, "2025-03-10");
  assert.equal(res.neste.km, null);
});

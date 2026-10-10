// Tester for servicevarsler. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceVarsler } from "../public/js/servicevarsler.js";
import { lagVarsler } from "../public/js/varsler.js";
import { LR3_2_7_TDV6 } from "../public/js/servicepunkter.js";

const bil = { kjennemerke: "BR67285", merke: "LAND ROVER", modell: "DISCOVERY 3" };
const OLJE = LR3_2_7_TDV6.find((p) => p.id === "motorolje");
const idag = new Date(Date.UTC(2025, 5, 1)); // 1. juni 2025

test("ingen varsel når alt er ok", () => {
  const v = serviceVarsler(bil, {
    punkter: [OLJE],
    sisteUtfort: { motorolje: { dato: "2025-01-01", km: 100000 } },
    kmNaa: 103000,
  }, idag);
  assert.deepEqual(v, []);
});

test("ingen varsel når status er ukjent", () => {
  assert.deepEqual(serviceVarsler(bil, { punkter: [OLJE], sisteUtfort: {}, kmNaa: 103000 }, idag), []);
});

test("snart gir sjekk-varsel med dato og km", () => {
  const [v] = serviceVarsler(bil, {
    punkter: [OLJE],
    sisteUtfort: { motorolje: { dato: "2025-01-01", km: 100000 } },
    kmNaa: 109500,
  }, idag);
  assert.equal(v.niva, "sjekk");
  assert.equal(v.id, "service:motorolje:BR67285");
  assert.match(v.tekst, /110 000 km/);
  assert.match(v.tittel, /snart/);
});

test("forfalt gir vennlig sjekk-varsel", () => {
  const [v] = serviceVarsler(bil, {
    punkter: [OLJE],
    sisteUtfort: { motorolje: { dato: "2025-01-01", km: 100000 } },
    kmNaa: 111000,
  }, idag);
  assert.equal(v.niva, "sjekk");
  assert.match(v.tekst, /burde vært gjort/);
});

test("servicevarsler kommer med i lagVarsler, kritiske først", () => {
  const biler = [
    { kjennemerke: "BR67285", merke: "LAND ROVER", modell: "DISCOVERY 3", eu_kontrollfrist: "2026-09-01" },
  ];
  const service = {
    BR67285: {
      punkter: [OLJE],
      sisteUtfort: { motorolje: { dato: "2025-01-01", km: 100000 } },
      kmNaa: 111000,
    },
  };
  const varsler = lagVarsler(biler, new Date(Date.UTC(2026, 9, 10)), service);
  assert.deepEqual(varsler.map((v) => v.niva), ["kritisk", "sjekk"]);
});

import { sisteUtfortPerPunkt } from "../public/js/servicevarsler.js";

test("siste utførte per punkt velger nyeste dato", () => {
  const siste = sisteUtfortPerPunkt([
    { servicepunkt: "motorolje", dato: "2024-05-01", kilometerstand: 90000 },
    { servicepunkt: "motorolje", dato: "2025-01-01", kilometerstand: 100000 },
    { servicepunkt: "motorolje", dato: "2024-11-01", kilometerstand: 95000 },
    { servicepunkt: "bremsevaeske", dato: "2023-03-03", kilometerstand: null },
  ]);
  assert.deepEqual(siste.motorolje, { dato: "2025-01-01", km: 100000 });
  assert.deepEqual(siste.bremsevaeske, { dato: "2023-03-03", km: null });
});

test("rader uten servicepunkt hoppes over", () => {
  assert.deepEqual(sisteUtfortPerPunkt([{ servicepunkt: null, dato: "2025-01-01", kilometerstand: 1 }]), {});
  assert.deepEqual(sisteUtfortPerPunkt(null), {});
});

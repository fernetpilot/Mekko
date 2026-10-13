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

test("deler som aldri er registrert gir ett samlet «bør sjekkes»-varsel", () => {
  const BREMS = LR3_2_7_TDV6.find((p) => p.id === "bremsevaeske");
  const KJOL = LR3_2_7_TDV6.find((p) => p.id === "kjolevaeske");
  const v = serviceVarsler(bil, { punkter: [OLJE, BREMS, KJOL], sisteUtfort: { motorolje: { dato: "2025-01-01", km: 100000 } }, kmNaa: 103000 }, idag);
  assert.equal(v.length, 1);
  assert.equal(v[0].id, "service:ukjent:BR67285");
  assert.equal(v[0].niva, "sjekk");
  assert.equal(v[0].tittel, "2 deler bør sjekkes");
  assert.match(v[0].tekst, /Bremsevæske, Kjølevæske/);
});

test("ett uregistrert punkt får navnet i tittelen", () => {
  const [v] = serviceVarsler(bil, { punkter: [OLJE], sisteUtfort: {}, kmNaa: 103000 }, idag);
  assert.equal(v.tittel, "Bør sjekkes: motorolje");
});

test("registrert automatgir gjør at manuelt gir ikke etterlyses", () => {
  const v = serviceVarsler(bil, {
    punkter: LR3_2_7_TDV6.filter((p) => p.gjelderFor),
    sisteUtfort: { automatgir: { dato: "2025-01-01", km: 100000 } },
    kmNaa: 103000,
  }, idag);
  assert.deepEqual(v, []);
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
    { servicepunkter: ["motorolje"], dato: "2024-05-01", kilometerstand: 90000 },
    { servicepunkter: ["motorolje"], dato: "2025-01-01", kilometerstand: 100000 },
    { servicepunkter: ["motorolje"], dato: "2024-11-01", kilometerstand: 95000 },
    { servicepunkter: ["bremsevaeske"], dato: "2023-03-03", kilometerstand: null },
  ]);
  assert.deepEqual(siste.motorolje, { dato: "2025-01-01", km: 100000 });
  assert.deepEqual(siste.bremsevaeske, { dato: "2023-03-03", km: null });
});

test("rader uten deler hoppes over", () => {
  assert.deepEqual(sisteUtfortPerPunkt([{ servicepunkter: [], dato: "2025-01-01", kilometerstand: 1 }]), {});
  assert.deepEqual(sisteUtfortPerPunkt(null), {});
});

import { servicelinjer } from "../public/js/servicevarsler.js";
import { punkterFor } from "../public/js/servicepunkter.js";

test("servicelinjer viser status og frist per punkt", () => {
  const linjer = servicelinjer(
    [OLJE, { id: "bremsevaeske", navn: "Bremsevæske", kmIntervall: null, manederIntervall: 60 }],
    [{ servicepunkter: ["motorolje"], dato: "2025-01-01", kilometerstand: 100000 }],
    109500,
    idag,
  );
  assert.equal(linjer[0].status, "snart");
  assert.equal(linjer[0].label, "Snart");
  assert.match(linjer[0].frist, /110 000 km/);
  assert.equal(linjer[1].status, "ukjent");
  assert.equal(linjer[1].label, "Ingen registrering ennå");
  assert.equal(linjer[1].frist, "");
});

test("punkterFor gir bare punkter for Discovery 3", () => {
  assert.equal(punkterFor({ modell: "DISCOVERY 3" }).length, LR3_2_7_TDV6.length);
  assert.deepEqual(punkterFor({ modell: "GLA 180" }), []);
  assert.deepEqual(punkterFor(null), []);
});

test("servicelinjer gir km igjen og intervall for stolpen", () => {
  const [olje] = servicelinjer(
    [OLJE],
    [{ servicepunkter: ["motorolje"], dato: "2025-01-01", kilometerstand: 100000 }],
    104000,
    idag,
  );
  assert.equal(olje.kmIgjen, 6000);
  assert.equal(olje.kmIntervall, 10000);
});

test("drivstoffilter (diesel): 20 000 km eller 24 måneder", () => {
  const p = LR3_2_7_TDV6.find((x) => x.id === "drivstoffilter-diesel");
  assert.equal(p.kmIntervall, 20000);
  assert.equal(p.manederIntervall, 24);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { kpi, kpiJuster, kmPerAar, egenPris, lagPrognose, PRISER, STANDARD_KM_PER_AAR } from "../public/js/prognose.js";

const idag = new Date("2026-10-27T12:00:00Z");

test("KPI: 2025 = 100, og justering mellom år følger inflasjonen", () => {
  assert.equal(kpi(2025), 100);
  assert.ok(Math.abs(kpi(2024) - 100 / 1.031) < 1e-9);
  assert.ok(Math.abs(kpiJuster(1000, 2025, 2026) - 1029) < 0.01);
  assert.ok(kpi(2010) < kpi(2020) && kpi(2020) < kpi(2030));
});

test("km per år ut fra kilometerstandene, ellers standard", () => {
  const h = [
    { dato: "2023-10-27", kilometerstand: 100000 },
    { dato: "2025-10-27", kilometerstand: 120000 },
  ];
  assert.equal(kmPerAar(h, { kmNaa: 130000, idag }).km, 10000);
  assert.deepEqual(kmPerAar([], { idag }), { km: STANDARD_KM_PER_AAR, anslatt: true });
});

test("egen pris: bare hendelser med akkurat den jobben, KPI-justert", () => {
  const h = [
    { dato: "2025-03-01", kostnad: 2000, servicepunkter: ["motorolje", "oljefilter"] },
    { dato: "2026-01-01", kostnad: 9000, servicepunkter: ["motorolje", "bremseklosser"] }, // blandet: hoppes over
  ];
  const p = egenPris("motorolje", h, 2026);
  assert.equal(p.aar, 2025);
  assert.ok(Math.abs(p.pris - 2058) < 1);
  assert.equal(egenPris("bremseklosser", h, 2026), null);
});

const bil = {
  modell: "DISCOVERY 3", kilometerstand: 130000, eu_kontrollfrist: "2027-05-01",
  vedlikehold: [
    { dato: "2026-06-01", kilometerstand: 125000, kostnad: 2500, servicepunkter: ["motorolje", "oljefilter"] },
    { dato: "2024-06-01", kilometerstand: 105000, kostnad: 20000, servicepunkter: ["turbo"] },
    { dato: "2022-06-01", kilometerstand: 85000, kostnad: 1000, servicepunkter: ["automatgir"] },
  ],
};

test("prognosen har planlagte jobber med kilde og EU-kontroll hvert andre år", () => {
  const p = lagPrognose(bil, { idag });
  assert.equal(p.perAar[0].ar, 2026);
  assert.equal(p.perAar.at(-1).ar, 2031);
  const eu = p.poster.filter((x) => x.id === "eu_kontroll").map((x) => x.dato);
  assert.deepEqual(eu, ["2027-05-01", "2029-05-01", "2031-05-01"]);
  // Oljeskift: egen pris; ingen manuell girolje når automat er registrert
  const olje = p.poster.find((x) => x.id === "motorolje");
  assert.equal(olje.kilde, "egen");
  assert.ok(!p.poster.some((x) => x.id === "manuelt-gir" || x.id === "oljefilter"));
  // Bare planlagt vedlikehold: turboen fra 2024 gir ingen post
  assert.ok(!p.poster.some((x) => x.id === "turbo"));
  assert.equal(p.total, p.perAar.reduce((n, a) => n + a.planlagt, 0));
  assert.equal(p.total, p.poster.reduce((n, x) => n + x.pris, 0));
  assert.equal(p.kurve.length, 61);
  assert.equal(p.kurve.at(-1).sum, p.total);
  assert.ok(p.kurve.every((k, i) => i === 0 || k.sum >= p.kurve[i - 1].sum));
});

test("bil uten serviceplan får årlig service", () => {
  const p = lagPrognose({ modell: "GOLF", kilometerstand: 50000, vedlikehold: [] }, { idag });
  assert.ok(p.poster.some((x) => x.id === "service" && x.kilde === "anslag"));
  assert.equal(p.harServiceplan, false);
  assert.ok(PRISER.service.pris > 0);
});

test("egen pris: jobber gjort selv, eller som bare er deler, teller ikke", () => {
  const h = [
    { dato: "2026-01-01", kostnad: 900, servicepunkter: ["motorolje"], utfort_av: "Byttet selv" },
    { dato: "2025-06-01", kostnad: 600, servicepunkter: ["motorolje"], utfort_av: "Verksted AS" }, // under halve anslaget
  ];
  assert.equal(egenPris("motorolje", h, 2026), null);
});

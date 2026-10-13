// Tester for «Fulgt etter boka?» (utførte jobber mot anbefalt intervall). Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { intervallStatus, jobberFor, maalIntervall, punktHistorikk, etterBoka } from "../public/js/etter-boka.js";

const idag = new Date(Date.UTC(2026, 9, 13)); // 13. oktober 2026
const olje = { id: "motorolje", navn: "Motorolje", kmIntervall: 10000, manederIntervall: 12 };

const rader = [
  { servicepunkter: ["motorolje", "oljefilter"], dato: "2022-03-01", kilometerstand: 180000 },
  { servicepunkter: ["motorolje"], dato: "2023-02-15", kilometerstand: 189000 }, // i tide
  { servicepunkter: ["motorolje"], dato: "2024-06-01", kilometerstand: 197000 }, // 129 % (tid): gul
  { servicepunkter: ["motorolje"], dato: "2025-03-01", kilometerstand: 211000 }, // 140 % (km): rød
  { servicepunkter: ["motorolje"], dato: "2025-03-01", kilometerstand: null },   // dublett
  { servicepunkter: ["bremsevaeske"], dato: "2024-01-01", kilometerstand: 195000 },
];

test("jobberFor: sortert, uten dubletter og rader uten dato", () => {
  const j = jobberFor("motorolje", [...rader, { servicepunkter: ["motorolje"], dato: null }]);
  assert.deepEqual(j.map((x) => x.dato), ["2022-03-01", "2023-02-15", "2024-06-01", "2025-03-01"]);
  assert.equal(j.at(-1).km, 211000);
});

test("intervallStatus: km 100/120 %, tid 120/160 %", () => {
  assert.equal(intervallStatus(1, "km"), "ok");
  assert.equal(intervallStatus(1.15, "km"), "litt");
  assert.equal(intervallStatus(1.2, "km"), "litt");
  assert.equal(intervallStatus(1.21, "km"), "over");
  assert.equal(intervallStatus(1.2, "tid"), "ok");
  assert.equal(intervallStatus(1.5, "tid"), "litt");
  assert.equal(intervallStatus(1.6, "tid"), "litt");
  assert.equal(intervallStatus(1.61, "tid"), "over");
  assert.equal(intervallStatus(null), "ukjent");
});

test("maalIntervall: den dårligste av km og tid gjelder", () => {
  // 15 mnd (125 % tid: gul), 9 000 km (90 %: grønn) → gul
  const a = maalIntervall(olje, { dato: "2023-01-01", km: 100000 }, { dato: "2024-04-01", km: 109000 });
  assert.equal(a.status, "litt");
  // 13 mnd (108 % tid: grønn), 13 000 km (130 %: rød) → rød
  const b = maalIntervall(olje, { dato: "2023-01-01", km: 100000 }, { dato: "2024-02-01", km: 113000 });
  assert.equal(b.status, "over");
  assert.equal(b.iTide, false);
});

test("maalIntervall: grensen som nås først teller", () => {
  const a = maalIntervall(olje, { dato: "2023-01-01", km: 100000 }, { dato: "2023-07-01", km: 115000 });
  assert.equal(a.km, 15000);
  assert.equal(a.andel, 1.5);
  assert.equal(a.iTide, false);
  // Nøyaktig 12 måneder (også over skuddår) er i tide
  const b = maalIntervall(olje, { dato: "2023-03-01", km: null }, { dato: "2024-03-01", km: null });
  assert.equal(b.andel, 1);
  assert.equal(b.iTide, true);
  assert.equal(b.km, null);
  // Bare km-grense og ingen km: kan ikke måles
  const c = maalIntervall({ id: "x", kmIntervall: 30000, manederIntervall: null }, { dato: "2023-01-01", km: null }, { dato: "2024-01-01", km: 5 });
  assert.equal(c.andel, null);
  assert.equal(c.iTide, null);
});

test("punktHistorikk: intervaller, i tide, snitt og åpent intervall til i dag", () => {
  const h = punktHistorikk(olje, rader, { idag, kmNaa: 216000 });
  assert.equal(h.intervaller.length, 3);
  assert.deepEqual(h.intervaller.map((x) => x.iTide), [true, true, false]);
  assert.equal(h.maalt, 3);
  assert.equal(h.iTide, 2);
  assert.deepEqual(h.intervaller.map((x) => x.status), ["ok", "litt", "over"]);
  assert.equal(h.status, "over");
  assert.equal(h.snittKm, 10333);
  assert.equal(h.naa.apen, true);
  assert.equal(h.naa.fra, "2025-03-01");
  assert.equal(h.naa.km, 5000);
  assert.ok(h.naa.andel > 1); // over 12 måneder siden
});

test("punktHistorikk: gule teller som i tide", () => {
  const h = punktHistorikk(olje, [
    { servicepunkter: ["motorolje"], dato: "2023-01-01", kilometerstand: 100000 },
    { servicepunkter: ["motorolje"], dato: "2023-12-01", kilometerstand: 111500 }, // 115 %: gul
  ], { idag });
  assert.equal(h.intervaller[0].status, "litt");
  assert.equal(h.iTide, 1);
  assert.equal(h.status, "litt");
});

test("punktHistorikk: én jobb gir ingen målte intervaller", () => {
  const h = punktHistorikk(olje, rader.slice(0, 1), { idag });
  assert.equal(h.intervaller.length, 0);
  assert.equal(h.maalt, 0);
  assert.equal(h.snittManeder, null);
  assert.equal(h.naa.km, null);
});

test("etterBoka: bare punkter med jobber, og summen over alle", () => {
  const bil = { modell: "DISCOVERY 3", kilometerstand: 216000, vedlikehold: rader };
  const o = etterBoka(bil, idag);
  assert.deepEqual(o.punkter.map((p) => p.id), ["motorolje", "oljefilter", "bremsevaeske"]);
  assert.equal(o.maalt, 3);
  assert.equal(o.iTide, 2);
  // Andre biler: bare slitasjedelene har intervall
  assert.deepEqual(etterBoka({ modell: "GOLF", vedlikehold: rader }, idag).punkter, []);
});

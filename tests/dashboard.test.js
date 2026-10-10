// Tester for oversiktssidene (Service og EU-kontroll, Vedlikehold). Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bilNavn, velgBil, normaliserStatus, formaterKr, maanedNavn,
  alleFrister, sorterFrister, aarshjul, nesteService, slitasjeOppsummering,
  hendelseTittel, sorterHendelser, sumKostnad, vedlikeholdOversikt,
} from "../public/js/dashboard.js";

const idag = new Date(Date.UTC(2026, 9, 10)); // 10. oktober 2026

const bil = {
  id: "b1",
  kjennemerke: "DK12345",
  merke: "LAND ROVER",
  modell: "DISCOVERY 3",
  kilometerstand: 231000,
  eu_kontrollfrist: "2026-11-20",
  dekk_type: "vinter",
  dekk_montert: "2023-10-15",
  dekk_mm: 6,
  vedlikehold: [
    { id: "v1", komponent: "service", servicepunkter: ["motorolje", "oljefilter", "luftfilter"], dato: "2026-03-01", kilometerstand: 224000, kostnad: 4200 },
    { id: "v2", komponent: "bremser", servicepunkter: ["bremseklosser"], dato: "2025-06-10", kilometerstand: 205000, kostnad: "3150.50" },
    { id: "v3", komponent: "service", servicepunkter: ["bremsevaeske"], dato: "2021-09-01", kilometerstand: 170000, kostnad: null },
    { id: "v4", komponent: "annet", servicepunkter: [], dato: "2025-01-05", kilometerstand: null, kostnad: 990 },
  ],
  utsettelser: [],
};

const finn = (frister, id) => frister.find((f) => f.id === id);

test("bilNavn og velgBil", () => {
  assert.equal(bilNavn(bil), "LAND ROVER DISCOVERY 3");
  assert.equal(bilNavn({ ...bil, kallenavn: "Disco" }), "Disco");
  const biler = [{ id: "a" }, { id: "b" }];
  assert.equal(velgBil(biler, "b").id, "b");
  assert.equal(velgBil(biler, "finnes-ikke").id, "a");
  assert.equal(velgBil(biler, null).id, "a");
  assert.equal(velgBil([], "a"), null);
});

test("normaliserStatus og formatering", () => {
  assert.equal(normaliserStatus("kritisk"), "forfalt");
  assert.equal(normaliserStatus("sjekk"), "snart");
  assert.equal(normaliserStatus("ok"), "ok");
  assert.equal(normaliserStatus("noe-rart"), "ukjent");
  assert.equal(formaterKr(12345.6), "12 346 kr");
  assert.equal(formaterKr(null), "–");
  assert.equal(maanedNavn("2027-01"), "januar 2027");
});

test("alleFrister: EU-kontroll med dager igjen og status", () => {
  const eu = finn(alleFrister(bil, idag), "eu");
  assert.equal(eu.dato, "2026-11-20");
  assert.equal(eu.dagerIgjen, 41);
  assert.equal(eu.status, "snart");
  const passert = finn(alleFrister({ ...bil, eu_kontrollfrist: "2026-09-01" }, idag), "eu");
  assert.equal(passert.status, "forfalt");
  const ingen = finn(alleFrister({ ...bil, eu_kontrollfrist: null }, idag), "eu");
  assert.equal(ingen.status, "ukjent");
});

test("alleFrister: servicepunkter får neste dato og km", () => {
  const frister = alleFrister(bil, idag);
  const olje = finn(frister, "motorolje");
  assert.equal(olje.kilde, "service");
  assert.equal(olje.dato, "2027-03-01");
  assert.equal(olje.km, 234000);
  assert.equal(olje.kmIgjen, 3000);
  assert.equal(olje.status, "snart"); // under 5000 km igjen
  assert.equal(finn(frister, "bremsevaeske").status, "forfalt"); // 5 år gikk ut sep. 2026
  assert.equal(finn(frister, "diff-foran").status, "ukjent");
});

test("alleFrister: slitasje og dekk", () => {
  const frister = alleFrister(bil, idag);
  const brems = finn(frister, "bremseklosser");
  assert.equal(brems.kilde, "slitasje");
  assert.equal(brems.dato, null); // bare km-grense
  assert.equal(brems.km, 235000);
  assert.equal(brems.status, "snart");
  const luft = finn(frister, "luftfilter");
  assert.equal(luft.dato, "2027-03-01");
  assert.equal(finn(frister, "dekk").status, "ok");
  assert.equal(finn(frister, "registerreim").status, "ukjent");
});

test("ikke-Discovery: bare EU og slitasje", () => {
  const frister = alleFrister({ ...bil, modell: "GOLF" }, idag);
  assert.equal(frister.some((f) => f.kilde === "service"), false);
  assert.equal(nesteService(frister), null);
});

test("sorterFrister: forfalt først, så snart, så dato", () => {
  const s = sorterFrister([
    { navn: "C", status: "ok", dato: "2027-01-01" },
    { navn: "B", status: "snart", dato: "2027-02-01" },
    { navn: "A", status: "forfalt", dato: "2026-01-01" },
    { navn: "D", status: "snart", dato: "2026-12-01" },
  ]);
  assert.deepEqual(s.map((f) => f.navn), ["A", "D", "B", "C"]);
});

test("aarshjul: 12 måneder fra denne, forfalt øverst, resten fordelt", () => {
  const hjul = aarshjul(alleFrister(bil, idag), idag);
  assert.equal(hjul.maaneder.length, 12);
  assert.equal(hjul.maaneder[0].nokkel, "2026-10");
  assert.equal(hjul.maaneder[11].nokkel, "2027-09");
  assert.deepEqual(hjul.forfalt.map((f) => f.id), ["bremsevaeske"]);
  const nov = hjul.maaneder.find((m) => m.nokkel === "2026-11");
  assert.deepEqual(nov.frister.map((f) => f.id), ["eu"]);
  const mars = hjul.maaneder.find((m) => m.nokkel === "2027-03");
  assert.deepEqual(mars.frister.map((f) => f.id).sort(), ["luftfilter", "motorolje", "oljefilter"]);
  assert.ok(hjul.utenDato.some((f) => f.id === "bremseklosser"));
  assert.ok(hjul.utenDato.some((f) => f.id === "dekk"));
  assert.ok(hjul.ukjent.some((f) => f.id === "registerreim"));
});

test("aarshjul: frister etter 12 måneder havner i «senere»", () => {
  const hjul = aarshjul([{ id: "x", navn: "X", status: "ok", dato: "2028-05-01" }], idag);
  assert.equal(hjul.senere.length, 1);
  assert.ok(hjul.maaneder.every((m) => m.frister.length === 0));
});

test("aarshjul: årsskifte blir riktig", () => {
  const hjul = aarshjul([], new Date(Date.UTC(2026, 11, 31)), 3);
  assert.deepEqual(hjul.maaneder.map((m) => m.nokkel), ["2026-12", "2027-01", "2027-02"]);
});

test("nesteService: mest presserende, og like frister slås sammen", () => {
  const frister = alleFrister(bil, idag);
  const n = nesteService(frister);
  assert.equal(n.id, "bremsevaeske");
  assert.equal(n.status, "forfalt");
  const utenForfalt = frister.filter((f) => f.id !== "bremsevaeske");
  const n2 = nesteService(utenForfalt);
  assert.equal(n2.navn, "Motorolje og oljefilter");
  assert.equal(n2.antall, 2);
});

test("slitasjeOppsummering: verste status med deler", () => {
  const s = slitasjeOppsummering(alleFrister(bil, idag));
  assert.equal(s.status, "snart");
  assert.deepEqual(s.deler.map((d) => d.id), ["bremseklosser"]);
  assert.equal(slitasjeOppsummering([]).status, "ukjent");
});

test("hendelseTittel", () => {
  assert.equal(hendelseTittel(bil.vedlikehold[0]), "Service: motorolje, oljefilter, luftfilter");
  assert.equal(hendelseTittel(bil.vedlikehold[3]), "Annet");
  assert.equal(hendelseTittel({ komponent: "dekk" }), "Dekk");
});

test("sorterHendelser og sumKostnad", () => {
  assert.deepEqual(sorterHendelser(bil.vedlikehold).map((r) => r.id), ["v1", "v2", "v4", "v3"]);
  assert.equal(sumKostnad(bil.vedlikehold), 4200 + 3150.5 + 990);
  assert.equal(sumKostnad([]), 0);
});

test("vedlikeholdOversikt: per år, nyeste først, med delsum", () => {
  const o = vedlikeholdOversikt(bil.vedlikehold);
  assert.equal(o.antall, 4);
  assert.equal(o.totalKostnad, 8340.5);
  assert.equal(o.medKostnad, 3);
  assert.equal(o.siste.id, "v1");
  assert.deepEqual(o.aar.map((a) => a.aar), ["2026", "2025", "2021"]);
  assert.equal(o.aar[1].sum, 4140.5);
  assert.deepEqual(o.aar[1].hendelser.map((h) => h.id), ["v2", "v4"]);
  assert.equal(o.aar[2].sum, 0);
});

test("vedlikeholdOversikt: tom historikk", () => {
  const o = vedlikeholdOversikt([]);
  assert.equal(o.antall, 0);
  assert.equal(o.siste, null);
  assert.deepEqual(o.aar, []);
});

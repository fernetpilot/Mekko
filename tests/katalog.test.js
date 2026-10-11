// Tester for bildelskatalogen. Kjører med: npm test
// Fixturene er beskrivelser fra servicehefte BR67285 (uten «– Type service»-delen).

import { test } from "node:test";
import assert from "node:assert/strict";
import { DELER, OMRADER, finnDeler, delerForOmrade, finnDel } from "../public/js/katalog.js";
import { LR3_2_7_TDV6 } from "../public/js/servicepunkter.js";
import { SLITASJE_PUNKTER } from "../public/js/slitasje.js";

const likt = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

// Beskrivelse fra heftet → deler vi forventer at katalogen finner
const HEFTET = [
  ["Oljefilter, Olje, Dieselfilter og Pollenfilter", ["oljefilter", "motorolje", "dieselfilter", "pollenfilter"]],
  ["Oljefilter, Olje, ny bremseveske", ["oljefilter", "motorolje", "bremsevaeske"]],
  ["Diffolje forran og bak, Transfercaseolje.", ["diff-foran", "diff-bak", "overforing"]],
  ["Bremseklosser og -skriver, Calipere begge bak, v forran", ["bremseklosser", "bremseskiver", "caliper"]],
  ["Bremseklosser og skiver høyre og venstre forran", ["bremseklosser", "bremseskiver"]],
  ["Bremseslanger, alle", ["bremseslanger"]],
  ["Skifta bremserør begge sider bak", ["bremserør"]],
  ["Håndbrems mekanisme, reprasjon", ["handbrems"]],
  ["Hjullager høyre bak", ["hjullager"]],
  ["Skifta Hjullager usikkert hvor (SKF? betyr det noe)", ["hjullager"]],
  ["Stabilisatorstagg høyre og vestre", ["stabilisatorstag"]],
  ["Styreledd indre og ytre høyre ventre", ["styreledd"]],
  ["Bærekule, v og h nedre", ["baerekule"]],
  ["Kuleledd nedre?", ["baerekule"]],
  ["Bærearm øvre Venstre Bak", ["baerearm"]],
  ["Bærearm foring øvre Høyre Bak", ["baerearm"]],
  ["Drivakselledd venstre framme ytre", ["drivakselledd"]],
  ["Drivakselmansjett", ["drivakselmansjett"]],
  ["Skifte av mellomaksel oppheng", ["mellomaksel"]],
  ["Ridex luftdempere x2", ["luftdemper"]],
  ["Kompressor, Lufttank og Ventilblokk", ["kompressor", "lufttank", "ventilblokk"]],
  ["Skifta nivåsensor luftfjær venstre bak", ["nivasensor"]],
  ["Regreim, multireim, Reimstrammer på dynamoreim", ["registerreim"]],
  ["Bytte EGR ventil", ["egr"]],
  ["Byttet turbo", ["turbo"]],
  ["Glødeplugger", ["glodeplugger"]],
  ["Skiftet girkasseolje", ["automatgir"]],
  ["Dieselfilter", ["dieselfilter"]],
  ["Batteri", ["batteri"]],
];

// Beskrivelser uten deler i katalogen (hendelser, og noe vi ikke har lagt inn ennå)
const IKKE_DELER = [
  "Bilsalg",
  "Godkjent som 5-seter",
  "Tectylbehandling",
  "Feilsøking pga svak motorkraft - Rensestoff fikset problemet",
  "Feilsøking - Turbo og girkasse",
];

test("heftets deler finnes i katalogen", () => {
  for (const [tekst, forventet] of HEFTET) {
    likt(finnDeler(tekst), forventet);
  }
});

test("hendelser uten deler gir ingen treff", () => {
  for (const tekst of IKKE_DELER) {
    assert.deepEqual(finnDeler(tekst), [], tekst);
  }
});

test("lengste synonym vinner: oljefilter gir ikke også motorolje", () => {
  likt(finnDeler("Oljefilter"), ["oljefilter"]);
});

test("diffolje uten retning gir både foran og bak", () => {
  likt(finnDeler("Diffolje forran og bak"), ["diff-foran", "diff-bak"]);
});

test("id-ene i katalogen er unike og peker på et gyldig område", () => {
  const ids = DELER.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  const omr = new Set(OMRADER.map((o) => o.id));
  for (const d of DELER) assert.ok(omr.has(d.omrade), `${d.id} har ukjent område ${d.omrade}`);
});

test("hvert område har minst én del", () => {
  for (const o of OMRADER) assert.ok(delerForOmrade(o.id).length > 0, o.id);
});

test("ingen synonym peker på flere deler, unntatt bevisst delte", () => {
  const sett = new Map();
  for (const d of DELER) for (const s of d.synonymer) sett.set(s, [...(sett.get(s) ?? []), d.id]);
  const tillatt = new Set(["diffolje forran og bak"]);
  for (const [s, ids] of sett) {
    if (ids.length > 1) assert.ok(tillatt.has(s), `«${s}» gjelder ${ids.join(", ")}`);
  }
});

test("alle deler som brukes i servicelisten finnes i katalogen med samme intervall", () => {
  for (const p of LR3_2_7_TDV6) {
    const d = finnDel(p.id);
    assert.ok(d, `mangler ${p.id}`);
    assert.equal(d.kmIntervall ?? null, p.kmIntervall, `km for ${p.id}`);
    assert.equal(d.manederIntervall ?? null, p.manederIntervall, `måneder for ${p.id}`);
  }
  for (const p of SLITASJE_PUNKTER) {
    const d = finnDel(p.id);
    assert.ok(d, `mangler ${p.id}`);
    assert.equal(d.kmIntervall ?? null, p.kmIntervall, `km for ${p.id}`);
    assert.equal(d.manederIntervall ?? null, p.manederIntervall, `måneder for ${p.id}`);
  }
});

test("dieselfilter er med i katalogen med 25 000 km og 36 måneder", () => {
  const d = finnDel("dieselfilter");
  assert.equal(d.kmIntervall, 25000);
  assert.equal(d.manederIntervall, 36);
});

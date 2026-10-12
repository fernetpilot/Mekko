// Tester for servicekatalogen. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { KATALOG, allePunkter, punktNavn, finnPunkt, delId } from "../public/js/servicekatalog.js";
import { LR3_2_7_TDV6 } from "../public/js/servicepunkter.js";
import { SLITASJE_PUNKTER } from "../public/js/slitasje.js";
import { stilFor } from "../public/js/punktstil.js";

test("alle id-er er unike og uten @", () => {
  const ider = allePunkter().map((p) => p.id);
  assert.equal(new Set(ider).size, ider.length);
  for (const id of ider) assert.ok(!id.includes("@"), id);
});

test("punkter med intervall finnes i katalogen, så gamle registreringer beholder navnet", () => {
  for (const p of [...LR3_2_7_TDV6, ...SLITASJE_PUNKTER]) assert.ok(finnPunkt(p.id), p.id);
  for (const id of ["ekstra-service", "annet-arbeid"]) assert.ok(finnPunkt(id), id);
});

test("11 kategorier pluss Annet, alle med punkter", () => {
  assert.equal(KATALOG.length, 12);
  for (const k of KATALOG) assert.ok(k.punkter.length && k.navn && k.gruppe, k.id);
});

test("punktNavn med og uten posisjon", () => {
  assert.equal(punktNavn("motorolje"), "Motorolje");
  assert.equal(punktNavn("ovre-kuleledd@fv"), "Øvre kuleledd (foran venstre)");
  assert.equal(punktNavn("foring-nedre-bakre@bh"), "Bakre foring, nedre bærearm (bak høyre)");
  assert.equal(punktNavn("ukjent-del"), "ukjent-del");
  assert.deepEqual(delId("ovre-kuleledd@fv"), { punktId: "ovre-kuleledd", posisjon: "fv" });
});

test("bærearmer registreres per hjul", () => {
  const baerearm = allePunkter().filter((p) => p.underkategori === "Bærearmer");
  assert.equal(baerearm.length, 8);
  for (const p of baerearm) assert.equal(p.perPosisjon, true);
});

test("stil: egen stil, ellers kategoriens, også med posisjon", () => {
  assert.equal(stilFor("motorolje").gruppe, "olje");
  assert.equal(stilFor("batteri").gruppe, "elektrisk");
  assert.equal(stilFor("ovre-kuleledd@fv").gruppe, "styring");
  assert.equal(stilFor("finnes-ikke").gruppe, "annet");
});

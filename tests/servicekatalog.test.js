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

import { passerBil } from "../public/js/servicekatalog.js";
import { bilEgenskaper } from "../public/js/kjoretoy.js";

const svar = ({ drivstoff = "Diesel", aksler = [true, true], gir, merke = "LAND ROVER", modell = "DISCOVERY 3" } = {}) => ({
  kjoretoydataListe: [{
    godkjenning: { tekniskGodkjenning: { tekniskeData: {
      generelt: { merke: [{ merke }], handelsbetegnelse: [modell] },
      motorOgDrivverk: {
        motor: [{ drivstoff: [{ drivstoffKode: { kodeVerdi: drivstoff.slice(0, 1), kodeNavn: drivstoff } }] }],
        ...(gir ? { girkassetype: { kodeNavn: gir } } : {}),
      },
      akslinger: { akselGruppe: [{ akselListe: { aksel: aksler.map((d) => ({ drivAksel: d })) } }] },
    } } },
  }],
});

test("bilEgenskaper leser drivstoff, drift, girkasse og luftfjæring", () => {
  assert.deepEqual(bilEgenskaper(svar()), { drivstoff: "diesel", drift: "4x4", girkasse: null, luftfjaering: true });
  assert.deepEqual(
    bilEgenskaper(svar({ drivstoff: "Bensin", aksler: [true, false], gir: "Manuell", merke: "VOLKSWAGEN", modell: "GOLF" })),
    { drivstoff: "bensin", drift: "foran", girkasse: "manuell", luftfjaering: null });
  assert.equal(bilEgenskaper(svar({ drivstoff: "Elektrisitet", aksler: [false, true] })).drivstoff, "elektrisk");
  assert.equal(bilEgenskaper(svar({ aksler: [false, true] })).drift, "bak");
  assert.equal(bilEgenskaper(svar({ aksler: [{}, {}].map(() => undefined) })).drift, null);
  assert.deepEqual(bilEgenskaper({}), { drivstoff: null, drift: null, girkasse: null, luftfjaering: null });
});

test("passerBil: Discovery 3 (diesel, 4x4, luftfjæring)", () => {
  const e = bilEgenskaper(svar());
  const ok = (id) => passerBil(finnPunkt(id), e);
  assert.ok(ok("motorolje") && ok("gloeplugger") && ok("overforing") && ok("luftkompressor") && ok("automatgir"));
  assert.ok(!ok("tennplugger") && !ok("coil") && !ok("drivstoffilter-bensin"));
});

test("passerBil: forhjulsdrevet bensin med manuelt gir", () => {
  const e = { drivstoff: "bensin", drift: "foran", girkasse: "manuell", luftfjaering: null };
  const ok = (id) => passerBil(finnPunkt(id), e);
  assert.ok(ok("tennplugger") && ok("clutch") && ok("manuelt-gir") && ok("bremseklosser"));
  assert.ok(!ok("gloeplugger") && !ok("automatgir") && !ok("overforing") && !ok("diff-bak") && !ok("luftkompressor"));
});

test("passerBil: elbil skjuler motorolje og eksos", () => {
  const e = { drivstoff: "elektrisk", drift: "bak", girkasse: null, luftfjaering: null };
  const ok = (id) => passerBil(finnPunkt(id), e);
  assert.ok(!ok("motorolje") && !ok("eksos") && !ok("registerreim"));
  assert.ok(ok("bremseklosser") && ok("diff-bak") && ok("pollenfilter"));
});

test("passerBil uten egenskaper viser alt", () => {
  for (const p of allePunkter()) assert.ok(passerBil(p, null), p.id);
});

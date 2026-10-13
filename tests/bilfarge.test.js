// Tester for lakkfargen på 3D-bilen. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { lakkFor, registrertFarge } from "../public/js/bilfarge.js";

const svar = (rFarge) => ({
  kjoretoydataListe: [{ godkjenning: { tekniskGodkjenning: { tekniskeData: { karosseriOgLasteplan: { rFarge } } } } }],
});

test("henter fargenavnet fra API-svaret", () => {
  assert.equal(registrertFarge(svar([{ kodeNavn: "Grønn" }])), "Grønn");
  assert.equal(registrertFarge(svar([])), null);
  assert.equal(registrertFarge({}), null);
});

test("hver grunnfarge får en tone", () => {
  for (const navn of ["Hvit", "Svart", "Grå", "Sølv", "Blå", "Rød", "Grønn", "Gul", "Brun", "Beige", "Oransje", "Lilla", "Gull", "Turkis", "Rosa"]) {
    assert.equal(typeof lakkFor(navn), "number", navn);
  }
});

test("sammensatte navn og store bokstaver", () => {
  assert.equal(lakkFor("SØLV"), lakkFor("Sølv"));
  assert.equal(lakkFor("Grå metallic"), lakkFor("Grå"));
  assert.equal(lakkFor("Sølv/grå"), lakkFor("Sølv"));
  assert.notEqual(lakkFor("Gull"), lakkFor("Gul"));
  assert.notEqual(lakkFor("Turkis"), lakkFor("Blå"));
});

test("ukjent eller tom farge gir null", () => {
  assert.equal(lakkFor("Flerfarget"), null);
  assert.equal(lakkFor(null), null);
  assert.equal(lakkFor(""), null);
});

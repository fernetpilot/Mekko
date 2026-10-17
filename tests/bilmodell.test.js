// Tester for valg av 3D-modell. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { velgBilmodell } from "../public/js/bilmodell.js";

test("Discovery 3 og 4 kjennes igjen på modellnavnet", () => {
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "DISCOVERY 3" }), "discovery3");
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "DISCOVERY 4" }), "discovery4");
  assert.equal(velgBilmodell({ merke: "Land Rover", modell: "Discovery 4 3.0 SDV6" }), "discovery4");
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "LR3" }), "discovery3");
});

test("bare «DISCOVERY» avgjøres av førstegangsregistreringen", () => {
  const d = (forstegangsregistrert) => velgBilmodell({ merke: "LAND ROVER", modell: "DISCOVERY", forstegangsregistrert });
  assert.equal(d("2008-03-14"), "discovery3");
  assert.equal(d("2009-08-31"), "discovery3");
  assert.equal(d("2009-09-01"), "discovery4");
  assert.equal(d("2015-06-01"), "discovery4");
  assert.equal(d("2018-01-01"), null);   // Discovery 5
  assert.equal(d("2001-01-01"), null);   // Discovery 1/2
  assert.equal(d(null), null);
});

test("andre biler får standardmodellen", () => {
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "DISCOVERY SPORT" }), null);
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "DISCOVERY 5" }), null);
  assert.equal(velgBilmodell({ merke: "LAND ROVER", modell: "RANGE ROVER" }), null);
  assert.equal(velgBilmodell({ merke: "TESLA", modell: "MODEL Y" }), null);
  assert.equal(velgBilmodell({}), null);
  assert.equal(velgBilmodell(null), null);
});

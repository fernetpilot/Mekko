// Tester for førerkortgrensene for tilhenger.
// Kilde: førerkortforskriften kap. 3, §§ 3-5 (klasse B) og 3-11 (klasse BE).
// Testene dekker bare førerkortreglene. beregnMaksLast er ikke implementert ennå.

import { test } from "node:test";
import assert from "node:assert/strict";
import { forerkortMaksTilhenger, FORERKORT } from "../src/beregning.js";

test("klasse BE: tilhenger opp til 3 500 kg, uavhengig av bilens vekt", () => {
  assert.equal(forerkortMaksTilhenger("BE", 2500), 3500);
  assert.equal(forerkortMaksTilhenger("BE", 3400), 3500);
});

test("klasse B: samlet grense 3 500 kg for vogntoget", () => {
  // Bil 2 000 kg gir maks tilhenger 1 500 kg (samlet 3 500 kg).
  assert.equal(forerkortMaksTilhenger("B", 2000), 1500);
});

test("klasse B: bil nær grensen gir likevel tilhenger på 750 kg", () => {
  // Bil 3 000 kg: samlet grense gir 500 kg, men 750 kg er alltid tillatt med klasse B.
  assert.equal(forerkortMaksTilhenger("B", 3000), 750);
});

test("klasse B96: samlet grense 4 250 kg for vogntoget", () => {
  assert.equal(forerkortMaksTilhenger("B96", 2000), 2250);
  assert.equal(forerkortMaksTilhenger("B96", 3000), 1250);
});

test("klasse B96 gir større tilhenger enn klasse B for samme bil", () => {
  const bil = 2000;
  assert.ok(
    forerkortMaksTilhenger("B96", bil) > forerkortMaksTilhenger("B", bil),
    "B96 skal gi større tilhenger enn B"
  );
});

test("ukjent førerkort kaster feil", () => {
  assert.throws(() => forerkortMaksTilhenger("C", 2000), /Ukjent førerkort/);
});

test("FORERKORT-objektene har navn og grenser", () => {
  assert.equal(FORERKORT.B.samletGrense, 3500);
  assert.equal(FORERKORT.B96.samletGrense, 4250);
  assert.equal(FORERKORT.BE.samletGrense, null);
});

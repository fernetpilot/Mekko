// Tester for maks last på hengeren. Bilen regnes tom med fører (80 kg).
// Testdata fra docs/eksempeldata/vekter-eksempler.md.

import { test } from "node:test";
import assert from "node:assert/strict";
import { beregnMaksLast } from "../src/beregning.js";

const DISCOVERY = {
  tillattTotalvekt: 3230,
  tillattTilhengervektMedBrems: 3500,
  tillattTilhengervektUtenBrems: 750,
};

const TEMARED_NZ7887 = { tillattTotalvekt: 3500, egenvekt: 832 };

test("Discovery + NZ7887 med klasse BE: maks last 2 668 kg", () => {
  // Grenser: BE 3 500, bil 3 500, henger 3 500. Alle likt, og førerkort vinner ved likhet.
  const res = beregnMaksLast(DISCOVERY, TEMARED_NZ7887, "BE");
  assert.equal(res.maksLast, 2668);
  assert.equal(res.begrensning, "forerkort");
});

test("Discovery + NZ7887 med klasse B: henger for tung, maks last null", () => {
  // Klasse B gir 750 kg for denne bilen. Hengeren veier 832 kg tom.
  const res = beregnMaksLast(DISCOVERY, TEMARED_NZ7887, "B");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BU46006 (Mercedes-AMG SL 43) med tilhenger DV1249.
const MERCEDES_SL43_BU46006 = {
  tillattTotalvekt: 2185,
  tillattTilhengervektMedBrems: 0,
  tillattTilhengervektUtenBrems: 0,
};
const TILHENGER_DV1249 = { tillattTotalvekt: 2000, egenvekt: 345 };

for (const forerkort of ["B", "B96", "BE"]) {
  test(`Mercedes SL 43 kan ikke trekke tilhenger DV1249 med klasse ${forerkort}`, () => {
    const res = beregnMaksLast(MERCEDES_SL43_BU46006, TILHENGER_DV1249, forerkort);
    assert.equal(res.maksLast, null);
    assert.equal(res.begrensning, "bil");
    assert.ok(res.forklaring.some((linje) => linje.includes("ikke godkjent")));
  });
}

test("bilen begrenser når hengerens grense er høyere", () => {
  const bil = { ...DISCOVERY, tillattTilhengervektMedBrems: 2000 };
  const henger = { tillattTotalvekt: 3500, egenvekt: 800 };
  const res = beregnMaksLast(bil, henger, "BE");
  assert.equal(res.maksLast, 1200);
  assert.equal(res.begrensning, "bil");
});

test("hengeren begrenser når den har lavest tillatt totalvekt", () => {
  const bil = { ...DISCOVERY, tillattTilhengervektMedBrems: 3500 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 800 };
  const res = beregnMaksLast(bil, henger, "BE");
  assert.equal(res.maksLast, 1200);
  assert.equal(res.begrensning, "henger");
});

test("hengere på 750 kg eller lettere følger bilens grense uten brems", () => {
  // Hengeren er 700 kg totalt, og bilen tillater bare 500 kg uten brems.
  const bil = { ...DISCOVERY, tillattTilhengervektUtenBrems: 500 };
  const henger = { tillattTotalvekt: 700, egenvekt: 300 };
  const res = beregnMaksLast(bil, henger, "BE");
  assert.equal(res.maksLast, 200);
  assert.equal(res.begrensning, "bil");
});

test("B96 gir større maks last enn B for samme kombinasjon", () => {
  const bil = { ...DISCOVERY, tillattTotalvekt: 2000 };
  const henger = { tillattTotalvekt: 3500, egenvekt: 800 };
  const b = beregnMaksLast(bil, henger, "B");
  const b96 = beregnMaksLast(bil, henger, "B96");
  assert.ok(b96.maksLast > b.maksLast);
});

test("forklaringen nevner begrensende grense", () => {
  const res = beregnMaksLast(DISCOVERY, TEMARED_NZ7887, "BE");
  assert.ok(res.forklaring.some((linje) => linje.includes("forerkort")));
});

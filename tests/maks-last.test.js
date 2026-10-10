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

test("B96 tillater tilhenger som B avviser, når samlet vekt er mellom 3 500 og 4 250 kg", () => {
  const bil = { ...DISCOVERY, tillattTotalvekt: 2000 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  assert.equal(beregnMaksLast(bil, henger, "B").maksLast, null);
  const b96 = beregnMaksLast(bil, henger, "B96");
  assert.equal(b96.maksLast, 1655);
  assert.equal(b96.begrensning, "henger");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 3200 kg med tilhenger 2000 kg, klasse B.
test("klasse B: samlet vekt over 3 500 kg gir null, selv med lav last", () => {
  const bil = { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "B");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: SE15280 (AMG G 63) med DV1249, klasse BE.
// Med brems 1 655 kg, uten brems 405 kg.
test("BE: tilhenger 2000 kg med brems gir 1 655 kg", () => {
  const bil = { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "BE");
  assert.equal(res.maksLast, 1655);
  assert.equal(res.begrensning, "henger");
});

test("BE: tilhenger 2000 kg uten brems gir 405 kg", () => {
  const bil = { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "BE", { medBrems: false });
  assert.equal(res.maksLast, 405);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 3200 kg med tilhenger 2000 kg, klasse B96.
test("klasse B96: samlet vekt over 4 250 kg gir null", () => {
  const bil = { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "B96");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
  assert.ok(res.forklaring[0].includes("4250"));
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BT98997 (GLA 180) med DV1249, klasse B96.
// Med brems 855 kg, uten brems 370 kg.
test("B96: GLA 180 med DV1249 gir 855 kg med brems", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "B96");
  assert.equal(res.maksLast, 855);
  assert.equal(res.begrensning, "bil");
});

test("B96: GLA 180 med DV1249 gir 370 kg uten brems", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  const res = beregnMaksLast(bil, henger, "B96", { medBrems: false });
  assert.equal(res.maksLast, 370);
  assert.equal(res.begrensning, "bil");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BT98997 (GLA 180) med DV1249, klasse BE.
test("BE: GLA 180 med DV1249 gir 855 kg med brems og 370 kg uten", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 2000, egenvekt: 345 };
  assert.equal(beregnMaksLast(bil, henger, "BE").maksLast, 855);
  assert.equal(beregnMaksLast(bil, henger, "BE", { medBrems: false }).maksLast, 370);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BT98997 (GLA 180) med AT1962, klasse BE.
test("BE: GLA 180 med AT1962 gir 940 kg med brems og 455 kg uten", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  assert.equal(beregnMaksLast(bil, henger, "BE").maksLast, 940);
  assert.equal(beregnMaksLast(bil, henger, "BE", { medBrems: false }).maksLast, 455);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BT98997 (GLA 180) med AT1962, klasse B96.
test("B96: GLA 180 med AT1962 gir 940 kg med brems og 455 kg uten", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  assert.equal(beregnMaksLast(bil, henger, "B96").maksLast, 940);
  assert.equal(beregnMaksLast(bil, henger, "B96", { medBrems: false }).maksLast, 455);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: BT98997 (GLA 180) med AT1962, klasse B.
test("B: GLA 180 med AT1962 gir 940 kg med brems og 455 kg uten", () => {
  const bil = { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  assert.equal(beregnMaksLast(bil, henger, "B").maksLast, 940);
  assert.equal(beregnMaksLast(bil, henger, "B", { medBrems: false }).maksLast, 455);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 2970 kg med tilhenger 1400 kg, klasse B.
test("klasse B: bil 2970 kg med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 2970, tillattTilhengervektMedBrems: 2100, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 2970 kg med tilhenger 1400 kg, klasse B96.
test("klasse B96: bil 2970 kg med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 2970, tillattTilhengervektMedBrems: 2100, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B96");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: YF22803 (E 300de) med AT1962, klasse BE.
test("BE: E 300de med AT1962 gir 1140 kg med brems og 490 kg uten", () => {
  const bil = { tillattTotalvekt: 2970, tillattTilhengervektMedBrems: 2100, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const med = beregnMaksLast(bil, henger, "BE");
  assert.equal(med.maksLast, 1140);
  assert.equal(med.begrensning, "henger");
  assert.equal(beregnMaksLast(bil, henger, "BE", { medBrems: false }).maksLast, 490);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: ER98153 (ID. Buzz GTX) med AT1962, klasse BE.
test("BE: ID. Buzz GTX med AT1962 gir 1140 kg med brems og 490 kg uten", () => {
  const bil = { tillattTotalvekt: 3400, tillattTilhengervektMedBrems: 1600, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  assert.equal(beregnMaksLast(bil, henger, "BE").maksLast, 1140);
  assert.equal(beregnMaksLast(bil, henger, "BE", { medBrems: false }).maksLast, 490);
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: ID. Buzz GTX med tilhenger 1400 kg, klasse B96.
test("klasse B96: ID. Buzz GTX med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 3400, tillattTilhengervektMedBrems: 1600, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B96");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: ID. Buzz GTX med tilhenger 1400 kg, klasse B.
test("klasse B: ID. Buzz GTX med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 3400, tillattTilhengervektMedBrems: 1600, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 3500 kg med tilhenger 1400 kg, klasse B.
test("klasse B: bil 3500 kg med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 3500, tillattTilhengervektMedBrems: 3000, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: bil 3500 kg med tilhenger 1400 kg, klasse B96.
test("klasse B96: bil 3500 kg med tilhenger 1400 kg gir null", () => {
  const bil = { tillattTotalvekt: 3500, tillattTilhengervektMedBrems: 3000, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  const res = beregnMaksLast(bil, henger, "B96");
  assert.equal(res.maksLast, null);
  assert.equal(res.begrensning, "forerkort");
});

// Verifisert mot Vegvesen-kalkulatoren 10.10.2026: KB54652 (Crafter) med AT1962, klasse BE.
test("BE: Crafter med AT1962 gir 1140 kg med brems og 490 kg uten", () => {
  const bil = { tillattTotalvekt: 3500, tillattTilhengervektMedBrems: 3000, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 1400, egenvekt: 260 };
  assert.equal(beregnMaksLast(bil, henger, "BE").maksLast, 1140);
  assert.equal(beregnMaksLast(bil, henger, "BE", { medBrems: false }).maksLast, 490);
});

test("klasse B: tilhenger på 750 kg eller lettere gir maks last uten samlet grense", () => {
  const bil = { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 };
  const henger = { tillattTotalvekt: 700, egenvekt: 300 };
  const res = beregnMaksLast(bil, henger, "B");
  assert.equal(res.maksLast, 400);
});

test("forklaringen nevner begrensende grense", () => {
  const res = beregnMaksLast(DISCOVERY, TEMARED_NZ7887, "BE");
  assert.ok(res.forklaring.some((linje) => linje.includes("forerkort")));
});

// Kombinasjoner verifisert mot Statens vegvesens kalkulator 10.10.2026.
// Hvert tilfelle har fasiten fra Vegvesen. Kjører med: npm test
//
// Regelen i testene: når Vegvesen sier «ingen last», skal beregningen gi
// lovlig: false eller maksLast: 0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { beregnMaksLast } from "../public/js/beregning.js";

const BIL = {
  DV1249: null, // tilhenger, ikke bil
  BU46006: { tillattTotalvekt: 2185, tillattTilhengervektMedBrems: 0, tillattTilhengervektUtenBrems: 0 }, // Mercedes-AMG SL 43
  SE15280: { tillattTotalvekt: 3200, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 }, // AMG G 63
  BT98997: { tillattTotalvekt: 1940, tillattTilhengervektMedBrems: 1200, tillattTilhengervektUtenBrems: 715 }, // GLA 180
  YF22803: { tillattTotalvekt: 2970, tillattTilhengervektMedBrems: 2100, tillattTilhengervektUtenBrems: 750 }, // E 300de
  ER98153: { tillattTotalvekt: 3400, tillattTilhengervektMedBrems: 1600, tillattTilhengervektUtenBrems: 750 }, // ID. Buzz GTX
  KB54652: { tillattTotalvekt: 3500, tillattTilhengervektMedBrems: 3000, tillattTilhengervektUtenBrems: 750 }, // Crafter
  BIL_3500_OK: { tillattTotalvekt: 3230, tillattTilhengervektMedBrems: 3500, tillattTilhengervektUtenBrems: 750 }, // Discovery 3
};

const HENGER = {
  DV1249: { tillattTotalvekt: 2000, egenvekt: 345 },
  NZ7887: { tillattTotalvekt: 3500, egenvekt: 832 },
  AT1962: { tillattTotalvekt: 1400, egenvekt: 260 },
  PW7393: { tillattTotalvekt: 1300, egenvekt: 580 }, // Norgeshengern F1336
};

// [bil, henger, førerkort, med brems, forventet maks last (null = ingen last)]
const TILFELLER = [
  ["BU46006", "DV1249", "B", true, null],
  ["BU46006", "DV1249", "BE", true, null],
  ["SE15280", "DV1249", "BE", true, 1655],
  ["SE15280", "DV1249", "BE", false, 405],
  ["SE15280", "DV1249", "B", true, null],
  ["SE15280", "DV1249", "B96", true, null],
  ["BT98997", "DV1249", "B96", true, 855],
  ["BT98997", "DV1249", "BE", true, 855],
  ["BT98997", "DV1249", "BE", false, 370],
  ["BT98997", "DV1249", "B", true, null],
  ["BT98997", "AT1962", "B", true, 940],
  ["BT98997", "AT1962", "B", false, 455],
  ["BT98997", "AT1962", "B96", true, 940],
  ["BT98997", "AT1962", "BE", true, 940],
  ["BT98997", "AT1962", "BE", false, 455],
  ["YF22803", "AT1962", "BE", true, 1140],
  ["YF22803", "AT1962", "BE", false, 490],
  ["ER98153", "AT1962", "BE", true, 1140],
  ["ER98153", "AT1962", "BE", false, 490],
  ["ER98153", "AT1962", "B", true, null],
  ["ER98153", "AT1962", "B96", true, null],
  ["KB54652", "AT1962", "BE", true, 1140],
  ["KB54652", "AT1962", "BE", false, 490],
  ["KB54652", "PW7393", "BE", true, 720],
  ["KB54652", "PW7393", "BE", false, 170],
  ["KB54652", "PW7393", "B", true, null],
  ["KB54652", "PW7393", "B96", true, null],
  ["BIL_3500_OK", "NZ7887", "BE", true, 2668],
  ["BIL_3500_OK", "NZ7887", "B", true, null],
];

for (const [bilNavn, hengerNavn, forerkort, medBrems, forventet] of TILFELLER) {
  const beskrivelse = `${bilNavn} + ${hengerNavn}, ${forerkort}, ${medBrems ? "med" : "uten"} brems: ${forventet === null ? "ingen last" : `${forventet} kg`}`;
  test(beskrivelse, () => {
    const res = beregnMaksLast({
      bil: BIL[bilNavn],
      henger: { ...HENGER[hengerNavn], harBrems: medBrems },
      forerkort,
    });
    if (forventet === null) {
      assert.ok(!res.lovlig || res.maksLast === 0, `forventet ingen last, fikk ${res.maksLast}`);
    } else {
      assert.equal(res.lovlig, true);
      assert.equal(res.maksLast, forventet);
    }
  });
}

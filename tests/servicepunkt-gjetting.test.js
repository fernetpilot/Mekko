// Tester for gjetting av servicepunkter. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { gjettServicepunkter, alleServicepunkter } from "../public/js/servicepunkt-gjetting.js";

const likt = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test("bremseklosser fra fritekst, som i importen fra 2021", () => {
  likt(gjettServicepunkter("bremser", "Bremseklosser og -skriver, Calipere begge bak, v forran"), ["bremseklosser"]);
});

test("oljeskift og oljefilter", () => {
  likt(gjettServicepunkter("motor", "Oljeskift og filter"), ["motorolje"]);
  likt(gjettServicepunkter("service", "Oljefilter og olje"), ["oljefilter", "motorolje"]);
});

test("flere deler på samme besøk", () => {
  likt(gjettServicepunkter("service", "Bytt klosser, luftfilter og olje"), ["bremseklosser", "luftfilter", "motorolje"]);
});

test("luftfilter og registerreim", () => {
  likt(gjettServicepunkter("service", "Luftfilter bytt"), ["luftfilter"]);
  likt(gjettServicepunkter("service", "Registerreim og spennrulle"), ["registerreim"]);
});

test("væsker og gir skilles fra oljeskift", () => {
  likt(gjettServicepunkter("bremser", "Bremsevæske"), ["bremsevaeske"]);
  likt(gjettServicepunkter("service", "Kjølevæske byttet"), ["kjolevaeske"]);
  likt(gjettServicepunkter("service", "Girolje automatgir"), ["automatgir"]);
});

test("motorkategori uten nærmere tekst gir motorolje", () => {
  likt(gjettServicepunkter("motor", ""), ["motorolje"]);
});

test("ukjent gir tom liste", () => {
  likt(gjettServicepunkter("dekk", "Vinterdekk"), []);
  likt(gjettServicepunkter("service", "Årlig ettersyn"), []);
  likt(gjettServicepunkter("bremser", "Bremsene sjekket"), []);
});

test("alle servicepunkter har id og navn", () => {
  const liste = alleServicepunkter();
  assert.ok(liste.length > 10);
  for (const p of liste) assert.ok(p.id && p.navn);
});

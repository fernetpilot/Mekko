// Tester for gjetting av servicepunkt. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { gjettServicepunkt, alleServicepunkter } from "../public/js/servicepunkt-gjetting.js";

test("bremseklosser fra fritekst, som i importen fra 2021", () => {
  assert.equal(gjettServicepunkt("bremser", "Bremseklosser og -skriver, Calipere begge bak, v forran"), "bremseklosser");
});

test("oljeskift og oljefilter", () => {
  assert.equal(gjettServicepunkt("motor", "Oljeskift og filter"), "motorolje");
  assert.equal(gjettServicepunkt("service", "Oljefilter og olje"), "oljefilter");
});

test("luftfilter og registerreim", () => {
  assert.equal(gjettServicepunkt("service", "Luftfilter bytt"), "luftfilter");
  assert.equal(gjettServicepunkt("service", "Registerreim og spennrulle"), "registerreim");
});

test("væsker skilles fra oljeskift", () => {
  assert.equal(gjettServicepunkt("bremser", "Bremsevæske"), "bremsevaeske");
  assert.equal(gjettServicepunkt("service", "Kjølevæske byttet"), "kjolevaeske");
  assert.equal(gjettServicepunkt("service", "Girolje automatgir"), "automatgir");
});

test("motorkategori uten nærmere tekst gir motorolje", () => {
  assert.equal(gjettServicepunkt("motor", ""), "motorolje");
});

test("ukjent gir null", () => {
  assert.equal(gjettServicepunkt("dekk", "Vinterdekk"), null);
  assert.equal(gjettServicepunkt("service", "Årlig ettersyn"), null);
  assert.equal(gjettServicepunkt("bremser", "Bremsene sjekket"), null);
});

test("alle servicepunkter har id og navn", () => {
  const liste = alleServicepunkter();
  assert.ok(liste.length > 10);
  for (const p of liste) assert.ok(p.id && p.navn);
});

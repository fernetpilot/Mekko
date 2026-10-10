import { test } from "node:test";
import assert from "node:assert/strict";
import { lagVarsler, euVarsler } from "../public/js/varsler.js";

const idag = new Date(2026, 9, 10); // 10. oktober 2026
const bil = (skilt, frist) => ({ kjennemerke: skilt, merke: "LAND ROVER", modell: "DISCOVERY 3", eu_kontrollfrist: frist });

test("ingen varsel når EU-fristen er langt unna eller mangler", () => {
  assert.deepEqual(euVarsler(bil("AA11111", "2028-06-03"), idag), []);
  assert.deepEqual(euVarsler(bil("AA11111", null), idag), []);
});

test("varsel når EU-fristen nærmer seg", () => {
  const [v] = euVarsler(bil("AA11111", "2026-11-20"), idag);
  assert.equal(v.niva, "sjekk");
  assert.equal(v.id, "eu:AA11111");
  assert.match(v.tekst, /LAND ROVER DISCOVERY 3 \(AA11111\)/);
});

test("kritiske varsler kommer først", () => {
  const varsler = lagVarsler([bil("AA11111", "2026-11-20"), bil("BB22222", "2026-09-01")], idag);
  assert.deepEqual(varsler.map((v) => v.niva), ["kritisk", "sjekk"]);
});

test("tom liste uten biler", () => {
  assert.deepEqual(lagVarsler([], idag), []);
  assert.deepEqual(lagVarsler(null, idag), []);
});

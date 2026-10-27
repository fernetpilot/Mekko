// Tester for finn.no-søket etter deler. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { finnLenke, modellOrd, sokeord } from "../public/js/finn-sok.js";
import { allePunkter } from "../public/js/servicekatalog.js";

const disco = { merke: "LAND ROVER", modell: "DISCOVERY 3" };

test("Land Rover får merkefilteret til finn.no og modellen i fritekst", () => {
  const url = new URL(finnLenke(disco, "bremseklosser"));
  assert.equal(url.origin + url.pathname, "https://www.finn.no/recommerce/forsale/search");
  assert.equal(url.searchParams.get("brand"), "781");
  assert.equal(url.searchParams.get("sub_category"), "1.90.82");
  assert.equal(url.searchParams.get("q"), "discovery 3 bremseklosser");
});

test("ukjent merke søkes på med navnet", () => {
  const url = new URL(finnLenke({ merke: "VOLVO", modell: "V70" }, "bremseskiver"));
  assert.equal(url.searchParams.get("brand"), null);
  assert.equal(url.searchParams.get("q"), "volvo v70 bremseskiver");
});

test("posisjon og egne søkeord", () => {
  assert.equal(new URL(finnLenke(disco, "ovre-kuleledd@fv")).searchParams.get("q"), "discovery 3 kuleledd");
  assert.equal(sokeord("hjullager"), "hjullager");
  assert.equal(sokeord("registerreim"), "registerreim");
});

test("væsker og arbeid gir ingen lenke", () => {
  for (const id of ["motorolje", "bremsevaeske", "dekkskift", "hjulstilling", "annet-arbeid", "eu", "dekk"]) {
    assert.equal(finnLenke(disco, id), null, id);
  }
});

test("modellnavnet kortes ned, generasjonen beholdes", () => {
  assert.equal(modellOrd("DISCOVERY 3 TDV6 HSE"), "discovery 3");
  assert.equal(modellOrd("DISCOVERY"), "discovery");
  assert.equal(modellOrd("V70 2.4"), "v70");
  assert.equal(modellOrd(null), "");
});

test("uten merke og modell søkes det bare på delen", () => {
  assert.equal(new URL(finnLenke({}, "turbo")).searchParams.get("q"), "turbo");
});

test("alle deler i katalogen gir et søkeord uten parenteser eller skråstrek", () => {
  for (const p of allePunkter()) {
    const ord = sokeord(p.id);
    if (ord) assert.match(ord, /^[a-zæøåé0-9 -]+$/, p.id);
  }
});

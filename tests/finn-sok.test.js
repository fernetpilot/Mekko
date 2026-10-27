// Tester for finn.no-søket etter deler. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { finnAlleDeler, finnLenke, finnLignendeBiler, finnVariant, modellOrd, sokeord } from "../public/js/finn-sok.js";
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

test("alle deler til bilen: bare modellen i søket", () => {
  const url = new URL(finnAlleDeler(disco));
  assert.equal(url.searchParams.get("brand"), "781");
  assert.equal(url.searchParams.get("q"), "discovery 3");
});

test("lignende biler: Discovery 3 får eget filter og km ± 25 000", () => {
  const { href, km, ar } = finnLignendeBiler({ ...disco, kilometerstand: 250000, forstegangsregistrert: "2008-05-01" });
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://www.finn.no/mobility/search/car");
  assert.equal(url.searchParams.get("variant"), "2.781.2680.2002262");
  assert.equal(url.searchParams.get("mileage_from"), "225000");
  assert.equal(url.searchParams.get("mileage_to"), "275000");
  assert.equal(url.searchParams.get("q"), null);
  assert.equal(url.searchParams.get("year_from"), null);
  assert.deepEqual(km, { fra: 225000, til: 275000 });
  assert.equal(ar, null);
});

test("lignende biler: Discovery 4 og Discovery Sport", () => {
  assert.equal(finnVariant({ merke: "LAND ROVER", modell: "DISCOVERY 4 SDV6" }), "2.781.2680.2002263");
  assert.equal(finnVariant({ merke: "Land Rover", modell: "Discovery Sport" }), "2.781.2680.2000319");
});

test("lignende biler: ukjent generasjon gir merke, modell og årsmodell ± 2", () => {
  const url = new URL(finnLignendeBiler({ merke: "LAND ROVER", modell: "DEFENDER 110", forstegangsregistrert: "2015-03-01", kilometerstand: 10000 }).href);
  assert.equal(url.searchParams.get("variant"), "0.781");
  assert.equal(url.searchParams.get("q"), "defender");
  assert.equal(url.searchParams.get("year_from"), "2013");
  assert.equal(url.searchParams.get("year_to"), "2017");
  assert.equal(url.searchParams.get("mileage_from"), "0");
  const volvo = new URL(finnLignendeBiler({ merke: "VOLVO", modell: "V70" }).href);
  assert.equal(volvo.searchParams.get("q"), "volvo v70");
  assert.equal(volvo.searchParams.get("mileage_from"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { kategorierFor, hendelseTittel, kostnadPerKategori, delerFor, ALLE_KATEGORIER } from "../public/js/kategorier.js";
import { KATALOG } from "../public/js/servicekatalog.js";

const ids = (h) => kategorierFor(h).map((k) => k.id);

test("alle katalogkategorier pluss EU-kontroll og service uten deler", () => {
  assert.deepEqual(ALLE_KATEGORIER.map((k) => k.id), [...KATALOG.map((k) => k.id), "eu_kontroll", "service"]);
});

test("kategorier og deler fra lagrede servicepunkter, i katalogens rekkefølge", () => {
  const h = { komponent: "service", servicepunkter: ["bremseklosser", "motorolje", "oljefilter", "ovre-kuleledd@fv"] };
  const k = kategorierFor(h);
  assert.deepEqual(k.map((x) => x.id), ["oljer", "bremser", "styring"]);
  assert.deepEqual(k[0].delNavn, ["Motorolje", "Oljefilter"]);
  assert.deepEqual(k[2].delNavn, ["Øvre kuleledd (foran venstre)"]);
  assert.equal(delerFor(h).gjettet, false);
});

test("uten lagrede deler: gjettes fra notat, ellers følger kategorien typen", () => {
  assert.deepEqual(ids({ komponent: "bremser", notat: "Nye klosser foran" }), ["bremser"]);
  assert.equal(delerFor({ komponent: "bremser", notat: "Nye klosser foran" }).gjettet, true);
  assert.deepEqual(ids({ komponent: "bremser" }), ["bremser"]);
  assert.deepEqual(ids({ komponent: "motor" }), ["oljer"]);
  assert.deepEqual(ids({ komponent: "dekk" }), ["dekk"]);
  assert.deepEqual(ids({ komponent: "service" }), ["service"]);
  assert.deepEqual(ids({ komponent: "annet" }), ["annet"]);
  assert.deepEqual(ids({ komponent: "eu_kontroll", notat: "byttet olje" }), ["eu_kontroll"]);
});

test("EU-kontroll med reparasjoner får begge", () => {
  assert.deepEqual(ids({ komponent: "eu_kontroll", servicepunkter: ["lyspaerer"] }), ["elektrisk", "eu_kontroll"]);
});

test("ukjente deler havner i Annet", () => {
  assert.deepEqual(ids({ komponent: "service", servicepunkter: ["finnes-ikke"] }), ["annet"]);
});

test("tittel er lik overalt", () => {
  assert.equal(hendelseTittel({ komponent: "service", servicepunkter: ["motorolje", "bremsevaeske"] }), "Service: Oljer, væsker og filtre");
  assert.equal(hendelseTittel({ komponent: "bremser", servicepunkter: ["bremseklosser", "ytre-styreledd"] }), "Bremser · Hjuloppheng og styring");
  assert.equal(hendelseTittel({ komponent: "service" }), "Service");
  assert.equal(hendelseTittel({ komponent: "eu_kontroll" }), "EU-kontroll");
  assert.equal(hendelseTittel({ komponent: "dekk" }), "Dekk og hjul");
  assert.equal(hendelseTittel({ komponent: "service", servicepunkter: ["motorolje", "ekstra-service"] }), "Service: Oljer, væsker og filtre");
  assert.equal(hendelseTittel({ komponent: "annet", servicepunkter: ["ekstra-service"] }), "Annet");
});

test("kostnad fordeles likt på alle kategoriene, også Annet (samme som i historikken)", () => {
  assert.deepEqual(kostnadPerKategori({ komponent: "service", kostnad: 3000, servicepunkter: ["motorolje", "bremseklosser", "ekstra-service"] }),
    [{ id: "oljer", belop: 1000 }, { id: "bremser", belop: 1000 }, { id: "annet", belop: 1000 }]);
  assert.deepEqual(kostnadPerKategori({ komponent: "annet", kostnad: "990" }), [{ id: "annet", belop: 990 }]);
  assert.deepEqual(kostnadPerKategori({ komponent: "service", kostnad: null }), []);
  const sum = kostnadPerKategori({ komponent: "eu_kontroll", kostnad: 1000, servicepunkter: ["lyspaerer", "bremseskiver"] })
    .reduce((n, x) => n + x.belop, 0);
  assert.ok(Math.abs(sum - 1000) < 1e-9);
});

test("bare «Ekstra service» lagret: deler i notatet styrer kategorien", () => {
  const h = { komponent: "annet", kostnad: 4000, servicepunkter: ["ekstra-service"], notat: "Hjullager høyre bak · Type service: Ekstra Service" };
  assert.deepEqual(delerFor(h), { deler: ["hjullager"], gjettet: true });
  assert.deepEqual(kostnadPerKategori(h), [{ id: "styring", belop: 4000 }]);
  // Uten konkrete deler i notatet blir det «Annet» som før
  assert.deepEqual(delerFor({ ...h, notat: "Feilsøking" }), { deler: ["ekstra-service"], gjettet: false });
  // Valgte deler fra en annen kategori overstyres ikke
  assert.deepEqual(delerFor({ ...h, servicepunkter: ["bremseklosser"] }).deler, ["bremseklosser"]);
});

// Tester for dekk: piggdekkperioden, når dekkene bør byttes og vurdering av dekksett. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paaskedag, piggdekkPeriode, dekkskift, vurderSett, dekkPaBilen, settNavn, typeFraValg, valgFraType,
} from "../public/js/dekk.js";
import { slitasjeLinjer } from "../public/js/slitasje.js";
import { dekkVarsler } from "../public/js/varsler.js";
import { alleFrister } from "../public/js/dashboard.js";

test("påskedag: kjente år", () => {
  assert.equal(paaskedag(2024), "2024-03-31");
  assert.equal(paaskedag(2025), "2025-04-20");
  assert.equal(paaskedag(2026), "2026-04-05");
  assert.equal(paaskedag(2027), "2027-03-28");
});

test("piggdekkperiode: sør til og med første søndag etter 2. påskedag", () => {
  assert.deepEqual(piggdekkPeriode(2026, "sor"), { fra: "2026-11-01", til: "2027-04-04" });
  assert.deepEqual(piggdekkPeriode(2024), { fra: "2024-11-01", til: "2025-04-27" });
});

test("piggdekkperiode: nord 16. oktober til 1. mai", () => {
  assert.deepEqual(piggdekkPeriode(2026, "nord"), { fra: "2026-10-16", til: "2027-05-01" });
});

test("dekkskift: ukjent uten dekk på bilen", () => {
  assert.equal(dekkskift({ type: null, idag: "2026-10-12" }).status, "ukjent");
});

test("dekkskift: sommerdekk i august er ok, med neste bytte 1. november", () => {
  const s = dekkskift({ type: "sommer", idag: "2026-08-15" });
  assert.equal(s.status, "ok");
  assert.equal(s.dato, "2026-11-01");
  assert.equal(s.bytteTil, "vinter");
});

test("dekkskift: sommerdekk i oktober gir snart, i november forfalt", () => {
  assert.equal(dekkskift({ type: "sommer", idag: "2026-10-12" }).status, "snart");
  assert.equal(dekkskift({ type: "sommer", idag: "2026-11-01" }).status, "forfalt");
  assert.equal(dekkskift({ type: "sommer", idag: "2027-02-01" }).status, "forfalt");
});

test("dekkskift: nord varsler tidligere", () => {
  assert.equal(dekkskift({ type: "sommer", idag: "2026-09-20", region: "nord" }).status, "snart");
  assert.equal(dekkskift({ type: "sommer", idag: "2026-10-16", region: "nord" }).status, "forfalt");
  assert.equal(dekkskift({ type: "sommer", idag: "2026-09-20", region: "sor" }).status, "ok");
});

test("dekkskift: sommerdekk på våren peker på neste høst", () => {
  const s = dekkskift({ type: "sommer", idag: "2027-05-10" });
  assert.equal(s.status, "ok");
  assert.equal(s.dato, "2027-11-01");
});

test("dekkskift: vinterdekk midt på vinteren er ok, med bytte etter påske", () => {
  const s = dekkskift({ type: "vinter", pigg: true, idag: "2027-01-15" });
  assert.equal(s.status, "ok");
  assert.equal(s.dato, "2027-04-04");
  assert.equal(s.bytteTil, "sommer");
});

test("dekkskift: vinterdekk rett før piggdekksesongen slutter gir snart", () => {
  assert.equal(dekkskift({ type: "vinter", pigg: true, idag: "2027-03-20" }).status, "snart");
});

test("dekkskift: piggdekk etter sesongen er forfalt, piggfrie gir snart", () => {
  assert.equal(dekkskift({ type: "vinter", pigg: true, idag: "2027-04-05" }).status, "forfalt");
  assert.equal(dekkskift({ type: "vinter", pigg: false, idag: "2027-04-05" }).status, "snart");
  assert.equal(dekkskift({ type: "vinter", pigg: true, idag: "2027-07-01" }).status, "forfalt");
});

test("dekkskift: vinterdekk satt på tidlig i oktober er ok", () => {
  assert.equal(dekkskift({ type: "vinter", pigg: true, idag: "2026-10-12" }).status, "ok");
  // men ikke i september (sør)
  assert.equal(dekkskift({ type: "vinter", pigg: true, idag: "2026-09-15" }).status, "forfalt");
});

test("vurderSett: alder fra produksjonsår og mønsterdybde", () => {
  assert.equal(vurderSett({ type: "sommer" }, "2026-10-12").status, "ukjent");
  assert.equal(vurderSett({ type: "sommer", monsterdybde_mm: 6, produksjonsaar: 2023 }, "2026-10-12").status, "ok");
  assert.equal(vurderSett({ type: "sommer", monsterdybde_mm: 6, produksjonsaar: 2021 }, "2026-10-12").status, "sjekk");
  assert.equal(vurderSett({ type: "vinter", monsterdybde_mm: "3.5" }, "2026-10-12").status, "sjekk");
  assert.equal(vurderSett({ type: "vinter", monsterdybde_mm: 2.9 }, "2026-10-12").status, "forfalt");
  assert.equal(vurderSett({ type: "sommer", monsterdybde_mm: 1.5 }, "2026-10-12").status, "forfalt");
});

test("dekksett: hjelpefunksjoner", () => {
  const sett = [{ id: "a", type: "sommer" }, { id: "b", type: "vinter", pigg: true, pa_bilen: true, dimensjon: "205/55R16" }];
  assert.equal(dekkPaBilen(sett).id, "b");
  assert.equal(dekkPaBilen([]), null);
  assert.equal(settNavn(sett[1]), "Vinterdekk med pigg 205/55R16");
  assert.deepEqual(typeFraValg("vinter-pigg"), { type: "vinter", pigg: true });
  assert.equal(valgFraType({ type: "vinter", pigg: false }), "vinter");
});

const idag = new Date(Date.UTC(2026, 9, 12)); // 12. oktober 2026
const linje = (linjer, id) => linjer.find((l) => l.id === id);

test("slitasje: dekk og dekkskift fra dekksettet på bilen", () => {
  const bil = { dekksett: [
    { id: "s", type: "sommer", pa_bilen: true, monsterdybde_mm: 2.5 },
    { id: "v", type: "vinter", pigg: true },
  ] };
  const linjer = slitasjeLinjer({ bil, idag });
  assert.equal(linje(linjer, "dekk").status, "sjekk");
  const skift = linje(linjer, "dekkskift");
  assert.equal(skift.status, "snart");
  assert.equal(skift.dato, "2026-11-01");
  assert.equal(skift.navn, "Dekkskift: vinterdekk");
});

test("slitasje: uten dekksett brukes de gamle feltene på bilen", () => {
  const linjer = slitasjeLinjer({ bil: { dekk_type: "vinter", dekk_mm: 6 }, idag });
  assert.equal(linje(linjer, "dekk").status, "ok");
  assert.equal(linje(linjer, "dekkskift").status, "ok");
});

test("slitasje: dekksett, men ingen på bilen", () => {
  const linjer = slitasjeLinjer({ bil: { dekksett: [{ id: "v", type: "vinter" }] }, idag });
  assert.equal(linje(linjer, "dekk").status, "ukjent");
  assert.equal(linje(linjer, "dekkskift").status, "ukjent");
});

test("varsler: dekkskift varsles når det nærmer seg", () => {
  const bil = { id: "1", kjennemerke: "AB12345", merke: "VW", modell: "Golf",
    dekksett: [{ type: "sommer", pa_bilen: true }] };
  const [v] = dekkVarsler(bil, new Date(2026, 9, 12));
  assert.equal(v.niva, "sjekk");
  assert.equal(v.tittel, "Snart tid for vinterdekk");
  assert.equal(v.lenke, "/dekk?bil=1");
  assert.equal(dekkVarsler(bil, new Date(2026, 10, 5))[0].niva, "kritisk");
  assert.deepEqual(dekkVarsler(bil, new Date(2026, 7, 1)), []);
  assert.deepEqual(dekkVarsler({ ...bil, dekksett: [] }, new Date(2026, 9, 12)), []);
});

test("årshjul: dekkskift får dato", () => {
  const bil = { dekksett: [{ type: "sommer", pa_bilen: true }], vedlikehold: [] };
  const f = alleFrister(bil, idag).find((x) => x.id === "dekkskift");
  assert.equal(f.dato, "2026-11-01");
  assert.equal(f.status, "snart");
});

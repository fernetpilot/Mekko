// Tester for kortene på forsiden. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { forsideKort, sidenTekst } from "../public/js/forside.js";

const idag = new Date(Date.UTC(2026, 9, 10)); // 10. oktober 2026

const discovery = {
  id: "b1",
  modell: "DISCOVERY 3",
  kilometerstand: 229000,
  eu_kontrollfrist: "2027-05-01",
  dekk_type: "vinter",
  dekk_montert: "2023-10-15",
  dekk_mm: 6,
  vedlikehold: [
    { servicepunkter: ["motorolje", "oljefilter"], dato: "2026-04-01", kilometerstand: 226000 },
    { servicepunkter: ["bremseklosser"], dato: "2024-05-10", kilometerstand: 198000 },
  ],
  utsettelser: [],
};

test("sidenTekst", () => {
  assert.equal(sidenTekst("2026-04-01", idag), "for 6 mnd siden");
  assert.equal(sidenTekst("2026-10-02", idag), "denne måneden");
  assert.equal(sidenTekst("2023-01-01", idag), "for 3 år siden");
});

test("motor: oljeskift med serviceplan gir status og neste frist", () => {
  const { motor } = forsideKort(discovery, idag);
  assert.equal(motor.status, "ok");
  assert.match(motor.tekst, /Sist skiftet for 6 mnd siden/);
  assert.match(motor.tekst, /Neste april 2027, 7 000 km igjen/);
  assert.equal(motor.fane, "service");
});

test("bremser: over intervallet gir rød status", () => {
  const { bremser } = forsideKort(discovery, idag);
  assert.equal(bremser.status, "kritisk");
  assert.equal(bremser.statusTekst, "Bør sjekkes");
  assert.match(bremser.tekst, /1 000 km over intervallet/);
});

test("dekk: vinterdekk med god dybde i oktober handler om dekkskiftet", () => {
  const { dekk } = forsideKort(discovery, idag);
  assert.equal(dekk.fane, "dekk");
  assert.ok(["ok", "sjekk", "kritisk"].includes(dekk.status));
});

test("bil uten historikk gir grå kort som ber om registrering", () => {
  const k = forsideKort({ id: "b2", modell: "GOLF", vedlikehold: [], utsettelser: [] }, idag);
  assert.equal(k.motor.status, "tom");
  assert.equal(k.motor.statusTekst, "Ikke registrert");
  assert.equal(k.bremser.status, "tom");
  assert.equal(k.dekk.status, "tom");
});

test("oljeskift uten serviceplan viser når det ble gjort", () => {
  const k = forsideKort({ id: "b3", modell: "GOLF", vedlikehold: [{ servicepunkter: ["motorolje"], dato: "2025-10-01" }] }, idag);
  assert.equal(k.motor.statusTekst, "Registrert");
  assert.equal(k.motor.tekst, "Sist skiftet for 12 mnd siden.");
});

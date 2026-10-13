import { test } from "node:test";
import assert from "node:assert/strict";
import { bilLenke, dagerTil, euStatus, formaterDato, formaterKm } from "../public/js/bilstatus.js";

const idag = new Date(2026, 9, 10); // 10. oktober 2026

test("dagerTil teller hele dager", () => {
  assert.equal(dagerTil("2026-10-10", idag), 0);
  assert.equal(dagerTil("2026-10-11", idag), 1);
  assert.equal(dagerTil("2026-10-01", idag), -9);
});

test("euStatus: ok, nær frist, passert og ukjent", () => {
  assert.equal(euStatus("2028-06-03", idag).status, "ok");
  assert.equal(euStatus("2026-11-20", idag).status, "sjekk");
  assert.equal(euStatus("2026-10-10", idag).tekst, "Frist i dag");
  assert.equal(euStatus("2026-09-01", idag).status, "kritisk");
  assert.equal(euStatus(null, idag).status, "ukjent");
});

test("formatering på norsk", () => {
  assert.equal(formaterDato("2028-06-03"), "3. juni 2028");
  assert.equal(formaterKm(214300), "214 300 km");
  assert.equal(formaterKm(null), "–");
});

test("bilLenke peker på «Bilen din» med bil og fane", () => {
  assert.equal(bilLenke({ id: "b1" }, "dekk"), "/?bil=b1&fane=dekk#bilen-din");
  assert.equal(bilLenke({ id: "b1" }), "/?bil=b1#bilen-din");
  assert.equal(bilLenke(null, "service"), "/?fane=service#bilen-din");
  assert.equal(bilLenke(null), "/#bilen-din");
});

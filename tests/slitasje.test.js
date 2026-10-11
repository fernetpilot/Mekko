// Tester for slitasjedeler og utsettelser. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { slitasjeLinjer, beregnDekk, utsettelseAktiv, utsettelseFor } from "../public/js/slitasje.js";

const idag = new Date(Date.UTC(2026, 9, 10)); // 10. oktober 2026
const bil = { kilometerstand: 130000 };
const linje = (linjer, id) => linjer.find((l) => l.id === id);
const bremseRad = (km) => ({ servicepunkter: ["bremseklosser"], dato: "2025-01-01", kilometerstand: km });
const luftRad = (km, dato = "2025-01-01") => ({ servicepunkter: ["luftfilter"], dato, kilometerstand: km });

test("bremseklosser: ok når det er langt igjen", () => {
  const l = linje(slitasjeLinjer({ bil, rader: [bremseRad(105000)], kmNaa: 110000, idag }), "bremseklosser");
  assert.equal(l.status, "ok");
  assert.equal(l.kmIgjen, 25000);
});

test("bremseklosser: snart og forfalt etter km", () => {
  const snart = linje(slitasjeLinjer({ bil, rader: [bremseRad(105000)], kmNaa: 133000, idag }), "bremseklosser");
  assert.equal(snart.status, "snart");
  const forfalt = linje(slitasjeLinjer({ bil, rader: [bremseRad(105000)], kmNaa: 136000, idag }), "bremseklosser");
  assert.equal(forfalt.status, "forfalt");
  assert.equal(forfalt.kanUtsette, true);
});

test("bremseklosser: utsettelse på 10 000 km gir utsatt, og den går ut når km er nådd", () => {
  const rader = [bremseRad(105000)];
  const u = utsettelseFor("bremseklosser", { kmNaa: 136000, idag: "2026-10-10" });
  assert.equal(u.til_km, 146000);
  const utsatt = linje(slitasjeLinjer({ bil, rader, utsettelser: [u], kmNaa: 140000, idag }), "bremseklosser");
  assert.equal(utsatt.status, "utsatt");
  const etter = linje(slitasjeLinjer({ bil, rader, utsettelser: [u], kmNaa: 146000, idag }), "bremseklosser");
  assert.equal(etter.status, "forfalt");
});

test("luftfilter: utsettelse til neste oljeskift", () => {
  const u = { punkt: "luftfilter", ved_oljeskift: true, fra_dato: "2026-10-01" };
  const uten = { ...u };
  assert.equal(utsettelseAktiv(uten, { kmNaa: 130000, idag: "2026-10-10", oljeskiftEtter: "2026-09-15" }), true);
  assert.equal(utsettelseAktiv(uten, { kmNaa: 130000, idag: "2026-10-10", oljeskiftEtter: "2026-10-05" }), false);
});

test("luftfilter: tidsfrist etter ett år gir forfalt selv om km er god", () => {
  const l = linje(slitasjeLinjer({ bil, rader: [luftRad(129000, "2025-01-01")], kmNaa: 130000, idag }), "luftfilter");
  assert.equal(l.status, "forfalt");
});

test("ukjent når det ikke er registrert", () => {
  const l = linje(slitasjeLinjer({ bil, rader: [], kmNaa: 130000, idag }), "bremseklosser");
  assert.equal(l.status, "ukjent");
});

test("dekk: ukjent uten dato og mønsterdybde", () => {
  assert.equal(beregnDekk({ sesong: "sommer", idag: "2026-10-10" }).status, "ukjent");
});

test("dekk: alder fra 5 år gir sjekk", () => {
  const d = beregnDekk({ sesong: "sommer", montert: "2020-06-01", mm: 5, idag: "2026-10-10" });
  assert.equal(d.status, "sjekk");
});

test("dekk: mønster under lovlig minimum gir forfalt", () => {
  assert.equal(beregnDekk({ sesong: "sommer", mm: 1.2, idag: "2026-10-10" }).status, "forfalt");
  assert.equal(beregnDekk({ sesong: "vinter", mm: 2.9, idag: "2026-10-10" }).status, "forfalt");
});

test("dekk: under NAF sitt råd gir sjekk, over gir ok", () => {
  assert.equal(beregnDekk({ sesong: "sommer", mm: 2.5, idag: "2026-10-10" }).status, "sjekk");
  assert.equal(beregnDekk({ sesong: "vinter", mm: 3.5, idag: "2026-10-10" }).status, "sjekk");
  assert.equal(beregnDekk({ sesong: "sommer", mm: 6, idag: "2026-10-10" }).status, "ok");
});

test("dekk: sommer og vinter vurderes hver for seg", () => {
  const bil = { dekk_sommer_mm: 6, dekk_sommer_montert: "2025-05-01", dekk_vinter_mm: 3.5, dekk_vinter_montert: "2025-05-01" };
  const linjer = slitasjeLinjer({ bil, rader: [], kmNaa: 130000, idag });
  assert.equal(linje(linjer, "dekk-sommer").status, "ok");
  assert.equal(linje(linjer, "dekk-vinter").status, "sjekk");
});

test("dekk: gammel vinterdekk gir sjekk selv om sommerdekk er nye", () => {
  const bil = { dekk_sommer_mm: 7, dekk_sommer_montert: "2025-05-01", dekk_vinter_mm: 6, dekk_vinter_montert: "2019-11-01" };
  const linjer = slitasjeLinjer({ bil, rader: [], kmNaa: 130000, idag });
  assert.equal(linje(linjer, "dekk-sommer").status, "ok");
  assert.equal(linje(linjer, "dekk-vinter").status, "sjekk");
});

test("dekk: utsettelse til neste sesong gir utsatt, bare for den sesongen", () => {
  const u = utsettelseFor("dekk-sommer", { kmNaa: null, idag: "2026-10-10" });
  assert.equal(u.til_dato, "2027-04-10");
  const bil = { dekk_sommer_mm: 1.2, dekk_vinter_mm: 1.2 };
  const linjer = slitasjeLinjer({ bil, rader: [], utsettelser: [u], kmNaa: 130000, idag });
  assert.equal(linje(linjer, "dekk-sommer").status, "utsatt");
  assert.equal(linje(linjer, "dekk-vinter").status, "forfalt");
});

test("registerreim: byttes etter 120 000 km og utsettes ikke", () => {
  const rader = [{ servicepunkter: ["registerreim"], dato: "2025-01-01", kilometerstand: 100000 }];
  const l = linje(slitasjeLinjer({ bil, rader, kmNaa: 125000, idag }), "registerreim");
  assert.equal(l.kmIgjen, 95000);
  assert.equal(l.status, "ok");
  const snart = linje(slitasjeLinjer({ bil, rader, kmNaa: 215000, idag }), "registerreim");
  assert.equal(snart.status, "snart");
  assert.equal(snart.kanUtsette, false);
  const forfalt = linje(slitasjeLinjer({ bil, rader, kmNaa: 221000, idag }), "registerreim");
  assert.equal(forfalt.status, "forfalt");
  assert.equal(forfalt.kanUtsette, false);
  assert.equal(utsettelseFor("registerreim", { kmNaa: 215000, idag: "2026-10-10" }), null);
});

test("registerreim: forfalt etter 6 år selv om km er god", () => {
  const rader = [{ servicepunkter: ["registerreim"], dato: "2019-01-01", kilometerstand: 100000 }];
  const l = linje(slitasjeLinjer({ bil, rader, kmNaa: 110000, idag }), "registerreim");
  assert.equal(l.status, "forfalt");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { gjettFelt, finnKobling, tolkDato, tolkTall, gjettKomponent, raderTilForslag, erDublett } from "../public/js/import-historikk.js";

const idag = new Date(2026, 9, 10);

test("kolonneoverskrifter kjennes igjen", () => {
  assert.equal(gjettFelt("Dato"), "dato");
  assert.equal(gjettFelt("Km-stand"), "kilometerstand");
  assert.equal(gjettFelt("Kilometerstand ved service"), "kilometerstand");
  assert.equal(gjettFelt("Beløp"), "kostnad");
  assert.equal(gjettFelt("Pris inkl. mva"), "kostnad");
  assert.equal(gjettFelt("Verksted"), "utfort_av");
  assert.equal(gjettFelt("Beskrivelse"), "notat");
  assert.equal(gjettFelt("Hva er gjort"), "komponent");
  assert.equal(gjettFelt("Farge"), null);
  assert.equal(gjettFelt("\ufeffDato"), "dato"); // CSV fra Excel starter ofte med BOM
});

test("overskriftsraden finnes selv med tittel over", () => {
  const rader = [["Servicehistorikk Land Rover"], [], ["Dato", "Km", "Arbeid", "Pris", "Verksted"], ["12.03.2023", "142 000", "Oljeskift", "2 490", "Bilxtra"]];
  const { overskriftRad, kobling } = finnKobling(rader);
  assert.equal(overskriftRad, 2);
  assert.deepEqual(kobling, ["dato", "kilometerstand", "notat", "kostnad", "utfort_av"]);
});

test("norske datoformater", () => {
  assert.equal(tolkDato("12.03.2023", idag), "2023-03-12");
  assert.equal(tolkDato("1.2.21", idag), "2021-02-01");
  assert.equal(tolkDato("05/11/2019", idag), "2019-11-05");
  assert.equal(tolkDato("2022-08-30", idag), "2022-08-30");
  assert.equal(tolkDato(44997, idag), "2023-03-12"); // Excel-serienummer
  assert.equal(tolkDato(new Date(2020, 5, 1), idag), "2020-06-01");
  assert.equal(tolkDato("31.02.2023", idag), null);
  assert.equal(tolkDato("ukjent", idag), null);
  assert.equal(tolkDato("1.1.99", idag), "1999-01-01");
});

test("tall med mellomrom, kr, km og norsk desimalkomma", () => {
  assert.equal(tolkTall("142 000 km"), 142000);
  assert.equal(tolkTall("4 850,50 kr"), 4850.5);
  assert.equal(tolkTall("kr 2.490,-"), 2490);
  assert.equal(tolkTall("4.850"), 4850);
  assert.equal(tolkTall("4850.5"), 4850.5);
  assert.equal(tolkTall("12,5"), 12.5);
  assert.equal(tolkTall(1234), 1234);
  assert.equal(tolkTall("ca. 1000"), null);
  assert.equal(tolkTall(""), null);
});

test("type gjettes fra tekst", () => {
  assert.equal(gjettKomponent("Oljeskift og filter"), "motor");
  assert.equal(gjettKomponent("Nye bremseklosser foran"), "bremser");
  assert.equal(gjettKomponent("Dekkskift vinter"), "dekk");
  assert.equal(gjettKomponent("EU-kontroll"), "eu_kontroll");
  assert.equal(gjettKomponent("PKK godkjent"), "eu_kontroll");
  assert.equal(gjettKomponent("Stor service inkl. olje"), "service");
  assert.equal(gjettKomponent("Bytte vindusviskere"), "annet");
  assert.equal(gjettKomponent(""), "service");
});

test("rader blir forslag, tomme rader hoppes over, mil gjøres om til km", () => {
  const rader = [
    ["Dato", "Mil", "Beskrivelse", "Beløp", "Verksted"],
    ["12.03.2023", "14 200", "Oljeskift", "2 490,-", "Bilxtra"],
    [],
    ["01.06.2024", "", "Bytte vindusviskere", "", ""],
  ];
  const forslag = raderTilForslag(rader, finnKobling(rader));
  assert.equal(forslag.length, 2);
  assert.deepEqual(forslag[0], { dato: "2023-03-12", komponent: "motor", kilometerstand: 142000, kostnad: 2490, utfort_av: "Bilxtra", notat: "Oljeskift" });
  assert.equal(forslag[1].komponent, "annet");
  assert.equal(forslag[1].kilometerstand, null);
});

test("typekolonne brukes før beskrivelsen", () => {
  const rader = [["Dato", "Type", "Notat"], ["2023-03-12", "Bremser", "Skiftet klosser og skiver"], ["2023-04-01", "Lakk", "Riper bak"]];
  const [a, b] = raderTilForslag(rader, finnKobling(rader));
  assert.equal(a.komponent, "bremser");
  assert.equal(a.notat, "Skiftet klosser og skiver");
  assert.equal(b.komponent, "annet");
  assert.equal(b.notat, "Lakk – Riper bak");
});

test("dubletter: samme dato og samme type eller km", () => {
  const finnes = [{ dato: "2023-03-12", komponent: "motor", kilometerstand: 142000 }];
  assert.equal(erDublett({ dato: "2023-03-12", komponent: "motor", kilometerstand: null }, finnes), true);
  assert.equal(erDublett({ dato: "2023-03-12", komponent: "dekk", kilometerstand: 142000 }, finnes), true);
  assert.equal(erDublett({ dato: "2023-03-12", komponent: "dekk", kilometerstand: 150000 }, finnes), false);
  assert.equal(erDublett({ dato: null, komponent: "motor" }, finnes), false);
});

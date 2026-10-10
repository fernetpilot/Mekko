import { test } from "node:test";
import assert from "node:assert/strict";
import { gjettFelt, gjettFeltFraInnhold, finnKobling, tolkDato, tolkTall, gjettKomponent, raderTilForslag, erDublett } from "../public/js/import-historikk.js";

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
  assert.equal(tolkTall("ca. 1000"), 1000);
  assert.equal(tolkTall("ukjent"), null);
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

test("delvise treff på overskrifter", () => {
  assert.equal(gjettFelt("Arbeidsnotater"), "notat");
  assert.equal(gjettFelt("Utført arbeid"), "notat");
  assert.equal(gjettFelt("Totalbeløp"), "kostnad");
  assert.equal(gjettFelt("Kostnader"), "kostnad");
  assert.equal(gjettFelt("Sum inkl. mva"), "kostnad");
  assert.equal(gjettFelt("Fakturadato"), "dato");
  assert.equal(gjettFelt("Km ved service"), "kilometerstand");
  assert.equal(gjettFelt("Miljøavgift"), "kostnad"); // ikke «mil»
  assert.equal(gjettFelt("Verkstednavn"), "utfort_av");
});

test("tall med tekst rundt", () => {
  assert.equal(tolkTall("kr. 2490"), 2490);
  assert.equal(tolkTall("1 234,50 kr inkl. mva"), 1234.5);
  assert.equal(tolkTall("NOK 4 850,00"), 4850);
  assert.equal(tolkTall("4850 kr"), 4850);
  assert.equal(tolkTall("4\u00a0850,-"), 4850);
  assert.equal(tolkTall("1,234,567"), 1234567);
  assert.equal(tolkTall("12.03.2023"), null);
});

test("kolonner uten kjent overskrift gjenkjennes på innholdet", () => {
  assert.equal(gjettFeltFraInnhold(["12.03.2023", "01.11.2023", ""]), "dato");
  assert.equal(gjettFeltFraInnhold(["kr 2 490", "4 850,-"]), "kostnad");
  assert.equal(gjettFeltFraInnhold(["Skiftet olje og filter", "Nye bremseklosser foran"]), "notat");
  assert.equal(gjettFeltFraInnhold(["12", "15"]), null);
});

test("ukjente kolonner havner i notatet, ingenting går tapt", () => {
  const rader = [
    ["Når", "Hva", "Arbeidsnotater", "Totalbeløp", "Bonuspoeng"],
    ["12.03.2023", "Oljeskift", "Byttet olje og filter", "kr 2 490,-", "250"],
  ];
  const oppsett = finnKobling(rader);
  assert.deepEqual(oppsett.kobling, ["dato", "komponent", "notat", "kostnad", null]);
  const [f] = raderTilForslag(rader, oppsett);
  assert.equal(f.komponent, "motor");
  assert.equal(f.kostnad, 2490);
  assert.equal(f.notat, "Byttet olje og filter – Bonuspoeng: 250");
});

import { tolkKvitteringstekst } from "../public/js/import-historikk.js";

test("kvitteringstekst: dato, km, beløp og verksted", () => {
  const tekst = `Bilxtra Verksted Oslo AS
Org.nr 912 345 678 MVA
Faktura 10234
Fakturadato: 20.08.2023
Forfallsdato: 03.09.2023
Utført: 14.08.2023
Reg.nr: BR 67285   Km-stand: 152 340
Skift av bremseklosser foran       2 100,00
Arbeid 1,5 t                       1 350,00
Sum eks. mva                       2 760,00
Mva 25 %                             690,00
Å betale                       kr  3 450,00`;
  const r = tolkKvitteringstekst(tekst, new Date(2026, 9, 10));
  assert.equal(r.dato, "2023-08-14");
  assert.equal(r.kilometerstand, 152340);
  assert.equal(r.kostnad, 3450);
  assert.equal(r.utfort_av, "Bilxtra Verksted Oslo AS");
  assert.equal(r.komponent, "bremser");
});

test("kvitteringstekst: uten etiketter brukes første dato og km etter tallet", () => {
  const r = tolkKvitteringstekst("EU-kontroll godkjent\n28.05.2026\nKjørt 209 000 km\nTotalt kr 1 150,-", new Date(2026, 9, 10));
  assert.equal(r.dato, "2026-05-28");
  assert.equal(r.kilometerstand, 209000);
  assert.equal(r.kostnad, 1150);
  assert.equal(r.komponent, "eu_kontroll");
});

test("kvitteringstekst: tom tekst gir bare type", () => {
  assert.deepEqual(tolkKvitteringstekst(""), { komponent: "service" });
});

test("datoer med månedsnavn", () => {
  const idag = new Date(2026, 9, 10);
  assert.equal(tolkDato("14. august 2023", idag), "2023-08-14");
  assert.equal(tolkDato("3 des. 2024", idag), "2024-12-03");
  assert.equal(tolkDato("1.mai.25", idag), "2025-05-01");
  assert.equal(tolkDato("14. smurf 2023", idag), null);
  const r = tolkKvitteringstekst("Mekonomen Bilsenter AS\nDato: 14. august 2023\nKm: 152 340\nTotalt: 3 450,00", idag);
  assert.equal(r.dato, "2023-08-14");
  assert.equal(r.kostnad, 3450);
});

import { tolkHendelsesliste } from "../public/js/import-historikk.js";

test("PDF med mange hendelser deles opp (servicehefte fra Mekkoo)", () => {
  const tekst = `SERVICEHEFTE
AB12345 – TESTMERKE MODELL
Første gang registrert: 28. mars 2008
Utskrevet: 10. okt. 2026 fra Mekkoo
10. okt. 2026 · Bremser
280 000 km · 670 kr · Utført av: Ola Nordmann
Byttet klosser foran,
og skiver bak
5. okt. 2026 · Service
281 345 km · Utført av: Byttet selv
Stor service – Type service: Ekstra Service
Vedlegg 1: kvittering.pdf
AB12345 · Side 1 av 3
23. des. 2025 · Oljeskift / motor
270 500 km · Utført av: Testverksted AS
Olje og filter
8. nov. 2025 · Annet
269 000 km
Bilsalg
Vedlegg 1 – 10. okt. 2026 – Bremser – kvittering.pdf
12.03.2020 Dette er en kvittering inne i et vedlegg`;
  const h = tolkHendelsesliste(tekst, new Date(2026, 9, 10));
  assert.equal(h.length, 4);
  assert.deepEqual(h[0], { dato: "2026-10-10", komponent: "bremser", kilometerstand: 280000, kostnad: 670, utfort_av: "Ola Nordmann", notat: "Byttet klosser foran, og skiver bak" });
  assert.equal(h[1].komponent, "service");
  assert.equal(h[1].notat, "Stor service – Type service: Ekstra Service");
  assert.equal(h[2].komponent, "motor");
  assert.equal(h[2].utfort_av, "Testverksted AS");
  assert.equal(h[3].komponent, "annet");
  assert.equal(h[3].kilometerstand, 269000);
  assert.equal(h[3].notat, "Bilsalg");
});

test("liste fra verksted med andre datoformater", () => {
  const tekst = `Servicehistorikk
12.03.2023 - Service
Km: 142 000
Totalt kr 4 850
01.11.2023 - Dekkskift
Vinterdekk på`;
  const h = tolkHendelsesliste(tekst, new Date(2026, 9, 10));
  assert.equal(h.length, 2);
  assert.equal(h[0].dato, "2023-03-12");
  assert.equal(h[0].kilometerstand, 142000);
  assert.equal(h[1].komponent, "dekk");
});

test("én kvittering gir ingen liste", () => {
  assert.deepEqual(tolkHendelsesliste("Verksted AS\nFakturadato: 20.08.2023\nÅ betale kr 3 450,00"), []);
});

// Tester for gjetting av servicepunkter. Kjører med: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { gjettServicepunkter, alleServicepunkter, utvidDeler } from "../public/js/servicepunkt-gjetting.js";

const likt = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test("bremseklosser fra fritekst, som i importen fra 2021", () => {
  likt(gjettServicepunkter("bremser", "Bremseklosser og -skriver, Calipere begge bak, v forran"), ["bremseklosser", "bremseskiver", "bremsecaliper"]);
});

test("oljeskift og oljefilter følger hverandre", () => {
  likt(gjettServicepunkter("motor", "Oljeskift og filter"), ["motorolje", "oljefilter"]);
  likt(gjettServicepunkter("service", "Oljefilter og olje"), ["oljefilter", "motorolje"]);
  likt(gjettServicepunkter("service", "Oljefilter"), ["oljefilter", "motorolje"]);
});

test("utvidDeler legger til det andre av motorolje og oljefilter", () => {
  likt(utvidDeler(["motorolje"]), ["motorolje", "oljefilter"]);
  likt(utvidDeler(["oljefilter"]), ["motorolje", "oljefilter"]);
  likt(utvidDeler(["luftfilter"]), ["luftfilter"]);
  likt(utvidDeler([]), []);
});

test("flere deler på samme besøk", () => {
  likt(gjettServicepunkter("service", "Bytt klosser, luftfilter og olje"), ["bremseklosser", "luftfilter", "motorolje", "oljefilter"]);
});

test("luftfilter og registerreim", () => {
  likt(gjettServicepunkter("service", "Luftfilter bytt"), ["luftfilter"]);
  likt(gjettServicepunkter("service", "Registerreim og spennrulle"), ["registerreim"]);
});

test("væsker og gir skilles fra oljeskift", () => {
  likt(gjettServicepunkter("bremser", "Bremsevæske"), ["bremsevaeske"]);
  likt(gjettServicepunkter("service", "Kjølevæske byttet"), ["kjolevaeske"]);
  likt(gjettServicepunkter("service", "Girolje automatgir"), ["automatgir"]);
});

test("motorkategori uten nærmere tekst gir motorolje og oljefilter", () => {
  likt(gjettServicepunkter("motor", ""), ["motorolje", "oljefilter"]);
});

test("ukjent gir tom liste", () => {
  likt(gjettServicepunkter("dekk", "Vinterdekk"), []);
  likt(gjettServicepunkter("service", "Årlig ettersyn"), []);
  likt(gjettServicepunkter("bremser", "Bremsene sjekket"), []);
});

test("alle servicepunkter har id og navn", () => {
  const liste = alleServicepunkter();
  assert.ok(liste.length > 10);
  for (const p of liste) assert.ok(p.id && p.navn);
});

test("ekstra service og annet kan velges, men gir ingen intervall", () => {
  const id = alleServicepunkter().map((p) => p.id);
  assert.ok(id.includes("ekstra-service"));
  assert.ok(id.includes("annet-arbeid"));
});

test("ekstra service alene gir ekstra service, men ikke når faste deler finnes", () => {
  likt(gjettServicepunkter("bremser", "Type service: Ekstra Service, bremseklosser"), ["bremseklosser"]);
  likt(gjettServicepunkter("service", "Ekstra Service"), ["ekstra-service"]);
});

test("multireim er ikke registerreim", () => {
  likt(gjettServicepunkter("motor", "Byttet multireim"), ["multireim"]);
  likt(gjettServicepunkter("service", "Ny registerreim"), ["registerreim"]);
});

test("dieselfilter gjenkjennes og blandes ikke med oljefilter", () => {
  likt(gjettServicepunkter("service", "Oljefilter, Olje, Dieselfilter og Pollenfilter").sort(),
    ["drivstoffilter-diesel", "motorolje", "oljefilter", "pollenfilter"]);
});

test("deler fra ekte historikk havner i riktig kategori, ikke «Annet»", () => {
  const ekte = [
    ["Hjullager høyre bak", ["hjullager"]],
    ["Styreledd indre og ytre høyre", ["indre-styreledd", "ytre-styreledd"]],
    ["Endeledd høyre side", ["ytre-styreledd"]],
    ["Stabilisatorstagg høyre og vestre", ["stabilisatorstag"]],
    ["Bærearm øvre Venstre Bak", ["ovre-baerearm"]],
    ["Bærekule, v og h nedre", ["nedre-kuleledd"]],
    ["Reparert rust i ramme", ["rustreparasjon"]],
    ["Reparert kanaler Venstre side", ["rustreparasjon"]],
    ["Tectylbehandling", ["rustbehandling"]],
    ["Byttet turbo", ["turbo"]],
    ["Bytte EGR ventil", ["egr"]],
    ["Glødeplugger", ["gloeplugger"]],
    ["Regreim og multireim", ["registerreim", "multireim"]],
    ["Kompressor, Lufttank og Ventilblokk", ["luftkompressor", "lufttank", "ventilblokk"]],
    ["Skifte av mansjett luftdemper høyre bak", ["luftfjaerbelg"]],
    ["Drivakselledd venstre framme ytre", ["drivakselledd"]],
    ["Skifte av girkasse, inkl filter og olje", ["girkasse"]],
    ["Bytte av Gearvelger konsoll m kabel", ["girvelger"]],
    ["Diffolje forran og bak, Transfercaseolje.", ["diff-foran", "diff-bak", "overforing"]],
    ["Håndbrems mekanisme, reprasjon", ["parkbrems"]],
    ["Rep eksoslekasje", ["eksos"]],
    ["Batteri", ["batteri"]],
  ];
  for (const [tekst, forventet] of ekte) likt(gjettServicepunkter("annet", `${tekst} Ekstra Service`), forventet);
});

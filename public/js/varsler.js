// Varsler til brukeren. Ren logikk: data inn, liste med varsler ut.
// Ingen DOM og ingen nettverk, slik at reglene kan testes og gjenbrukes i en app.
//
// Foreløpig: EU-kontroll, service (frist nær eller passert) og dekkskift (sommer/vinter).
// TODO (Anders): slitasje i % på deler kommer her.
//   Legg til en ny funksjon per type og kall den i lagVarsler().

import { bilLenke, euStatus } from "./bilstatus.js";
import { serviceVarsler } from "./servicevarsler.js";
import { dekkPaBilen, dekkskift } from "./dekk.js";

/**
 * @typedef {object} Varsel
 * @property {string} id       Stabil nøkkel, f.eks. "eu:BR67285"
 * @property {"kritisk"|"sjekk"} niva
 * @property {string} tittel
 * @property {string} tekst
 * @property {string} [lenke]  Hvor brukeren kan gjøre noe med det
 */

const REKKEFOLGE = { kritisk: 0, sjekk: 1 };

function bilNavn(bil) {
  return bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ") || bil.kjennemerke;
}

/** EU-kontroll: varsle når fristen nærmer seg eller har gått ut. */
export function euVarsler(bil, idag = new Date()) {
  const eu = euStatus(bil.eu_kontrollfrist, idag);
  if (eu.status !== "kritisk" && eu.status !== "sjekk") return [];
  return [{
    id: `eu:${bil.kjennemerke}`,
    niva: eu.status,
    tittel: eu.status === "kritisk" ? "EU-kontrollen har gått ut" : "EU-kontroll nærmer seg",
    tekst: `${bilNavn(bil)} (${bil.kjennemerke}): ${eu.tekst}`,
    lenke: bilLenke(bil, "service"),
  }];
}

/** Dekkskift: varsle når det snart er tid for å bytte mellom sommer- og vinterdekk. */
export function dekkVarsler(bil, idag = new Date()) {
  const sett = dekkPaBilen(bil.dekksett);
  if (!sett) return [];
  const iDag = `${idag.getFullYear()}-${String(idag.getMonth() + 1).padStart(2, "0")}-${String(idag.getDate()).padStart(2, "0")}`;
  const skift = dekkskift({ type: sett.type, pigg: sett.pigg, region: bil.dekk_region ?? "sor", idag: iDag });
  if (skift.status !== "snart" && skift.status !== "forfalt") return [];
  const til = skift.bytteTil === "vinter" ? "vinterdekk" : "sommerdekk";
  return [{
    id: `dekk:${bil.kjennemerke}`,
    niva: skift.status === "forfalt" ? "kritisk" : "sjekk",
    tittel: skift.status === "forfalt" ? `Bytt til ${til}` : `Snart tid for ${til}`,
    tekst: `${bilNavn(bil)} (${bil.kjennemerke}): ${skift.tekst}`,
    lenke: bilLenke(bil, "dekk"),
  }];
}

/**
 * Alle varsler for brukerens biler, viktigste først.
 * @param {Array} biler  Gjerne med `dekksett` (liste) på hver bil
 * @param {Date} idag
 * @param {object} [service] Per kjennemerke: { punkter, sisteUtfort, kmNaa }
 */
export function lagVarsler(biler, idag = new Date(), service = {}) {
  return (biler ?? [])
    .flatMap((bil) => [
      ...euVarsler(bil, idag),
      ...serviceVarsler(bil, service[bil.kjennemerke] ?? {}, idag),
      ...dekkVarsler(bil, idag),
      // ...slitasjeVarsler(bil, idag),  ← kommer
    ])
    .sort((a, b) => REKKEFOLGE[a.niva] - REKKEFOLGE[b.niva]);
}

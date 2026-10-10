// Varsler til brukeren. Ren logikk: data inn, liste med varsler ut.
// Ingen DOM og ingen nettverk, slik at reglene kan testes og gjenbrukes i en app.
//
// Foreløpig: EU-kontroll og service (frist nær eller passert).
// TODO (Anders): slitasje i % på deler kommer her.
//   Legg til en ny funksjon per type og kall den i lagVarsler().

import { euStatus } from "./bilstatus.js";
import { serviceVarsler } from "./servicevarsler.js";

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
    lenke: "/min-side",
  }];
}

/**
 * Alle varsler for brukerens biler, viktigste først.
 * @param {Array} biler
 * @param {Date} idag
 * @param {object} [service] Per kjennemerke: { punkter, sisteUtfort, kmNaa }
 */
export function lagVarsler(biler, idag = new Date(), service = {}) {
  return (biler ?? [])
    .flatMap((bil) => [
      ...euVarsler(bil, idag),
      ...serviceVarsler(bil, service[bil.kjennemerke] ?? {}, idag),
      // ...slitasjeVarsler(bil, idag),  ← kommer
    ])
    .sort((a, b) => REKKEFOLGE[a.niva] - REKKEFOLGE[b.niva]);
}

// Servicevarsler for ett kjøretøy. Ren logikk, ingen DOM og ingen nettverk.
// Ukjent status (ingen registrering ennå) gir ikke varsel, for å unngå støy.

import { beregnServicefrist, fmtDato, fmtKm } from "./service.js";

function fristTekst(res) {
  const deler = [];
  if (res.neste?.dato) deler.push(fmtDato(res.neste.dato));
  if (res.neste?.km != null) deler.push(`innen ${fmtKm(res.neste.km)} km`);
  return deler.join(" eller ");
}

function tekstFor(res, punkt) {
  if (res.status === "forfalt") {
    return `${punkt.navn} burde vært gjort ${fristTekst(res)}. Det er fint å ta det når du kan.`;
  }
  return `${punkt.navn} må gjøres ${fristTekst(res)}.`;
}

/**
 * @param {object} bil          Kjøretøy med kjennemerke, merke, modell, kallenavn
 * @param {object} data
 * @param {Array}  data.punkter Servicepunkter (se servicepunkter.js)
 * @param {object} data.sisteUtfort  { [punktId]: { dato, km } }
 * @param {number|null} data.kmNaa   Dagens kilometerstand
 * @param {Date}   idag
 */
export function serviceVarsler(bil, { punkter = [], sisteUtfort = {}, kmNaa = null } = {}, idag = new Date()) {
  const iDag = idag.toISOString().slice(0, 10);
  const varsler = [];
  for (const punkt of punkter) {
    const res = beregnServicefrist({ punkt, sist: sisteUtfort[punkt.id] ?? null, idag: iDag, kmNaa });
    if (res.status !== "forfalt" && res.status !== "snart") continue;
    varsler.push({
      id: `service:${punkt.id}:${bil.kjennemerke}`,
      niva: "sjekk",
      tittel: res.status === "forfalt" ? `Service: ${punkt.navn.toLowerCase()} er forfalt` : `Service: ${punkt.navn.toLowerCase()} snart`,
      tekst: `${bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ") || bil.kjennemerke} (${bil.kjennemerke}): ${tekstFor(res, punkt)}`,
      lenke: "/min-side",
    });
  }
  return varsler;
}

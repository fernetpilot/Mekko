// Servicevarsler for ett kjøretøy. Ren logikk, ingen DOM og ingen nettverk.
// Ukjent status (ingen registrering ennå) gir ikke varsel, for å unngå støy.

import { beregnServicefrist, fmtDato, fmtKm } from "./service.js";

export function fristTekst(res) {
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

/**
 * Siste utførte per servicepunkt, av en liste med vedlikeholdsrader.
 * Rader uten servicepunkt hoppes over. Ved samme dato vinner den som har høyest km.
 * @param {Array<{servicepunkt: string, dato: string, kilometerstand: number|null}>} rader
 * @returns {Object<string, {dato: string, km: number|null}>}
 */
export function sisteUtfortPerPunkt(rader) {
  const siste = {};
  for (const r of rader ?? []) {
    if (!r.servicepunkt || !r.dato) continue;
    const eksisterende = siste[r.servicepunkt];
    const nyere = !eksisterende
      || r.dato > eksisterende.dato
      || (r.dato === eksisterende.dato && (r.kilometerstand ?? -1) > (eksisterende.km ?? -1));
    if (nyere) siste[r.servicepunkt] = { dato: r.dato, km: r.kilometerstand ?? null };
  }
  return siste;
}

const STATUS_TEKST = {
  ok: "OK",
  snart: "Snart",
  forfalt: "Bør gjøres",
  ukjent: "Ingen registrering ennå",
};

/**
 * Servicestatus per punkt, klar til visning på «Mine biler».
 * @returns {Array<{id: string, navn: string, status: string, label: string, frist: string}>}
 */
export function servicelinjer(punkter, rader, kmNaa = null, idag = new Date()) {
  const iDag = idag.toISOString().slice(0, 10);
  const siste = sisteUtfortPerPunkt(rader);
  return punkter.map((punkt) => {
    const res = beregnServicefrist({ punkt, sist: siste[punkt.id] ?? null, idag: iDag, kmNaa });
    return {
      id: punkt.id,
      navn: punkt.navn,
      status: res.status,
      label: STATUS_TEKST[res.status],
      frist: res.status === "ukjent" ? "" : fristTekst(res),
    };
  });
}

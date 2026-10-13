// «Fulgt etter boka?»: alle utførte jobber per servicepunkt mot anbefalt intervall.
// Ren modul: ingen DOM og ingen nettverk. Brukes av fanen «Service og EU».
// En jobb er «i tide» når den er gjort innen intervallet (km eller måneder, det som kommer først).

import { leggTilMåneder } from "./service.js";
import { sisteUtfortPerPunkt } from "./servicevarsler.js";
import { aktuellePunkter, punkterFor } from "./servicepunkter.js";
import { SLITASJE_PUNKTER } from "./slitasje.js";

const dagMs = 24 * 60 * 60 * 1000;
const dager = (fra, til) => Math.round((Date.parse(til) - Date.parse(fra)) / dagMs);

/** Utførte jobber for ett punkt, eldste først. Samme dato telles én gang (høyest km). */
export function jobberFor(punktId, rader) {
  const perDato = new Map();
  for (const r of rader ?? []) {
    if (!r.dato || !(r.servicepunkter ?? []).includes(punktId)) continue;
    const km = r.kilometerstand ?? null;
    const før = perDato.get(r.dato);
    if (!før || (km ?? -1) > (før.km ?? -1)) perDato.set(r.dato, { dato: r.dato, km });
  }
  return [...perDato.values()].sort((a, b) => a.dato.localeCompare(b.dato));
}

/**
 * Ett intervall mellom to jobber (eller fra siste jobb til i dag), målt mot punktets intervall.
 * andel: 1 = akkurat anbefalt intervall, 1.2 = 20 % over. Den grensen som nås først teller.
 * Null hvis intervallet ikke kan måles (mangler km og punktet har bare km-grense).
 */
export function maalIntervall(punkt, fra, til) {
  const km = fra.km != null && til.km != null ? til.km - fra.km : null;
  const andeler = [];
  if (punkt.manederIntervall != null) {
    andeler.push(dager(fra.dato, til.dato) / dager(fra.dato, leggTilMåneder(fra.dato, punkt.manederIntervall)));
  }
  if (punkt.kmIntervall != null && km != null) andeler.push(km / punkt.kmIntervall);
  const andel = andeler.length ? Math.max(...andeler) : null;
  return {
    fra: fra.dato,
    til: til.dato,
    km,
    maneder: Math.round((dager(fra.dato, til.dato) / 30.4375) * 10) / 10,
    andel,
    iTide: andel == null ? null : andel <= 1,
  };
}

/**
 * Historikken for ett punkt.
 * @returns {{ id, navn, kmIntervall, manederIntervall, jobber, intervaller, naa, maalt, iTide, snittKm, snittManeder }}
 *   intervaller: mellom utførte jobber. naa: fra siste jobb til i dag (null uten jobber).
 *   maalt/iTide: antall intervaller som kunne måles, og hvor mange av dem som var innen anbefalt.
 */
export function punktHistorikk(punkt, rader, { idag = new Date(), kmNaa = null } = {}) {
  const iDag = idag.toISOString().slice(0, 10);
  const jobber = jobberFor(punkt.id, rader);
  const intervaller = jobber.slice(1).map((j, i) => maalIntervall(punkt, jobber[i], j));
  const siste = jobber.at(-1);
  const naa = siste && siste.dato <= iDag ? { ...maalIntervall(punkt, siste, { dato: iDag, km: kmNaa }), apen: true } : null;
  const maalte = intervaller.filter((x) => x.andel != null);
  const medKm = intervaller.filter((x) => x.km != null);
  return {
    id: punkt.id,
    navn: punkt.navn,
    kmIntervall: punkt.kmIntervall ?? null,
    manederIntervall: punkt.manederIntervall ?? null,
    jobber,
    intervaller,
    naa,
    maalt: maalte.length,
    iTide: maalte.filter((x) => x.iTide).length,
    snittKm: medKm.length ? Math.round(medKm.reduce((s, x) => s + x.km, 0) / medKm.length) : null,
    snittManeder: intervaller.length
      ? Math.round((intervaller.reduce((s, x) => s + x.maneder, 0) / intervaller.length) * 10) / 10
      : null,
  };
}

/**
 * Sammenstilling for bilen: alle punkter med intervall som har minst én registrert jobb.
 * @returns {{ punkter: Array, maalt: number, iTide: number }}
 */
export function etterBoka(bil, idag = new Date()) {
  const rader = bil?.vedlikehold ?? [];
  const siste = sisteUtfortPerPunkt(rader);
  const alle = [...aktuellePunkter(punkterFor(bil), siste), ...SLITASJE_PUNKTER];
  const punkter = alle
    .map((p) => punktHistorikk(p, rader, { idag, kmNaa: bil?.kilometerstand ?? null }))
    .filter((h) => h.jobber.length);
  return {
    punkter,
    maalt: punkter.reduce((s, h) => s + h.maalt, 0),
    iTide: punkter.reduce((s, h) => s + h.iTide, 0),
  };
}

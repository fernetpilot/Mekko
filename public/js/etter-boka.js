// «Fulgt etter boka?»: alle utførte jobber per servicepunkt mot anbefalt intervall.
// Ren modul: ingen DOM og ingen nettverk. Brukes av fanen «Service og EU».
// Km veier tyngst: tid får større slingringsmonn enn kilometer.
// Km:  grønn inntil 100 %, gul inntil 120 %, rød over det.
// Tid: grønn inntil 120 %, gul inntil 160 %, rød over det.
// Den dårligste av de to gjelder. Grønn og gul teller som «i tide».

import { leggTilMåneder } from "./service.js";
import { sisteUtfortPerPunkt } from "./servicevarsler.js";
import { aktuellePunkter, punkterFor } from "./servicepunkter.js";
import { SLITASJE_PUNKTER } from "./slitasje.js";

// Øvre grense (andel av anbefalt intervall) for grønn og gul
export const GRENSER = { km: { ok: 1, litt: 1.2 }, tid: { ok: 1.2, litt: 1.6 } };
const RANG = ["ukjent", "ok", "litt", "over"];

/** ok, litt (gul), over (rød) eller ukjent (kan ikke måles) for én andel. type er "km" eller "tid". */
export function intervallStatus(andel, type = "km") {
  if (andel == null) return "ukjent";
  const g = GRENSER[type];
  if (andel <= g.ok) return "ok";
  return andel <= g.litt ? "litt" : "over";
}

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
 * andelKm/andelTid: 1 = akkurat anbefalt intervall, 1.2 = 20 % over (null hvis den ikke kan måles).
 * andel er den største av dem (lengden på stolpen). status er den dårligste av km- og tidsstatus.
 */
export function maalIntervall(punkt, fra, til) {
  const km = fra.km != null && til.km != null ? til.km - fra.km : null;
  const andelTid = punkt.manederIntervall != null
    ? dager(fra.dato, til.dato) / dager(fra.dato, leggTilMåneder(fra.dato, punkt.manederIntervall))
    : null;
  const andelKm = punkt.kmIntervall != null && km != null ? km / punkt.kmIntervall : null;
  const andeler = [andelKm, andelTid].filter((a) => a != null);
  const andel = andeler.length ? Math.max(...andeler) : null;
  const status = [intervallStatus(andelKm, "km"), intervallStatus(andelTid, "tid")]
    .reduce((a, b) => (RANG.indexOf(b) > RANG.indexOf(a) ? b : a));
  return {
    fra: fra.dato,
    til: til.dato,
    km,
    maneder: Math.round((dager(fra.dato, til.dato) / 30.4375) * 10) / 10,
    andel,
    andelKm,
    andelTid,
    status,
    iTide: status === "ukjent" ? null : status !== "over",
  };
}

/**
 * Historikken for ett punkt.
 * @returns {{ id, navn, kmIntervall, manederIntervall, jobber, intervaller, naa, maalt, iTide, snittKm, snittManeder }}
 *   intervaller: mellom utførte jobber. naa: fra siste jobb til i dag (null uten jobber).
 *   maalt/iTide: antall intervaller som kunne måles, og hvor mange av dem som var i tide (grønne og gule).
 *   snittKm/snittManeder: snitt mellom byttene, med status etter samme regler (snittStatusKm/-Tid).
 *   status: over hvis noe var rødt, litt hvis noe var gult, ellers ok (ukjent uten målte intervaller).
 */
export function punktHistorikk(punkt, rader, { idag = new Date(), kmNaa = null } = {}) {
  const iDag = idag.toISOString().slice(0, 10);
  const jobber = jobberFor(punkt.id, rader);
  const intervaller = jobber.slice(1).map((j, i) => maalIntervall(punkt, jobber[i], j));
  const siste = jobber.at(-1);
  const naa = siste && siste.dato <= iDag ? { ...maalIntervall(punkt, siste, { dato: iDag, km: kmNaa }), apen: true } : null;
  const maalte = intervaller.filter((x) => x.andel != null);
  const medKm = intervaller.filter((x) => x.km != null);
  const snittKm = medKm.length ? Math.round(medKm.reduce((sum, x) => sum + x.km, 0) / medKm.length) : null;
  const snittManeder = intervaller.length
    ? Math.round((intervaller.reduce((sum, x) => sum + x.maneder, 0) / intervaller.length) * 10) / 10
    : null;
  return {
    id: punkt.id,
    navn: punkt.navn,
    kmIntervall: punkt.kmIntervall ?? null,
    manederIntervall: punkt.manederIntervall ?? null,
    jobber,
    intervaller,
    naa,
    maalt: maalte.length,
    status: !maalte.length ? "ukjent" : maalte.some((x) => x.status === "over") ? "over"
      : maalte.some((x) => x.status === "litt") ? "litt" : "ok",
    iTide: maalte.filter((x) => x.iTide).length,
    snittKm,
    snittManeder,
    // Samme fargeregler som for hver jobb
    snittStatusKm: snittKm != null && punkt.kmIntervall ? intervallStatus(snittKm / punkt.kmIntervall, "km") : "ukjent",
    snittStatusTid: snittManeder != null && punkt.manederIntervall
      ? intervallStatus(snittManeder / punkt.manederIntervall, "tid") : "ukjent",
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

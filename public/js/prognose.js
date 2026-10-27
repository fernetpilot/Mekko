// Prognose: forventede vedlikeholdskostnader de neste fem årene.
// Ren logikk: ingen DOM, ingen nettverk. Brukes av Økonomi-fanen (fane-okonomi.js).
//
// To deler:
//  1. Planlagt vedlikehold: servicepunkter med intervall (serviceplan for modellen), slitasjedeler,
//     EU-kontroll hvert andre år og dekk som går ut på alder. Neste gang regnes fra siste utførte
//     og bilens kilometer per år (fra historikken).
//  2. Pris per jobb: brukerens egen pris for samme jobb (KPI-justert) går foran Mekkoo-anslaget i PRISER.
// Uforutsette reparasjoner og verditap er bevisst ikke med: prognosen skal vise hva det koster å holde bilen
// ved like, ikke skremme bort fra bilprosjektet.
// Dekkskift er ikke med (gjøres ofte av brukeren selv).

import { delerFor } from "./kategorier.js";
import { delId } from "./servicekatalog.js";
import { aktuellePunkter, punkterFor } from "./servicepunkter.js";
import { SLITASJE_PUNKTER } from "./slitasje.js";
import { leggTilMåneder } from "./service.js";

/**
 * Mekkoo-anslag i 2026-kroner: deler og arbeid på verksted. Grove anslag, juster ved behov.
 * Prisene KPI-justeres fra PRIS_AAR til i dag, og videre med PRISVEKST per år framover.
 */
export const PRIS_AAR = 2026;
export const PRISER = {
  motorolje: { navn: "Oljeskift med filter", pris: 2500 },
  oljefilter: { navn: "Oljefilter", pris: 0 }, // følger oljeskiftet
  luftfilter: { navn: "Luftfilter", pris: 800 },
  pollenfilter: { navn: "Pollenfilter", pris: 700 },
  "drivstoffilter-diesel": { navn: "Drivstoffilter (diesel)", pris: 1500 },
  "drivstoffilter-bensin": { navn: "Drivstoffilter (bensin)", pris: 1500 },
  bremsevaeske: { navn: "Bremsevæske", pris: 1200 },
  kjolevaeske: { navn: "Kjølevæske", pris: 1800 },
  automatgir: { navn: "Girolje automat med filter", pris: 5000 },
  "manuelt-gir": { navn: "Girolje manuell", pris: 1500 },
  overforing: { navn: "Olje overføringskasse", pris: 1200 },
  "diff-foran": { navn: "Olje differensial foran", pris: 1000 },
  "diff-bak": { navn: "Olje differensial bak", pris: 1000 },
  servostyring: { navn: "Servoolje", pris: 1000 },
  bremseklosser: { navn: "Bremseklosser (én aksel)", pris: 3000 },
  registerreim: { navn: "Registerreim med strammer og vannpumpe", pris: 12000 },
  eu_kontroll: { navn: "EU-kontroll", pris: 1100 },
  "nye-dekk": { navn: "Nytt dekksett", pris: 8000 },
  service: { navn: "Årlig service", pris: 4500 },
};

/**
 * Årlig prisvekst (KPI, %) fra SSB. Legg til fjoråret når SSB publiserer årstallet.
 * 2026 er foreløpig (januar–august).
 */
export const INFLASJON = {
  2010: 2.4, 2011: 1.3, 2012: 0.8, 2013: 2.1, 2014: 2.1, 2015: 2.2, 2016: 3.5, 2017: 1.9, 2018: 2.8,
  2019: 2.2, 2020: 1.3, 2021: 3.5, 2022: 5.8, 2023: 5.5, 2024: 3.1, 2025: 3.1, 2026: 2.9,
};
/** Antatt prisvekst per år framover. */
export const PRISVEKST = 0.03;
/** Kilometer per år når historikken ikke sier noe. */
export const STANDARD_KM_PER_AAR = 15000;
/** Årlig service for biler uten serviceplan i Mekkoo. */
const ARLIG_SERVICE = { id: "service", navn: "Årlig service", kmIntervall: 15000, manederIntervall: 12 };
const EU_MANEDER = 24;
const DEKK_MAKS_ALDER = 6;
export const AAR = 5;

// «Utført av» som betyr at brukeren gjorde jobben selv
const GJORT_SELV = /\b(selv|sjøl|sjol|privat|meg|jeg)\b/i;


const DAG = 86400000;
const tilDato = (s) => new Date(`${s}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const aarMellom = (a, b) => (tilDato(b) - tilDato(a)) / (365.25 * DAG);

/** KPI-indeks for et år (2025 = 100), regnet ut fra INFLASJON. Utenfor tabellen brukes PRISVEKST. */
export function kpi(aar) {
  let indeks = 100;
  if (aar >= 2025) {
    for (let a = 2026; a <= aar; a++) indeks *= 1 + (INFLASJON[a] ?? PRISVEKST * 100) / 100;
  } else {
    for (let a = 2025; a > aar; a--) indeks /= 1 + (INFLASJON[a] ?? PRISVEKST * 100) / 100;
  }
  return indeks;
}

/** Et beløp fra ett år i kroneverdien til et annet år. */
export const kpiJuster = (belop, fraAar, tilAar) => belop * (kpi(tilAar) / kpi(fraAar));

/** Kilometer per år ut fra kilometerstandene de siste fem årene (og dagens). */
export function kmPerAar(hendelser, { kmNaa = null, idag = new Date() } = {}) {
  const iDag = iso(idag);
  const grense = iso(new Date(idag.getTime() - 5 * 365.25 * DAG));
  const malinger = (hendelser ?? [])
    .filter((h) => h.dato && h.kilometerstand != null && h.dato >= grense && h.dato <= iDag)
    .map((h) => ({ dato: h.dato, km: Number(h.kilometerstand) }));
  if (kmNaa != null) malinger.push({ dato: iDag, km: Number(kmNaa) });
  if (malinger.length < 2) return { km: STANDARD_KM_PER_AAR, anslatt: true };
  malinger.sort((a, b) => a.dato.localeCompare(b.dato));
  const forste = malinger[0];
  const siste = malinger.reduce((a, b) => (b.km >= a.km ? b : a));
  const aar = aarMellom(forste.dato, siste.dato);
  if (aar < 0.5 || siste.km <= forste.km) return { km: STANDARD_KM_PER_AAR, anslatt: true };
  return { km: Math.round(Math.min(60000, Math.max(2000, (siste.km - forste.km) / aar)) / 500) * 500, anslatt: false };
}

// Deler på en hendelse uten posisjon («bremseklosser@fv» → «bremseklosser»), også gjettede
const delerUten = (h) => [...new Set(delerFor(h).deler.map((d) => delId(d).punktId))];

/**
 * Brukerens egen pris for en jobb: siste hendelse med kostnad der bare den jobben ble gjort.
 * @returns {{ pris: number, aar: number } | null} pris i dagens kroner
 */
export function egenPris(jobbId, hendelser, idagAar) {
  const lov = jobbId === "motorolje" ? new Set(["motorolje", "oljefilter"]) : new Set([jobbId]);
  // Prognosen regner med verksted: jobber du har gjort selv (eller som bare er deler), teller ikke
  const anslag = kpiJuster(PRISER[jobbId]?.pris ?? 0, PRIS_AAR, idagAar);
  const treff = (hendelser ?? [])
    .filter((h) => h.dato && Number(h.kostnad) > 0)
    .filter((h) => !GJORT_SELV.test(h.utfort_av ?? ""))
    .filter((h) => kpiJuster(Number(h.kostnad), Number(h.dato.slice(0, 4)), idagAar) >= anslag * 0.5)
    .filter((h) => {
      const deler = delerUten(h);
      if (jobbId === "service") return h.komponent === "service" || deler.some((d) => d === "motorolje");
      return deler.length && deler.every((d) => lov.has(d)) && deler.includes(jobbId);
    })
    .sort((a, b) => b.dato.localeCompare(a.dato));
  if (!treff.length) return null;
  const aar = Number(treff[0].dato.slice(0, 4));
  return { pris: kpiJuster(Number(treff[0].kostnad), aar, idagAar), aar };
}

/** Siste utførte per del (lagrede og gjettede deler). */
function sisteUtfort(hendelser) {
  const siste = {};
  for (const h of hendelser ?? []) {
    if (!h.dato) continue;
    for (const d of delerUten(h)) {
      const e = siste[d];
      if (!e || h.dato > e.dato) siste[d] = { dato: h.dato, km: h.kilometerstand ?? null };
    }
    if (h.komponent === "eu_kontroll") {
      const e = siste.eu_kontroll;
      if (!e || h.dato > e.dato) siste.eu_kontroll = { dato: h.dato, km: h.kilometerstand ?? null };
    }
  }
  return siste;
}

/**
 * Datoene en jobb forfaller de neste årene.
 * Neste gang = det som kommer først av tid og kilometer etter siste utførte.
 * Aldri registrert: første gang regnes midt i intervallet fra i dag (vi vet ikke når den sist ble gjort).
 */
function forfall(punkt, sist, { iDag, slutt, kmNaa, kmAar }) {
  const ut = [];
  const pluss = (dato, aar) => iso(new Date(tilDato(dato).getTime() + aar * 365.25 * DAG));
  let neste;
  if (!sist?.dato) {
    // Ukjent: midt i intervallet
    const mnd = [punkt.manederIntervall, punkt.kmIntervall && Math.round((punkt.kmIntervall / kmAar) * 12)].filter(Boolean);
    if (!mnd.length) return ut;
    neste = leggTilMåneder(iDag, Math.max(1, Math.round(Math.min(...mnd) / 2)));
  } else {
    const kandidater = [];
    if (punkt.manederIntervall) kandidater.push(leggTilMåneder(sist.dato, punkt.manederIntervall));
    if (punkt.kmIntervall) {
      kandidater.push(sist.km != null && kmNaa != null
        ? pluss(iDag, (sist.km + punkt.kmIntervall - kmNaa) / kmAar) // km igjen fra i dag
        : pluss(sist.dato, punkt.kmIntervall / kmAar));
    }
    neste = kandidater.sort()[0] ?? null;
  }
  let vern = 0;
  while (neste && neste <= slutt && vern++ < 40) {
    // Forfalt fra før: gjøres nå
    const naar = neste < iDag ? iDag : neste;
    ut.push(naar);
    // Videre framover: regn fra denne datoen med anslått kjørelengde
    const kandidater = [];
    if (punkt.manederIntervall) kandidater.push(leggTilMåneder(naar, punkt.manederIntervall));
    if (punkt.kmIntervall) kandidater.push(pluss(naar, punkt.kmIntervall / kmAar));
    neste = kandidater.sort()[0] ?? null;
  }
  return ut;
}

/**
 * Prognosen for én bil.
 * @param {object} bil  rad fra `biler` med vedlikehold (og gjerne dekksett, eu_kontrollfrist)
 * @param {object} [p]
 * @param {Date} [p.idag]
 * @param {number} [p.aar]  antall år framover
 * @returns {{
 *   fra, til, kmPerAar, kmAnslatt, poster: Array<{dato, id, navn, pris, kilde, egenAar}>,
 *   perAar: Array<{ar, planlagt, poster}>, total: number, perManed: number, kurve: Array<{dato, sum}>
 * }}
 */
export function lagPrognose(bil, { idag = new Date(), aar = AAR } = {}) {
  const hendelser = (bil?.vedlikehold ?? []).filter((h) => h.dato);
  const iDag = iso(idag);
  const iAar = idag.getUTCFullYear();
  const slutt = leggTilMåneder(iDag, aar * 12);
  const { km: kmAar, anslatt: kmAnslatt } = kmPerAar(hendelser, { kmNaa: bil?.kilometerstand ?? null, idag });
  const sisteKm = bil?.kilometerstand ?? (hendelser.reduce((m, h) => Math.max(m, h.kilometerstand ?? 0), 0) || null);
  const siste = sisteUtfort(hendelser);
  const ctx = { iDag, slutt, kmNaa: sisteKm, kmAar };

  // Pris i dagens kroner, og hvor den kommer fra
  const prisCache = {};
  const prisFor = (id) => {
    if (prisCache[id]) return prisCache[id];
    const egen = egenPris(id, hendelser, iAar);
    const anslag = kpiJuster(PRISER[id]?.pris ?? 0, PRIS_AAR, iAar);
    return (prisCache[id] = egen ? { pris: egen.pris, kilde: "egen", egenAar: egen.aar } : { pris: anslag, kilde: "anslag", egenAar: null });
  };
  // Prisvekst fra i dag til datoen
  const framskriv = (pris, dato) => pris * (1 + PRISVEKST) ** Math.max(0, aarMellom(iDag, dato));

  // 1. Planlagt vedlikehold
  const plan = punkterFor(bil);
  let punkter = plan.length
    ? aktuellePunkter(plan, siste).filter((p) => !(p.id === "oljefilter" && plan.some((q) => q.id === "motorolje")))
    : [ARLIG_SERVICE];
  // Ukjent girkasse (ingen girolje registrert): regn med automat, det vanligste på nyere biler
  if (punkter.some((p) => p.id === "automatgir") && punkter.some((p) => p.id === "manuelt-gir")) {
    punkter = punkter.filter((p) => p.id !== "manuelt-gir");
  }
  punkter.push(...SLITASJE_PUNKTER);

  const poster = [];
  const leggTil = (id, navn, dato) => {
    const p = prisFor(id);
    if (!p.pris) return;
    poster.push({ dato, id, navn: PRISER[id]?.navn ?? navn, pris: Math.round(framskriv(p.pris, dato)), kilde: p.kilde, egenAar: p.egenAar });
  };
  for (const p of punkter) {
    const sist = p.id === "service" ? (siste.motorolje ?? null) : siste[p.id] ?? null;
    for (const dato of forfall(p, sist, ctx)) leggTil(p.id, p.navn, dato);
  }

  // EU-kontroll hvert andre år fra fristen
  const euFrist = bil?.eu_kontrollfrist ?? (siste.eu_kontroll ? leggTilMåneder(siste.eu_kontroll.dato, EU_MANEDER) : null);
  if (euFrist) {
    for (let d = euFrist < iDag ? iDag : euFrist; d <= slutt; d = leggTilMåneder(d, EU_MANEDER)) leggTil("eu_kontroll", "EU-kontroll", d);
  }

  // Dekk: et sett byttes når det blir for gammelt, eller nå hvis det allerede er slitt ut
  for (const s of bil?.dekksett ?? []) {
    const mm = s.monsterdybde_mm == null ? null : Number(s.monsterdybde_mm);
    const grense = s.type === "vinter" ? 3 : 1.6;
    let dato = null;
    if (mm != null && mm < grense) dato = iDag;
    else if (s.produksjonsaar) dato = `${Math.max(iAar, s.produksjonsaar + DEKK_MAKS_ALDER)}-${s.type === "vinter" ? "10-15" : "04-15"}`;
    if (dato && dato < iDag) dato = iDag;
    if (dato && dato <= slutt) leggTil("nye-dekk", "Nytt dekksett", dato);
  }
  poster.sort((a, b) => a.dato.localeCompare(b.dato));

  // Per kalenderår (første og siste år er delvise)
  const perAar = [];
  for (let a = iAar; a <= Number(slutt.slice(0, 4)); a++) {
    const mine = poster.filter((p) => p.dato.slice(0, 4) === String(a));
    perAar.push({ ar: a, planlagt: mine.reduce((n, p) => n + p.pris, 0), poster: mine });
  }
  const total = perAar.reduce((n, x) => n + x.planlagt, 0);

  // Kurve: akkumulert fra i dag, ett punkt per måned
  const kurve = [];
  for (let m = 0; m <= aar * 12; m++) {
    const dato = leggTilMåneder(iDag, m);
    kurve.push({ dato, sum: poster.filter((p) => p.dato <= dato).reduce((n, p) => n + p.pris, 0) });
  }

  return {
    fra: iDag,
    til: slutt,
    kmPerAar: kmAar,
    kmAnslatt,
    harServiceplan: plan.length > 0,
    poster,
    perAar,
    total,
    perManed: total / (aar * 12),
    kurve,
  };
}

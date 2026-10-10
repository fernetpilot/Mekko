// Slitasjedeler: bremseklosser, luftfilter (km og tid) og dekk (alder og mønsterdybde).
// Ren logikk, ingen DOM og ingen nettverk. Alle grenser står her, og de er tallene fra
// gruppen (ikke kontrollert mot kilde ennå).

import { beregnServicefrist, leggTilMåneder, SNART_KM } from "./service.js";
import { sisteUtfortPerPunkt, fristTekst } from "./servicevarsler.js";

export const BREMSE_KM = 30000;
export const BREMSE_SNOOZE_KM = 10000;
export const LUFT_KM = 15000;
export const LUFT_MANEDER = 12;
export const DEKK_ALDER_AAR = 5;
export const DEKK_SNOOZE_MANEDER = 6;
// rad: NAF sitt råd. kritisk: lovlig minimum.
export const DEKK_GRENSER = {
  sommer: { rad: 3, kritisk: 1.6 },
  vinter: { rad: 4, kritisk: 3 },
};

// Registerreimer: 120 000 km eller 6 år, det som kommer først. Kan ikke utsettes.
export const REGISTERREIM_KM = 120000;
export const REGISTERREIM_MANEDER = 72;

export const SLITASJE_PUNKTER = [
  { id: "bremseklosser", navn: "Bremseklosser", kmIntervall: BREMSE_KM, manederIntervall: null, snoozeKm: BREMSE_SNOOZE_KM },
  { id: "luftfilter", navn: "Luftfilter", kmIntervall: LUFT_KM, manederIntervall: LUFT_MANEDER, snoozeVedOljeskift: true },
  { id: "registerreim", navn: "Registerreim", kmIntervall: REGISTERREIM_KM, manederIntervall: REGISTERREIM_MANEDER, utsettbar: false },
];

const LABEL = {
  ok: "OK",
  snart: "Snart",
  sjekk: "Bør sjekkes",
  forfalt: "Bør gjøres",
  utsatt: "Utsatt",
  ukjent: "Ingen registrering ennå",
};

/** En utsettelse er aktiv så lenge ingen av betingelsene er oppfylt. */
export function utsettelseAktiv(u, { kmNaa = null, idag, oljeskiftEtter = null }) {
  if (u.til_km != null && (kmNaa ?? 0) < u.til_km) return true;
  if (u.til_dato && idag < u.til_dato) return true;
  if (u.ved_oljeskift && !(oljeskiftEtter && oljeskiftEtter >= u.fra_dato)) return true;
  return false;
}

function harAktivUtsettelse(utsettelser, punkt, ctx) {
  return utsettelser.some((u) => u.punkt === punkt && utsettelseAktiv(u, ctx));
}

function sisteOljeskift(rader) {
  let siste = null;
  for (const r of rader) {
    if (r.servicepunkter?.includes("motorolje") && r.dato && (!siste || r.dato > siste)) siste = r.dato;
  }
  return siste;
}

function aarMellom(fraIso, tilIso) {
  return (Date.parse(tilIso) - Date.parse(fraIso)) / (365.25 * 24 * 60 * 60 * 1000);
}

/** Dekk: alder og mønsterdybde. Gir den verste statusen og en kort forklaring. */
export function beregnDekk({ dekk_type, dekk_montert, dekk_mm, idag }) {
  if (!dekk_type) return { status: "ukjent", tekst: "Legg inn dekktype, dato og mønsterdybde." };
  let status = "ok";
  const grunner = [];
  if (dekk_montert) {
    const aar = Math.floor(aarMellom(dekk_montert, idag));
    if (aar >= DEKK_ALDER_AAR) {
      status = "sjekk";
      grunner.push(`Dekkene er ${aar} år gamle. Vurder bytte etter 5–6 år, selv om det er mønster igjen.`);
    }
  }
  if (dekk_mm != null) {
    const g = DEKK_GRENSER[dekk_type];
    if (dekk_mm < g.kritisk) {
      status = "forfalt";
      grunner.push(`Mønsterdybden er ${dekk_mm} mm, under lovlig minimum (${g.kritisk} mm).`);
    } else if (dekk_mm < g.rad) {
      if (status === "ok") status = "sjekk";
      grunner.push(`Mønsterdybden er ${dekk_mm} mm, under NAF sitt råd (${g.rad} mm).`);
    }
  }
  return { status, tekst: grunner.join(" ") };
}

/**
 * Alle slitasjelinjer for en bil, klare til visning.
 * @returns {Array<{id, navn, status, label, frist, kmIgjen, kmIntervall, kanUtsette, utsettTekst}>}
 */
export function slitasjeLinjer({ bil, rader = [], utsettelser = [], kmNaa = null, idag = new Date() }) {
  const iDag = idag.toISOString().slice(0, 10);
  const siste = sisteUtfortPerPunkt(rader);
  const oljeskift = sisteOljeskift(rader);
  const ctx = { kmNaa, idag: iDag, oljeskiftEtter: oljeskift };
  const linjer = [];

  for (const punkt of SLITASJE_PUNKTER) {
    const sist = siste[punkt.id] ?? null;
    const res = sist
      ? beregnServicefrist({ punkt, sist, idag: iDag, kmNaa })
      : { status: "ukjent" };
    const utsatt = res.status !== "ukjent" && res.status !== "ok"
      && harAktivUtsettelse(utsettelser, punkt.id, ctx);
    const status = utsatt ? "utsatt" : res.status;
    linjer.push({
      id: punkt.id,
      navn: punkt.navn,
      status,
      label: LABEL[status],
      frist: res.status === "ukjent" ? "" : fristTekst(res),
      kmIgjen: res.gjenstaar?.km ?? null,
      kmIntervall: punkt.kmIntervall,
      kanUtsette: (res.status === "snart" || res.status === "forfalt") && punkt.utsettbar !== false,
      utsettTekst: punkt.snoozeKm ? `Utsett ${punkt.snoozeKm.toLocaleString("no-NO").replace(/,/g, " ")} km` : "Utsett til neste oljeskift",
    });
  }

  const dekk = beregnDekk({ ...bil, idag: iDag });
  const dekkUtsatt = (dekk.status === "sjekk" || dekk.status === "forfalt")
    && harAktivUtsettelse(utsettelser, "dekk", ctx);
  linjer.push({
    id: "dekk",
    navn: "Dekk",
    status: dekkUtsatt ? "utsatt" : dekk.status,
    label: LABEL[dekkUtsatt ? "utsatt" : dekk.status],
    frist: dekk.tekst,
    kmIgjen: null,
    kmIntervall: null,
    kanUtsette: dekk.status === "sjekk" || dekk.status === "forfalt",
    utsettTekst: "Utsett til neste sesong",
  });
  return linjer;
}

/** Hva en utsettelse skal lagres som, for et punkt. */
export function utsettelseFor(punktId, { kmNaa, idag }) {
  if (punktId === "registerreim") return null;
  if (punktId === "bremseklosser") return { punkt: punktId, til_km: (kmNaa ?? 0) + BREMSE_SNOOZE_KM };
  if (punktId === "luftfilter") return { punkt: punktId, ved_oljeskift: true };
  if (punktId === "dekk") return { punkt: punktId, til_dato: leggTilMåneder(idag, DEKK_SNOOZE_MANEDER) };
  return null;
}

export { SNART_KM };

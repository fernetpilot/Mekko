// Dekk: sommer- og vinterdekk, når de bør byttes, og hvordan hvert dekksett står seg.
// Ren logikk, ingen DOM og ingen nettverk. Datoer er ISO-strenger (YYYY-MM-DD).
//
// Piggdekkperioden følger trafikkreglene (kontroller mot vegvesen.no):
// - Sør-Norge: 1. november til og med første søndag etter 2. påskedag.
// - Nordland, Troms og Finnmark: 16. oktober til og med 1. mai.
// Piggdekk kan også brukes utenfor perioden når føret krever det. For piggfrie vinterdekk
// og sommerdekk finnes ingen faste datoer, så vi bruker piggdekkperioden som rettesnor.

import { formaterDato } from "./bilstatus.js";

export const DEKK_ALDER_AAR = 5;
// rad: NAF sitt råd. kritisk: lovlig minimum.
export const DEKK_GRENSER = {
  sommer: { rad: 3, kritisk: 1.6 },
  vinter: { rad: 4, kritisk: 3 },
};

// Hvor lenge før bytte vi sier «snart». Vårt eget valg, ikke regelverk.
export const VARSEL_DAGER_VINTER = 30;
export const VARSEL_DAGER_SOMMER = 21;

export const REGIONER = {
  sor: "Sør-Norge",
  nord: "Nordland, Troms og Finnmark",
};

const DAG_MS = 24 * 60 * 60 * 1000;

function tilUtc(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function tilIso(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function dagerMellom(fra, til) {
  return Math.round((tilUtc(til) - tilUtc(fra)) / DAG_MS);
}

/** 1. påskedag (påskesøndag) i et år. Gregoriansk kalender (Meeus/Jones/Butcher). */
export function paaskedag(aar) {
  const a = aar % 19;
  const b = Math.floor(aar / 100);
  const c = aar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maaned = Math.floor((h + l - 7 * m + 114) / 31);
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return tilIso(Date.UTC(aar, maaned - 1, dag));
}

/**
 * Piggdekkperioden for vinteren som starter høsten `hostAar`.
 * @returns {{ fra: string, til: string }} begge datoer er med
 */
export function piggdekkPeriode(hostAar, region = "sor") {
  if (region === "nord") return { fra: `${hostAar}-10-16`, til: `${hostAar + 1}-05-01` };
  // Første søndag etter 2. påskedag = påskesøndag + 7 dager
  const til = tilIso(tilUtc(paaskedag(hostAar + 1)) + 7 * DAG_MS);
  return { fra: `${hostAar}-11-01`, til };
}

/** Dekksettet som står på bilen nå, eller null. */
export function dekkPaBilen(dekksett) {
  return (dekksett ?? []).find((s) => s.pa_bilen) ?? null;
}

/** «Vinterdekk med pigg», «Vinterdekk (piggfrie)» eller «Sommerdekk». */
export function settType(sett) {
  if (sett?.type === "vinter") return sett.pigg ? "Vinterdekk med pigg" : "Vinterdekk (piggfrie)";
  if (sett?.type === "sommer") return "Sommerdekk";
  return "Dekk";
}

/** Typen pluss dimensjon: «Sommerdekk 205/55R16». */
export function settNavn(sett) {
  return [settType(sett), sett?.dimensjon].filter(Boolean).join(" ");
}

/**
 * Når bør dekkene byttes? Ser på hvilken type som står på bilen og datoen.
 * @param {{ type: "sommer"|"vinter"|null, pigg?: boolean, region?: string, idag: string }} p
 * @returns {{ status: "ok"|"snart"|"forfalt"|"ukjent", tekst: string, dato: string|null, bytteTil: "sommer"|"vinter"|null }}
 *   dato er neste byttedato (eller i dag hvis bytte burde vært gjort).
 */
export function dekkskift({ type, pigg = false, region = "sor", idag }) {
  if (type !== "sommer" && type !== "vinter") {
    return { status: "ukjent", tekst: "Velg hvilke dekk som står på bilen.", dato: null, bytteTil: null };
  }
  const aar = Number(idag.slice(0, 4));
  const hostAar = Number(idag.slice(5, 7)) >= 7 ? aar : aar - 1;
  const naa = piggdekkPeriode(hostAar, region);
  const neste = piggdekkPeriode(hostAar + 1, region);
  const vinterNaa = idag >= naa.fra && idag <= naa.til;
  // Neste gang vintersesongen starter (høsten i år, eller neste høst hvis vi er forbi våren)
  const nesteVinter = idag < naa.fra ? naa.fra : neste.fra;

  if (type === "sommer") {
    if (vinterNaa) {
      return {
        status: "forfalt",
        tekst: "Det er vintersesong. Bytt til vinterdekk.",
        dato: idag,
        bytteTil: "vinter",
      };
    }
    const dager = dagerMellom(idag, nesteVinter);
    if (dager <= VARSEL_DAGER_VINTER) {
      return {
        status: "snart",
        tekst: `Snart tid for vinterdekk. Piggdekk er lov fra ${formaterDato(nesteVinter)}.`,
        dato: nesteVinter,
        bytteTil: "vinter",
      };
    }
    return { status: "ok", tekst: `Vinterdekk rundt ${formaterDato(nesteVinter)}.`, dato: nesteVinter, bytteTil: "vinter" };
  }

  // Vinterdekk på bilen
  if (vinterNaa) {
    const dager = dagerMellom(idag, naa.til);
    const grense = pigg
      ? `Piggdekk er lov til og med ${formaterDato(naa.til)}.`
      : `Piggdekksesongen slutter ${formaterDato(naa.til)}.`;
    if (dager <= VARSEL_DAGER_SOMMER) {
      return { status: "snart", tekst: `Snart tid for sommerdekk. ${grense}`, dato: naa.til, bytteTil: "sommer" };
    }
    return { status: "ok", tekst: `Sommerdekk rundt ${formaterDato(naa.til)}.`, dato: naa.til, bytteTil: "sommer" };
  }
  // Utenfor vintersesongen. Rett før vinteren er det helt greit å ha vinterdekk på.
  if (dagerMellom(idag, nesteVinter) <= VARSEL_DAGER_VINTER) {
    return { status: "ok", tekst: "Vinterdekkene er på. Klar for vinteren.", dato: null, bytteTil: "sommer" };
  }
  if (pigg) {
    return {
      status: "forfalt",
      tekst: "Piggdekk er ikke lov nå, med mindre føret krever det. Bytt til sommerdekk.",
      dato: idag,
      bytteTil: "sommer",
    };
  }
  return {
    status: "snart",
    tekst: "Vinterdekk slites fort og bremser dårligere på sommerføre. Bytt til sommerdekk.",
    dato: idag,
    bytteTil: "sommer",
  };
}

/**
 * Hvordan står det til med et dekksett? Alder (produksjonsår fra DOT-koden) og mønsterdybde.
 * @returns {{ status: "ok"|"sjekk"|"forfalt"|"ukjent", tekst: string }}
 */
export function vurderSett(sett, idag) {
  const g = DEKK_GRENSER[sett?.type];
  if (!g) return { status: "ukjent", tekst: "" };
  const mm = sett.monsterdybde_mm == null ? null : Number(sett.monsterdybde_mm);
  if (mm == null && !sett.produksjonsaar) {
    return { status: "ukjent", tekst: "Legg inn mønsterdybde og produksjonsår." };
  }
  let status = "ok";
  const grunner = [];
  if (sett.produksjonsaar) {
    const alder = Number(idag.slice(0, 4)) - sett.produksjonsaar;
    if (alder >= DEKK_ALDER_AAR) {
      status = "sjekk";
      grunner.push(`Dekkene er ${alder} år gamle. Vurder bytte etter 5–6 år, selv om det er mønster igjen.`);
    }
  }
  if (mm != null) {
    if (mm < g.kritisk) {
      status = "forfalt";
      grunner.push(`Mønsterdybden er ${mm} mm, under lovlig minimum (${g.kritisk} mm).`);
    } else if (mm < g.rad) {
      if (status === "ok") status = "sjekk";
      grunner.push(`Mønsterdybden er ${mm} mm, under NAF sitt råd (${g.rad} mm).`);
    }
  }
  return { status, tekst: grunner.join(" ") };
}

/** Skjemavalget «sommer», «vinter» eller «vinter-pigg» → { type, pigg }. */
export function typeFraValg(valg) {
  if (valg === "vinter-pigg") return { type: "vinter", pigg: true };
  if (valg === "vinter") return { type: "vinter", pigg: false };
  return { type: "sommer", pigg: false };
}

/** { type, pigg } → skjemavalget. */
export function valgFraType(sett) {
  if (sett?.type === "vinter") return sett.pigg ? "vinter-pigg" : "vinter";
  return "sommer";
}

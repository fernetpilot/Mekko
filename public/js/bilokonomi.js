// Biløkonomi: oppsummering av kostnader og et grovt anslag på markedsverdi.
// Ren logikk: ingen DOM, ingen nettverk. Brukes av public/js/bilokonomi-side.js.

import { KOMPONENT_NAVN } from "./bilstatus.js";

/** Fast rekkefølge på utgiftspostene (styrer også fargene i diagrammene). */
export const KATEGORIER = ["service", "motor", "bremser", "dekk", "eu_kontroll", "annet"];

const DAG_MS = 24 * 60 * 60 * 1000;
const iDato = (tekst) => { const [a, m, d] = tekst.split("-").map(Number); return new Date(a, m - 1, d); };
const arMellom = (fra, til) => (til - fra) / (365.25 * DAG_MS);

/**
 * Oppsummerer kostnadene for én bil.
 * Med kjøpsdato regnes bare hendelser fra og med kjøpet.
 * @param {Array<{dato, komponent, kostnad, kilometerstand}>} hendelser
 * @param {{ kjopsdato?: string, kjopsKm?: number, kmNaa?: number, idag?: Date }} bil
 */
export function oppsummer(hendelser, { kjopsdato = null, kjopsKm = null, kmNaa = null, idag = new Date() } = {}) {
  const iPerioden = (hendelser ?? []).filter((h) => h.dato && (!kjopsdato || h.dato >= kjopsdato));
  const medKostnad = iPerioden.filter((h) => h.kostnad != null && Number(h.kostnad) > 0)
    .sort((a, b) => a.dato.localeCompare(b.dato));

  const perKategori = Object.fromEntries(KATEGORIER.map((k) => [k, 0]));
  for (const h of medKostnad) perKategori[KATEGORIER.includes(h.komponent) ? h.komponent : "annet"] += Number(h.kostnad);
  const total = Object.values(perKategori).reduce((a, b) => a + b, 0);

  // Per år: alle år fra start til i dag, også år uten kostnader
  const start = kjopsdato ?? medKostnad[0]?.dato ?? null;
  const perAr = [];
  if (start) {
    for (let ar = Number(start.slice(0, 4)); ar <= idag.getFullYear(); ar++) {
      perAr.push({ ar, sum: medKostnad.filter((h) => h.dato.startsWith(String(ar))).reduce((n, h) => n + Number(h.kostnad), 0) });
    }
  }

  // Akkumulert siden start: ett punkt per dato med kostnad
  let lop = 0;
  const akkumulert = start ? [{ dato: start, sum: 0 }] : [];
  for (const h of medKostnad) {
    lop += Number(h.kostnad);
    const siste = akkumulert[akkumulert.length - 1];
    if (siste && siste.dato === h.dato) siste.sum = lop;
    else akkumulert.push({ dato: h.dato, sum: lop });
  }

  const ar = start ? arMellom(iDato(start), idag) : 0;
  // Kilometer kjørt: fra kjøp (eller laveste registrerte) til siste kjente
  const kmListe = iPerioden.map((h) => h.kilometerstand).filter((k) => k != null);
  const kmStart = kjopsKm ?? (kmListe.length ? Math.min(...kmListe) : null);
  const kmSlutt = Math.max(kmNaa ?? -Infinity, ...(kmListe.length ? kmListe : [-Infinity]));
  const kmKjort = kmStart != null && isFinite(kmSlutt) && kmSlutt > kmStart ? kmSlutt - kmStart : null;

  return {
    total,
    perKategori,
    kategorier: KATEGORIER.filter((k) => perKategori[k] > 0).map((k) => ({ nokkel: k, navn: KOMPONENT_NAVN[k], sum: perKategori[k], andel: total ? perKategori[k] / total : 0 })),
    perAr,
    akkumulert,
    start,
    ar,
    // «Per år» gir bare mening når perioden er minst et halvt år
    snittPerAr: ar >= 0.5 ? total / ar : null,
    kmKjort,
    perKm: kmKjort ? total / kmKjort : null,
    antallMedKostnad: medKostnad.length,
    antallUtenKostnad: iPerioden.length - medKostnad.length,
  };
}

/**
 * Antakelsene bak verdianslaget. Samlet her så gruppen kan justere dem.
 * Dette er et GROVT anslag, ikke en takst – det vises alltid som et intervall.
 */
export const VERDI_ANTAKELSER = {
  // Årlig verditap etter bilens alder (andel av verdien ved starten av året)
  verditap: [
    { tilAlder: 3, sats: 0.15 },
    { tilAlder: 8, sats: 0.10 },
    { tilAlder: Infinity, sats: 0.06 },
  ],
  verditapUkjentAlder: 0.10,
  normalKmPerAr: 15000,
  kmJusteringPer10000: 0.015,   // ±1,5 % per 10 000 km over/under normalt
  kmFaktorGrenser: [0.85, 1.10],
  // Utbedringer (bremser, dekk, annet – ikke rutineservice) siste 3 år teller 30 %,
  // men aldri mer enn 15 % av grunnverdien
  utbedringKategorier: ["bremser", "dekk", "annet"],
  utbedringAr: 3,
  utbedringAndel: 0.3,
  utbedringMaksAndel: 0.15,
  gulvAndel: 0.10,              // verdien går ikke under 10 % av kjøpsprisen
  usikkerhet: 0.15,             // intervall ± 15 %
};

/**
 * Grovt anslag på markedsverdi ut fra kjøpspris, alder, kilometer og utbedringer.
 * @returns {null | { verdi, lav, hoy, steg: { tekst, verdi }[] }}
 */
export function estimerVerdi({ kjopspris, kjopsdato, kjopsKm = null, kmNaa = null, forstegangsregistrert = null, hendelser = [], idag = new Date() }, A = VERDI_ANTAKELSER) {
  if (!kjopspris || !kjopsdato) return null;
  const kjopt = iDato(kjopsdato);
  const arEid = Math.max(0, arMellom(kjopt, idag));
  const steg = [{ tekst: "Kjøpspris", verdi: kjopspris }];

  // 1. Verditap etter alder, regnet stykkevis fra alder ved kjøp til alder i dag
  let verdi = kjopspris;
  if (forstegangsregistrert) {
    let alder = Math.max(0, arMellom(iDato(forstegangsregistrert), kjopt));
    let igjen = arEid;
    while (igjen > 1e-9) {
      const trinn = A.verditap.find((t) => alder < t.tilAlder) ?? A.verditap[A.verditap.length - 1];
      const dt = Math.min(igjen, trinn.tilAlder - alder);
      verdi *= (1 - trinn.sats) ** dt;
      alder += dt;
      igjen -= dt;
    }
  } else {
    verdi *= (1 - A.verditapUkjentAlder) ** arEid;
  }
  steg.push({ tekst: `Verditap etter alder (${arEid.toFixed(1).replace(".", ",")} år eid)`, verdi: verdi - kjopspris });
  const grunnverdi = verdi;

  // 2. Kilometer: mer kjøring enn normalt trekker ned, mindre trekker opp
  if (kjopsKm != null && kmNaa != null && kmNaa >= kjopsKm) {
    const avvik = (kmNaa - kjopsKm) - A.normalKmPerAr * arEid;
    const faktor = Math.min(A.kmFaktorGrenser[1], Math.max(A.kmFaktorGrenser[0], 1 - A.kmJusteringPer10000 * avvik / 10000));
    steg.push({ tekst: `Kjørt ${Math.round(kmNaa - kjopsKm).toLocaleString("nb-NO")} km (normalt ${Math.round(A.normalKmPerAr * arEid).toLocaleString("nb-NO")})`, verdi: grunnverdi * faktor - grunnverdi });
    verdi = grunnverdi * faktor;
  }

  // 3. Utbedringer siste år teller delvis
  const fra = new Date(idag.getTime() - A.utbedringAr * 365.25 * DAG_MS);
  const utbedringer = hendelser
    .filter((h) => h.kostnad && A.utbedringKategorier.includes(h.komponent) && h.dato >= kjopsdato && iDato(h.dato) >= fra)
    .reduce((n, h) => n + Number(h.kostnad), 0);
  if (utbedringer > 0) {
    const tillegg = Math.min(A.utbedringAndel * utbedringer, A.utbedringMaksAndel * grunnverdi);
    steg.push({ tekst: `Utbedringer siste ${A.utbedringAr} år (${Math.round(utbedringer).toLocaleString("nb-NO")} kr, teller delvis)`, verdi: tillegg });
    verdi += tillegg;
  }

  verdi = Math.max(verdi, A.gulvAndel * kjopspris);
  const rund = (n) => Math.round(n / 1000) * 1000;
  return { verdi: rund(verdi), lav: rund(verdi * (1 - A.usikkerhet)), hoy: rund(verdi * (1 + A.usikkerhet)), steg };
}

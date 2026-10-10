// Små rene hjelpefunksjoner for Min side og forsiden. Ingen DOM, ingen nettverk.

/** Antall dager varselet om EU-kontroll vises før fristen (vårt eget valg, ikke regelverk). */
export const EU_VARSEL_DAGER = 60;

const DAG_MS = 24 * 60 * 60 * 1000;

/** Hele dager fra `idag` til `datoTekst` (ÅÅÅÅ-MM-DD). Negativt tall = passert. */
export function dagerTil(datoTekst, idag = new Date()) {
  const [a, m, d] = datoTekst.split("-").map(Number);
  const frist = Date.UTC(a, m - 1, d);
  const naa = Date.UTC(idag.getFullYear(), idag.getMonth(), idag.getDate());
  return Math.round((frist - naa) / DAG_MS);
}

/** Status for EU-kontroll: { status: "ok"|"sjekk"|"kritisk"|"ukjent", tekst } */
export function euStatus(kontrollfrist, idag = new Date()) {
  if (!kontrollfrist) return { status: "ukjent", tekst: "Ingen frist registrert" };
  const dager = dagerTil(kontrollfrist, idag);
  const dato = formaterDato(kontrollfrist);
  if (dager < 0) return { status: "kritisk", tekst: `Fristen gikk ut ${dato}` };
  if (dager <= EU_VARSEL_DAGER) {
    return { status: "sjekk", tekst: dager === 0 ? `Frist i dag` : `Om ${dager} dager (${dato})` };
  }
  return { status: "ok", tekst: dato };
}

const MANEDER = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

/** "2028-06-03" → "3. juni 2028" */
export function formaterDato(datoTekst) {
  if (!datoTekst) return "";
  const [a, m, d] = datoTekst.split("-").map(Number);
  return `${d}. ${MANEDER[m - 1]} ${a}`;
}

/** 214300 → "214 300 km" (mellomrom som tusenskille, slik det er vanlig på norsk) */
export function formaterKm(km) {
  if (km == null) return "–";
  return `${String(km).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km`;
}

export const KOMPONENT_NAVN = {
  motor: "Oljeskift / motor",
  bremser: "Bremser",
  dekk: "Dekk",
  service: "Service",
  eu_kontroll: "EU-kontroll",
  annet: "Annet",
};

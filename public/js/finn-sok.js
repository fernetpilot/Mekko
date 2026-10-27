// Lenke til et ferdig filtrert søk etter en del på finn.no (Torget › Bildeler).
// Ren logikk, ingen DOM. Parameterne er de finn.no selv bruker i adressen (sjekket 27. okt 2026):
//   sub_category=1.90.82  Utstyr til bil, båt og MC › Bildeler
//   brand=<id>            merke (samme id som i bilsøket på finn.no)
//   q=<tekst>             fritekst
// Finn har ikke modellfilter for deler, så modellen og delen legges i fritekstsøket.
import { delId, finnPunkt } from "./servicekatalog.js";

export const FINN_BILDELER = "https://www.finn.no/recommerce/forsale/search";
const BILDELER = "1.90.82";

// Merke-id-er hos finn.no. Merker som ikke står her, søkes på med navnet i fritekst.
export const FINN_MERKER = {
  "LAND ROVER": 781,
};

// Arbeid, væsker og oljer som ikke kjøpes som deler på finn.no
const IKKE_DEL = new Set([
  "motorolje", "automatgir", "manuelt-gir", "overforing", "diff-foran", "diff-bak", "servostyring",
  "kjolevaeske", "bremsevaeske", "spylervaeske", "ac-gass", "ac-service", "hjulstilling", "lyktjustering",
  "dekkskift", "hjulbalansering", "rustbehandling", "rustreparasjon", "smoring-dorer", "avlop",
  "ekstra-service", "annet-arbeid",
]);

// Søkeord der navnet i katalogen gir for få treff
const SOKEORD = {
  "parkbrems": "håndbrekk",
  "slitasjesensor-brems": "slitasjesensor",
  "ytre-styreledd": "styreledd",
  "indre-styreledd": "styreledd",
  "styresnekke": "styresnekke",
  "rattaksling": "rattaksling",
  "ovre-baerearm": "bærearm",
  "nedre-baerearm": "bærearm",
  "ovre-kuleledd": "kuleledd",
  "nedre-kuleledd": "kuleledd",
  "foring-ovre-fremre": "foringer",
  "foring-ovre-bakre": "foringer",
  "foring-nedre-fremre": "foringer",
  "foring-nedre-bakre": "foringer",
  "stotdemper": "støtdemper",
  "luftfjaerbelg": "luftfjæring",
  "luftkompressor": "kompressor luftfjæring",
  "lufttorker": "kompressor luftfjæring",
  "kompressorrele": "kompressor luftfjæring",
  "luftror": "luftfjæring",
  "mellomaksel": "mellomaksel",
  "kardanaksel": "kardang",
  "girkasse": "girkasse",
  "clutch": "clutch",
  "girvelger": "girvelger",
  "kjoler": "kjøler",
  "adblue": "adblue",
  "hoytrykkspumpereim": "registerreim",
  "kjolevifte": "kjølevifte",
  "injektorer": "dyser",
  "sveivhusventilasjon": "oljeutskiller",
  "egr": "egr",
  "eksos": "eksos",
  "dpf": "partikkelfilter",
  "lyspaerer": "lykt",
  "sikringer": "sikringsboks",
  "hengerkontakt": "hengerfeste",
  "nye-dekk": "dekk",
  "tpms": "tpms",
  "varmeapparat": "varmeapparat",
};

/** Søkeordet for en del, eller null hvis delen ikke er noe man kjøper (væsker, arbeid). */
export function sokeord(id) {
  const punktId = delId(id).punktId;
  if (IKKE_DEL.has(punktId)) return null;
  if (SOKEORD[punktId]) return SOKEORD[punktId];
  const punkt = finnPunkt(punktId);
  if (!punkt) return null;
  // «Hjullager / nav» → «hjullager», «Registerreim (inkl. strammer)» → «registerreim»
  return punkt.navn.split(/[(/,]/)[0].trim().toLowerCase();
}

/**
 * Modellnavnet som brukes i søket: første ord, pluss generasjonen hvis den står rett etter
 * («DISCOVERY 3 TDV6 HSE» → «discovery 3»). Lange handelsbetegnelser gir ellers ingen treff.
 */
export function modellOrd(modell) {
  const ord = String(modell ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!ord.length) return "";
  return /^\d{1,2}$/.test(ord[1] ?? "") ? `${ord[0]} ${ord[1]}` : ord[0];
}

/**
 * Adressen til et finn.no-søk etter delen, filtrert på bilens merke og modell.
 * @param {{ merke?: string, modell?: string }} bil
 * @param {string} id  punkt-id fra servicekatalogen (kan ha @posisjon)
 * @returns {string|null}  null hvis delen ikke kjøpes som del
 */
export function finnLenke(bil, id) {
  const ord = sokeord(id);
  if (!ord) return null;
  return finnSok(bil, ord);
}

/** Alle deler til bilen på finn.no: samme filter, bare uten del i søket. */
export function finnAlleDeler(bil) {
  return finnSok(bil, "");
}

function finnSok(bil, ord) {
  const merke = String(bil?.merke ?? "").trim();
  const merkeId = FINN_MERKER[merke.toUpperCase()];
  const q = [!merkeId && merke.toLowerCase(), modellOrd(bil?.modell), ord].filter(Boolean).join(" ");
  const url = new URL(FINN_BILDELER);
  if (merkeId) url.searchParams.set("brand", String(merkeId));
  url.searchParams.set("sub_category", BILDELER);
  url.searchParams.set("q", q);
  return url.toString();
}

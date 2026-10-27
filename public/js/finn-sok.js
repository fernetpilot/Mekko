// Lenker til ferdig filtrerte søk på finn.no: deler til bilen (Torget › Bildeler) og lignende biler til salgs.
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

// ---------------------------------------------------------------------------
// Lignende biler til salgs (finn.no › Bil), sjekket 27. okt 2026:
//   variant=0.<merke-id>               alle modeller fra merket
//   variant=2.781.2680.<id>            én generasjon, f.eks. Discovery 3
//   mileage_from / mileage_to          kilometerstand
//   year_from / year_to                årsmodell
// ---------------------------------------------------------------------------
export const FINN_BILER = "https://www.finn.no/mobility/search/car";
export const KM_SLINGRING = 25000;
const AR_SLINGRING = 2;

// Generasjoner finn.no har egne filtre for. Første treff på modellnavnet vinner.
const FINN_VARIANTER = {
  "LAND ROVER": [
    [/DISCOVERY\s*SPORT/, "2.781.2680.2000319"],
    [/DISCOVERY\s*3/, "2.781.2680.2002262"],
    [/DISCOVERY\s*4/, "2.781.2680.2002263"],
    [/DISCOVERY\s*5/, "2.781.2680.2002264"],
  ],
};

/** finn.no sin variant-id for bilens generasjon, eller null. */
export function finnVariant(bil) {
  const merke = String(bil?.merke ?? "").trim().toUpperCase();
  const modell = String(bil?.modell ?? "").toUpperCase();
  return FINN_VARIANTER[merke]?.find(([re]) => re.test(modell))?.[1] ?? null;
}

/**
 * Søk etter samme bil til salgs på finn.no, med kilometerstand ± 25 000 km.
 * Kjenner vi ikke generasjonen, søkes det på merke + modell og årsmodell ± 2 år.
 * @param {{ merke?, modell?, kilometerstand?, forstegangsregistrert? }} bil
 * @returns {{ href: string, km: { fra, til } | null, ar: { fra, til } | null }}
 */
export function finnLignendeBiler(bil) {
  const url = new URL(FINN_BILER);
  const variant = finnVariant(bil);
  const merke = String(bil?.merke ?? "").trim();
  const merkeId = FINN_MERKER[merke.toUpperCase()];
  let ar = null;
  if (variant) {
    url.searchParams.set("variant", variant);
  } else {
    if (merkeId) url.searchParams.set("variant", `0.${merkeId}`);
    const q = [!merkeId && merke.toLowerCase(), modellOrd(bil?.modell)].filter(Boolean).join(" ");
    if (q) url.searchParams.set("q", q);
    const forste = Number(String(bil?.forstegangsregistrert ?? "").slice(0, 4));
    if (forste > 1900) {
      ar = { fra: forste - AR_SLINGRING, til: forste + AR_SLINGRING };
      url.searchParams.set("year_from", String(ar.fra));
      url.searchParams.set("year_to", String(ar.til));
    }
  }
  const kmNaa = Number(bil?.kilometerstand);
  let km = null;
  if (bil?.kilometerstand != null && Number.isFinite(kmNaa)) {
    km = { fra: Math.max(0, kmNaa - KM_SLINGRING), til: kmNaa + KM_SLINGRING };
    url.searchParams.set("mileage_from", String(km.fra));
    url.searchParams.set("mileage_to", String(km.til));
  }
  return { href: url.toString(), km, ar };
}

// ---------------------------------------------------------------------------
// Verdi ut fra annonser: brukeren skriver inn prisene fra lignende annonser på finn.no.
// (Mekko henter ikke annonsene selv: finn.no tillater ikke automatisk innhenting.)
// ---------------------------------------------------------------------------

/**
 * Leser priser fra fritekst, én per linje eller skilt med «;» eller «, ».
 * «89 900», «kr 89.900,-» og «89900 kr» gir alle 89900. Tall under 1000 hoppes over.
 */
export function tolkPriser(tekst) {
  return String(tekst ?? "")
    .split(/\n|;|,\s+/)
    .map((del) => del.replace(/,-|,00\b/g, "").replace(/\D/g, ""))
    .filter(Boolean)
    .map(Number)
    .filter((n) => n >= 1000);
}

/** Median, snitt og spenn for prisene, eller null uten priser. */
export function markedspris(priser) {
  const p = [...(priser ?? [])].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!p.length) return null;
  const midt = Math.floor(p.length / 2);
  const median = p.length % 2 ? p[midt] : (p[midt - 1] + p[midt]) / 2;
  const snitt = p.reduce((s, n) => s + n, 0) / p.length;
  return { antall: p.length, median, snitt, lav: p[0], hoy: p.at(-1) };
}

// Import av servicehistorikk fra regneark (Excel/CSV). Ren logikk: ingen DOM, ingen nettverk.
// Selve lesingen av filen skjer i public/js/importer-historikk.js (SheetJS fra CDN).

import { KOMPONENT_NAVN } from "./bilstatus.js";

/** Feltene vi kan importere, med navn som vises til brukeren */
export const FELTER = {
  dato: "Dato",
  komponent: "Hva er gjort (type)",
  kilometerstand: "Kilometerstand",
  kostnad: "Kostnad",
  utfort_av: "Utført av",
  notat: "Beskrivelse / notat",
};

// Overskrifter vi kjenner igjen (små bokstaver, uten tegnsetting)
const SYNONYMER = {
  dato: ["dato", "date", "dag", "tidspunkt", "utfort dato", "utført dato", "servicedato", "når"],
  kilometerstand: ["km", "kilometer", "kilometerstand", "km stand", "kmstand", "km-stand", "odometer", "kjorelengde", "kjørelengde", "mil", "milstand", "mil stand"],
  kostnad: ["kostnad", "pris", "belop", "beløp", "sum", "total", "totalt", "kr", "nok", "kost", "betalt", "pris kr", "beløp kr"],
  utfort_av: ["verksted", "utfort av", "utført av", "leverandor", "leverandør", "firma", "sted", "hvem", "mekaniker"],
  komponent: ["type", "kategori", "hva", "hva er gjort", "tjeneste", "jobb", "del"],
  notat: ["beskrivelse", "notat", "kommentar", "merknad", "detaljer", "arbeid", "arbeid utfort", "arbeid utført", "tekst", "info"],
};

const vask = (t) => String(t ?? "").replace(/\ufeff/g, "").toLowerCase().replace(/[()[\].:_]/g, " ").replace(/\s+/g, " ").trim();

/** Gjetter hvilket felt en kolonneoverskrift hører til, eller null. */
export function gjettFelt(overskrift) {
  const o = vask(overskrift);
  if (!o) return null;
  for (const [felt, ord] of Object.entries(SYNONYMER)) if (ord.includes(o)) return felt;
  // Delvis treff, f.eks. «Kilometerstand ved service» eller «Pris inkl. mva»
  for (const [felt, ord] of Object.entries(SYNONYMER)) {
    if (ord.some((s) => s.length >= 3 && o.split(" ").includes(s.split(" ")[0]) && o.startsWith(s.split(" ")[0]))) return felt;
  }
  return null;
}

/** Er kolonnen oppgitt i mil (1 mil = 10 km)? */
export const erMil = (overskrift) => /^mil\b|milstand/.test(vask(overskrift));

/**
 * Finner overskriftsraden blant de første radene og lager kolonnekobling.
 * @param {any[][]} rader alle rader fra arket
 * @returns {{ overskriftRad: number, kobling: (string|null)[] }}
 */
export function finnKobling(rader) {
  let best = { overskriftRad: 0, kobling: [], treff: -1 };
  rader.slice(0, 10).forEach((rad, i) => {
    const kobling = (rad ?? []).map(gjettFelt);
    // Samme felt skal bare brukes én gang: behold første treff
    const brukt = new Set();
    const unik = kobling.map((f) => (f && !brukt.has(f) ? (brukt.add(f), f) : null));
    const treff = unik.filter(Boolean).length;
    if (treff > best.treff) best = { overskriftRad: i, kobling: unik, treff };
  });
  return { overskriftRad: best.overskriftRad, kobling: best.kobling };
}

/**
 * Tolker datoer slik de typisk står i norske regneark.
 * Godtar Date-objekter, Excel-serienummer, 12.03.2023, 12.3.23, 12/03/2023 og 2023-03-12.
 * @returns {string|null} ÅÅÅÅ-MM-DD
 */
export function tolkDato(v, idag = new Date()) {
  if (v == null || v === "") return null;
  const tilTekst = (a, m, d) => {
    const dato = new Date(Date.UTC(a, m - 1, d));
    if (dato.getUTCFullYear() !== a || dato.getUTCMonth() !== m - 1 || dato.getUTCDate() !== d) return null;
    if (a < 1950 || a > idag.getFullYear() + 1) return null;
    return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS gir lokale datoer; bruk lokale felt så datoen ikke forskyves av tidssone
    return tilTekst(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return tilTekst(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return tilTekst(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (m) {
    let a = +m[3];
    if (m[3].length === 2) a += a <= idag.getFullYear() % 100 + 1 ? 2000 : 1900;
    return tilTekst(a, +m[2], +m[1]);
  }
  return null;
}

/**
 * Tolker tall som «142 000 km», «4 850,50 kr», «4.850» og «4850.5».
 * @returns {number|null}
 */
export function tolkTall(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let t = String(v).replace(/[\s  ]/g, "").replace(/(kr|nok|km|mil|,-|\.-)$/i, "").replace(/^(kr|nok)/i, "");
  if (!/\d/.test(t) || /[^\d.,-]/.test(t)) return null;
  const sisteKomma = t.lastIndexOf(","), sistePunktum = t.lastIndexOf(".");
  if (sisteKomma >= 0 && sistePunktum >= 0) {
    // Den som kommer sist er desimalskilletegnet
    t = sisteKomma > sistePunktum ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (sisteKomma >= 0) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) && !/,\d{1,2}$/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ""); // 4.850 = fire tusen åtte hundre og femti
  }
  const n = Number(t);
  return isFinite(n) ? n : null;
}

/** Gjetter type ut fra fritekst. Returnerer en nøkkel i KOMPONENT_NAVN. */
export function gjettKomponent(...tekster) {
  const t = vask(tekster.filter(Boolean).join(" "));
  if (!t) return "service";
  for (const [nokkel, navn] of Object.entries(KOMPONENT_NAVN)) {
    if (t === nokkel || t === vask(navn)) return nokkel;
  }
  if (/\beu\b|eu-?kontroll|\bpkk\b|periodisk/.test(t)) return "eu_kontroll";
  if (/brems|klosser|skiver/.test(t)) return "bremser";
  if (/dekk|hjul|felg|dekkskift|piggdekk|vinterdekk|sommerdekk/.test(t)) return "dekk";
  if (/service|vedlikehold|ettersyn/.test(t)) return "service";
  if (/olje|oljeskift|oljefilter|motor/.test(t)) return "motor";
  return "annet";
}

/**
 * Gjør regnearkrader om til forslag til hendelser.
 * @param {any[][]} rader alle rader fra arket
 * @param {{ overskriftRad: number, kobling: (string|null)[] }} oppsett
 * @param {string[]} [overskrifter] brukes til å oppdage kolonner i mil
 */
export function raderTilForslag(rader, { overskriftRad, kobling }, overskrifter = rader[overskriftRad] ?? []) {
  const kol = (felt) => kobling.indexOf(felt);
  const milFaktor = kol("kilometerstand") >= 0 && erMil(overskrifter[kol("kilometerstand")]) ? 10 : 1;
  const verdi = (rad, felt) => (kol(felt) >= 0 ? rad[kol(felt)] : null);
  const tekst = (v) => (v == null ? "" : String(v).trim());

  return rader.slice(overskriftRad + 1)
    .filter((rad) => rad && rad.some((c) => tekst(c) !== ""))
    .map((rad) => {
      const km = tolkTall(verdi(rad, "kilometerstand"));
      const kostnad = tolkTall(verdi(rad, "kostnad"));
      const typeTekst = tekst(verdi(rad, "komponent"));
      const notat = tekst(verdi(rad, "notat"));
      return {
        dato: tolkDato(verdi(rad, "dato")),
        komponent: gjettKomponent(typeTekst, typeTekst ? "" : notat),
        kilometerstand: km == null ? null : Math.round(km * milFaktor),
        kostnad: kostnad == null ? null : Math.round(kostnad * 100) / 100,
        utfort_av: tekst(verdi(rad, "utfort_av")).slice(0, 100) || null,
        // Typeteksten tas med i notatet hvis den sier mer enn typen vi gjettet
        notat: [typeTekst && gjettKomponent(typeTekst) === "annet" ? typeTekst : "", notat]
          .filter(Boolean).join(" – ").slice(0, 1000) || null,
      };
    });
}

/** Er dette trolig samme hendelse som en som allerede finnes? */
export function erDublett(forslag, eksisterende) {
  if (!forslag.dato) return false;
  return eksisterende.some((e) =>
    e.dato === forslag.dato &&
    (e.komponent === forslag.komponent ||
      (e.kilometerstand != null && e.kilometerstand === forslag.kilometerstand)));
}

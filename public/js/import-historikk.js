// Import av servicehistorikk fra regneark (Excel/CSV). Ren logikk: ingen DOM, ingen nettverk.
// Selve lesingen av filen skjer i public/js/importer-historikk.js (SheetJS fra CDN).

import { KOMPONENT_NAVN } from "./bilstatus.js";
import { ALLE_KATEGORIER } from "./kategorier.js";
import { allePunkter, POSISJONER, punktNavn } from "./servicekatalog.js";

/** Feltene vi kan importere, med navn som vises til brukeren */
export const FELTER = {
  dato: "Dato",
  komponent: "Hva er gjort (type)",
  kilometerstand: "Kilometerstand",
  kostnad: "Kostnad",
  utfort_av: "Utført av",
  notat: "Beskrivelse / notat",
};

// Overskrifter vi kjenner igjen. Sjekkes i denne rekkefølgen, og delvise treff godtas,
// slik at «Fakturadato», «Arbeidsnotater», «Totalbeløp» og «Km ved service» også fungerer.
const MONSTRE = [
  ["dato", /dato|date|tidspunkt|\bdag\b|\bnår\b|\bnar\b/],
  ["kilometerstand", /kilometer|\bkm\b|km ?stand|km-|odometer|kjørelengde|kjorelengde|\bmil\b|milstand/],
  ["kostnad", /kost|pris|beløp|belop|\bsum|total|betal|\bkr\b|\bnok\b|mva|faktura|avgift|gebyr/],
  ["utfort_av", /verksted|utført av|utfort av|leverandør|leverandor|firma|forhandler|mekaniker|\bsted\b|hvem|butikk|selskap/],
  ["komponent", /^type$|kategori|hva er gjort|^hva$|tjeneste|^del$|^jobb$|servicetype/],
  ["notat", /beskriv|notat|kommentar|merknad|detalj|arbeid|tekst|info|jobb|tiltak|utført|utfort|oppdrag/],
];

const vask = (t) => String(t ?? "").replace(/\ufeff/g, "").toLowerCase().replace(/[()[\].:_]/g, " ").replace(/\s+/g, " ").trim();

/** Gjetter hvilket felt en kolonneoverskrift hører til, eller null. */
export function gjettFelt(overskrift) {
  const o = vask(overskrift);
  if (!o) return null;
  for (const [felt, monster] of MONSTRE) if (monster.test(o)) return felt;
  return null;
}

/** Gjetter felt ut fra innholdet i en kolonne når overskriften ikke sier noe. */
export function gjettFeltFraInnhold(verdier) {
  const fylte = verdier.filter((v) => v != null && String(v).trim() !== "");
  if (fylte.length < 1) return null;
  const andel = (fn) => fylte.filter(fn).length / fylte.length;
  if (andel((v) => tolkDato(v) != null) >= 0.6) return "dato";
  if (andel((v) => /kr|nok|,-/i.test(String(v)) && tolkTall(v) != null) >= 0.6) return "kostnad";
  if (andel((v) => /km|mil/i.test(String(v)) && tolkTall(v) != null) >= 0.6) return "kilometerstand";
  const snittLengde = fylte.reduce((n, v) => n + String(v).length, 0) / fylte.length;
  if (andel((v) => tolkTall(v) == null) >= 0.8 && snittLengde >= 12) return "notat";
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

  // Kolonner uten kjent overskrift: se på innholdet
  const data = rader.slice(best.overskriftRad + 1);
  const bredde = Math.max(best.kobling.length, ...data.map((r) => r?.length ?? 0));
  const kobling = Array.from({ length: bredde }, (_, i) => best.kobling[i] ?? null);
  for (let i = 0; i < bredde; i++) {
    if (kobling[i]) continue;
    const felt = gjettFeltFraInnhold(data.map((r) => r?.[i]));
    if (felt && !kobling.includes(felt)) kobling[i] = felt;
  }
  return { overskriftRad: best.overskriftRad, kobling };
}

/**
 * Tolker datoer slik de typisk står i norske regneark.
 * Godtar Date-objekter, Excel-serienummer, 12.03.2023, 12.3.23, 12/03/2023 og 2023-03-12.
 * @returns {string|null} ÅÅÅÅ-MM-DD
 */
const MANED = { jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };

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
  // «14. august 2023», «14 aug. 2023», «14.aug.23»
  m = t.match(/^(\d{1,2})\.?\s*([a-zæøå]{3,})\.?\s*(\d{2}|\d{4})$/i);
  if (m && MANED[m[2].toLowerCase().slice(0, 3)]) {
    let a = +m[3];
    if (m[3].length === 2) a += a <= idag.getFullYear() % 100 + 1 ? 2000 : 1900;
    return tilTekst(a, MANED[m[2].toLowerCase().slice(0, 3)], +m[1]);
  }
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
  const tekst = String(v).replace(/[\u00a0\u202f]/g, " ");
  // Finn første tall i teksten, med mellomrom, punktum eller komma som skilletegn
  const funn = tekst.match(/-?\d(?:[\d .,]*\d)?/);
  if (!funn) return null;
  // «12.03.2023» og lignende er en dato, ikke et tall
  if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(funn[0].trim())) return null;
  let t = funn[0].replace(/ /g, "");
  const sisteKomma = t.lastIndexOf(","), sistePunktum = t.lastIndexOf(".");
  if (sisteKomma >= 0 && sistePunktum >= 0) {
    // Den som kommer sist er desimalskilletegnet
    t = sisteKomma > sistePunktum ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (sisteKomma >= 0) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, "") : t.replace(/,(?=.*,)/g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ""); // 4.850 = fire tusen åtte hundre og femti
  } else {
    t = t.replace(/\.(?=.*\.)/g, "");
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
      // Kolonner som ikke er koblet til noe felt legges i notatet, så ingenting går tapt
      const ekstra = overskrifter
        .map((o, i) => (kobling[i] ? null : [tekst(o), tekst(rad[i])]))
        .filter((x) => x && x[1] !== "")
        .map(([o, v]) => (o ? `${o}: ${v}` : v));
      return {
        dato: tolkDato(verdi(rad, "dato")),
        komponent: gjettKomponent(typeTekst, typeTekst ? "" : notat),
        kilometerstand: km == null ? null : Math.round(km * milFaktor),
        kostnad: kostnad == null ? null : Math.round(kostnad * 100) / 100,
        utfort_av: tekst(verdi(rad, "utfort_av")).slice(0, 100) || null,
        // Typeteksten tas med i notatet hvis den sier mer enn typen vi gjettet
        notat: [typeTekst && gjettKomponent(typeTekst) === "annet" ? typeTekst : "", notat, ...ekstra]
          .filter(Boolean).join(" – ").slice(0, 1000) || null,
      };
    });
}

/** Er dette trolig samme hendelse som en som allerede finnes? */
/**
 * Kobler forslag til hendelser som allerede finnes, én-til-én (samme dato, og samme type eller km).
 * Flere rader med samme dato og km (f.eks. flere jobber på ett besøk) kobles til hver sin hendelse:
 * først den med samme notat, så samme type.
 * @returns {Array<object|null>} treffet for hvert forslag, eller null
 */
export function kobleDubletter(forslagListe, eksisterende) {
  const brukt = new Set();
  return forslagListe.map((f) => {
    if (!f?.dato) return null;
    const kandidater = (eksisterende ?? []).filter((e) => !brukt.has(e) && e.dato === f.dato
      && (e.komponent === f.komponent || (e.kilometerstand != null && e.kilometerstand === f.kilometerstand)));
    const treff = kandidater.find((e) => vask(e.notat) === vask(f.notat))
      ?? kandidater.find((e) => e.komponent === f.komponent)
      ?? kandidater[0] ?? null;
    if (treff) brukt.add(treff);
    return treff;
  });
}

export function erDublett(forslag, eksisterende) {
  if (!forslag.dato) return false;
  return eksisterende.some((e) =>
    e.dato === forslag.dato &&
    (e.komponent === forslag.komponent ||
      (e.kilometerstand != null && e.kilometerstand === forslag.kilometerstand)));
}

// ---------------------------------------------------------------------------
// Tekst fra kvitteringer og serviceordrer (PDF med tekst)
// ---------------------------------------------------------------------------

const DATO = String.raw`(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\.?\s*(?:jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)[a-zæøå]*\.?\s*\d{2,4})`;
const TALL = String.raw`(-?\d[\d . ]*(?:[,.]\d{1,2})?)`;

/**
 * Finner dato, kilometerstand, beløp, verksted og type i teksten fra en kvittering.
 * Bare felt som faktisk ble funnet er med i svaret.
 * @param {string} tekst
 * @returns {{ dato?: string, kilometerstand?: number, kostnad?: number, utfort_av?: string, komponent: string }}
 */
export function tolkKvitteringstekst(tekst, idag = new Date()) {
  const linjer = String(tekst ?? "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const alt = linjer.join("\n");
  const svar = { komponent: gjettKomponent(alt) };

  // Dato: foretrekk når arbeidet ble utført, deretter ordre-/fakturadato. Forfallsdato brukes aldri.
  const datoEtiketter = [/utført|utfort|arbeidsdato|levert|servicedato|kontrolldato/i, /ordredato|ordre/i, /fakturadato|faktura|kvittering/i, /dato/i];
  finnDato: for (const etikett of datoEtiketter) {
    for (const l of linjer) {
      if (/forfall/i.test(l) || !etikett.test(l)) continue;
      const m = l.match(new RegExp(DATO, "i"));
      const d = m && tolkDato(m[1], idag);
      if (d) { svar.dato = d; break finnDato; }
    }
  }
  if (!svar.dato) {
    for (const l of linjer) {
      if (/forfall/i.test(l)) continue;
      for (const m of l.matchAll(new RegExp(DATO, "gi"))) {
        const d = tolkDato(m[1], idag);
        if (d) { svar.dato = d; break; }
      }
      if (svar.dato) break;
    }
  }

  // Kilometerstand: «Km-stand: 152 340», «Kilometerstand 152340», «152 340 km», «Mil: 15 234»
  const kmKandidater = [];
  for (const l of linjer) {
    const etikett = l.match(new RegExp(String.raw`(kilometerstand|km[- ]?stand|kjørelengde|kjorelengde|\bkm\b|\bmil(?:stand)?\b)[^\d\n]{0,15}` + TALL, "i"));
    if (etikett) kmKandidater.push(tolkTall(etikett[2]) * (/^mil/i.test(etikett[1]) ? 10 : 1));
    const etter = l.match(new RegExp(TALL + String.raw`\s*km\b`, "i"));
    if (etter) kmKandidater.push(tolkTall(etter[1]));
  }
  const km = kmKandidater.find((n) => n != null && n >= 100 && n <= 2_000_000);
  if (km != null) svar.kilometerstand = Math.round(km);

  // Beløp: «Å betale» er sikrest, ellers største beløp ved «Total», «Sum» eller «Beløp»
  const belop = (monster) => linjer
    .filter((l) => monster.test(l) && !/mva-grunnlag|grunnlag|rabatt|forfall|konto|kid/i.test(l))
    .map((l) => {
      const etter = l.slice(l.search(monster));
      const tall = [...etter.matchAll(new RegExp(TALL, "g"))].map((m) => tolkTall(m[1])).filter((n) => n != null && n > 0);
      return tall.length ? tall[tall.length - 1] : null;
    })
    .filter((n) => n != null && n < 10_000_000);
  const aBetale = belop(/å betale|a betale|til betaling|betalt/i);
  const totaler = aBetale.length ? aBetale : belop(/total|\bsum\b|beløp|belop/i);
  if (totaler.length) svar.kostnad = Math.round(Math.max(...totaler) * 100) / 100;

  // Verksted: firmanavn øverst på dokumentet («… AS»)
  const firma = linjer.slice(0, 15).find((l) => /\b(AS|ASA|ANS|DA|ENK|SA)\b/.test(l) && l.length <= 60 && !/org|mva|konto/i.test(l));
  if (firma) svar.utfort_av = firma.slice(0, 100);

  return svar;
}

// ---------------------------------------------------------------------------
// PDF med mange hendelser (servicehefte, utskrift av servicehistorikk)
// ---------------------------------------------------------------------------

const START_MED_DATO = new RegExp("^" + DATO + String.raw`(?:\s*[·|–\-:,]\s*|\s+|$)(.*)$`, "i");

// Kategorinavn og delnavn slik Mekkoo skriver dem (se kategorier.js og servicekatalog.js),
// så et servicehefte fra Mekkoo kan leses inn igjen med kategorier og deler.
const KATEGORI_FRA_NAVN = new Map(ALLE_KATEGORIER.map((k) => [vask(k.navn), k.id]));
const DEL_NAVN = allePunkter()
  .flatMap((p) => (p.perPosisjon ? POSISJONER.map((pos) => `${p.id}@${pos.id}`) : [p.id]))
  .map((id) => [punktNavn(id), id])
  .sort((a, b) => b[0].length - a[0].length);   // lengste først, så «Øvre kuleledd (foran venstre)» slår «Øvre kuleledd»

/** «Motorolje, Oljefilter, Øvre bærearm, komplett (foran venstre)» → id-er. Ukjente navn hoppes over. */
export function delerFraTekst(tekst) {
  let rest = ` ${String(tekst ?? "")} `;
  const funnet = [];
  for (const [navn, id] of DEL_NAVN) {
    const i = rest.indexOf(navn);
    if (i < 0) continue;
    funnet.push({ i, id });
    rest = rest.slice(0, i) + " ".repeat(navn.length) + rest.slice(i + navn.length);
  }
  return funnet.sort((a, b) => a.i - b.i).map((f) => f.id);
}

// Kategori → type i det gamle feltet «Hva er gjort»
const TYPE_FRA_KATEGORI = { bremser: "bremser", dekk: "dekk", oljer: "motor", eu_kontroll: "eu_kontroll", service: "service" };

/** Er overskriften bare kategorinavn, som «Hjuloppheng og styring · Bremser»? Gir kategori-id-ene eller null. */
function kategorierITittel(tittel) {
  const uten = String(tittel ?? "").replace(/^(service|eu-kontroll)\s*:\s*/i, "");
  const deler = uten.split(/\s+·\s+/).map((d) => KATEGORI_FRA_NAVN.get(vask(d)));
  return deler.length && deler.every(Boolean) ? deler : null;
}

/** Finner typen ut fra overskriften, f.eks. «Oljeskift / motor», «EU-kontroll» eller «Service: Bremser». */
function typeFraTittel(tittel, resten) {
  const t = vask(tittel);
  for (const [nokkel, navn] of Object.entries(KOMPONENT_NAVN)) {
    if (t === nokkel || t === vask(navn)) return nokkel;
  }
  if (/^service\s*:/i.test(tittel)) return "service";
  if (/^eu-kontroll\s*:/i.test(tittel)) return "eu_kontroll";
  const kategorier = kategorierITittel(tittel);
  if (kategorier) return kategorier.map((k) => TYPE_FRA_KATEGORI[k]).find(Boolean) ?? "annet";
  return gjettKomponent(tittel, resten);
}

/**
 * Deler teksten i hendelser når den er en liste der hver hendelse starter med en dato
 * (som serviceheftet fra Mekkoo eller utskrifter fra verksteder). Gir tom liste hvis
 * teksten ikke ser ut som en liste (færre enn to hendelser) – da tolkes den som én kvittering.
 * @returns {Array<{ dato, komponent, kilometerstand, kostnad, utfort_av, notat, servicepunkter }>}
 */
export function tolkHendelsesliste(tekst, idag = new Date()) {
  const linjer = String(tekst ?? "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const blokker = [];
  let gjeldende = null;
  for (const l of linjer) {
    if (/^vedlegg \d+\s*[–-]/i.test(l)) break;            // vedleggssider i et Mekkoo-servicehefte
    if (/\bside \d+ av \d+\b/i.test(l) || /^vedlegg \d+:/i.test(l)) continue; // sidetall og vedleggslister
    const m = l.match(START_MED_DATO);
    const dato = m && tolkDato(m[1], idag);
    if (dato) {
      gjeldende = { dato, tittel: m[2].trim(), linjer: [] };
      blokker.push(gjeldende);
    } else if (gjeldende) {
      gjeldende.linjer.push(l);
    }
  }
  if (blokker.length < 2) return [];

  return blokker.map((b) => {
    let kilometerstand = null, kostnad = null, utfort_av = null;
    const notat = [];
    const servicepunkter = [];
    for (const l of b.linjer) {
      // «Bremser: Bremseklosser, Bremseskiver» – kategori med deler, slik Mekkoo skriver det
      const kat = l.match(/^([^:]{3,60}):\s*(.+)$/);
      if (kat && KATEGORI_FRA_NAVN.has(vask(kat[1]))) {
        const funnet = delerFraTekst(kat[2]);
        if (funnet.length) { servicepunkter.push(...funnet.filter((id) => !servicepunkter.includes(id))); continue; }
      }
      // Linjer som «280 000 km · 67 kr · Utført av: Verksted AS» deles opp i biter
      const biter = l.split(/\s+·\s+/);
      const erDetaljlinje = biter.length > 1 || /^(utført av|utfort av)/i.test(l) || /^\d[\d\s.]*\s*(km|mil)\b/i.test(l)
        || /^(?:kr\.?\s*)?\d[\d\s.,]*\s*(kr|nok|,-)$/i.test(l);
      if (!erDetaljlinje) { notat.push(l); continue; }
      for (const bit of biter) {
        let m;
        if ((m = bit.match(/^(?:km[- ]?stand:?\s*)?(\d[\d\s.,]*)\s*(km|mil)$/i))) {
          kilometerstand = Math.round(tolkTall(m[1]) * (/mil/i.test(m[2]) ? 10 : 1));
        } else if ((m = bit.match(/^(?:kr\.?\s*)?(\d[\d\s.,]*)\s*(?:kr|nok|,-)?$/i)) && /kr|nok|,-/i.test(bit)) {
          kostnad = tolkTall(m[1]);
        } else if ((m = bit.match(/^(?:utført|utfort) av:?\s*(.+)$/i))) {
          utfort_av = m[1].trim().slice(0, 100);
        } else {
          notat.push(bit);
        }
      }
    }
    // Reserve: let etter tall med etiketter i hele blokken
    const reserve = tolkKvitteringstekst([b.tittel, ...b.linjer].join("\n"), idag);
    const tekstNotat = notat.join(" ").replace(/\s+/g, " ").trim();
    return {
      dato: b.dato,
      komponent: typeFraTittel(b.tittel, tekstNotat),
      kilometerstand: kilometerstand ?? reserve.kilometerstand ?? null,
      kostnad: kostnad ?? null,
      utfort_av: utfort_av ?? null,
      // Overskriften tas med i notatet hvis den sier mer enn typen (men ikke når den bare er kategorinavn)
      notat: [typeFraTittel(b.tittel, "") === "annet" && vask(b.tittel) !== "annet" && !kategorierITittel(b.tittel) ? b.tittel : "", tekstNotat]
        .filter(Boolean).join(" – ").slice(0, 1000) || null,
      servicepunkter,
    };
  });
}

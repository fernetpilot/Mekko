// Biløkonomi: oppsummering av kostnader og et grovt anslag på markedsverdi.
// Ren logikk: ingen DOM, ingen nettverk. Brukes av public/bilhold/js/fane-okonomi.js.

import { ALLE_KATEGORIER, hendelseTittel, kategorierFor, kostnadPerKategori } from "./kategorier.js";

// Utgiftspostene er de samme kategoriene som på hver hendelse (kategorier.js),
// så fordelingen her henger sammen med historikken og serviceheftet.
export const KATEGORIER = ALLE_KATEGORIER.map((k) => k.id);

// Notatet uten merkelapper fra importen («– Type service: …»), kort nok til en liste
const kortNotat = (t) => {
  const n = String(t ?? "").split(/\s+[–·]\s+type service:/i)[0].trim();
  return n.length > 90 ? `${n.slice(0, 88)}…` : n;
};

const DAG_MS = 24 * 60 * 60 * 1000;
const iDato = (tekst) => { const [a, m, d] = tekst.split("-").map(Number); return new Date(a, m - 1, d); };
const arMellom = (fra, til) => (til - fra) / (365.25 * DAG_MS);

const tilTekst = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** «ÅÅÅÅ-MM» for en dato. */
export const maned = (d) => (typeof d === "string" ? d.slice(0, 7) : tilTekst(d).slice(0, 7));
const sisteDag = (ym) => { const [a, m] = ym.split("-").map(Number); return new Date(a, m, 0); };

/** Standard: hele historikken, fra måneden med første hendelse til denne måneden. */
export function standardPeriode(hendelser, idag = new Date()) {
  const forste = (hendelser ?? []).map((h) => h.dato).filter(Boolean).sort()[0];
  const til = maned(idag);
  return { fra: forste ? maned(forste) : til, til };
}

/** Alle måneder fra og med fra til og med til: ["2024-11", "2024-12", "2025-01", …] */
export function manederMellom(fra, til) {
  const ut = [];
  let [a, m] = fra.split("-").map(Number);
  const [ta, tm] = til.split("-").map(Number);
  while (a < ta || (a === ta && m <= tm)) {
    ut.push(`${a}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; a++; }
  }
  return ut;
}

/**
 * Oppsummerer kostnadene for én bil.
 * Med periode ({ fra: "ÅÅÅÅ-MM", til: "ÅÅÅÅ-MM" }) regnes hendelsene i de månedene, uansett kjøpsdato.
 * Uten periode, men med kjøpsdato, regnes bare hendelser fra og med kjøpet.
 * @param {Array<{dato, komponent, kostnad, kilometerstand}>} hendelser
 * @param {{ periode?: {fra: string, til: string}, kjopsdato?: string, kjopsKm?: number, kmNaa?: number, idag?: Date }} bil
 */
export function oppsummer(hendelser, { periode = null, kjopsdato = null, kjopsKm = null, kmNaa = null, idag = new Date() } = {}) {
  if (periode && periode.fra > periode.til) periode = { fra: periode.til, til: periode.fra };
  const iPerioden = (hendelser ?? []).filter((h) => h.dato && (periode
    ? maned(h.dato) >= periode.fra && maned(h.dato) <= periode.til
    : !kjopsdato || h.dato >= kjopsdato));
  const medKostnad = iPerioden.filter((h) => h.kostnad != null && Number(h.kostnad) > 0)
    .sort((a, b) => a.dato.localeCompare(b.dato));

  const perKategori = Object.fromEntries(KATEGORIER.map((k) => [k, 0]));
  // Hvilke hendelser som inngår i hver post, så summen kan sjekkes
  const iPost = Object.fromEntries(KATEGORIER.map((k) => [k, []]));
  for (const h of medKostnad) {
    const andeler = kostnadPerKategori(h);
    for (const { id, belop } of andeler) {
      perKategori[id] += belop;
      iPost[id].push({ id: h.id, dato: h.dato, tittel: hendelseTittel(h), notat: kortNotat(h.notat), kostnad: Number(h.kostnad), belop, delt: andeler.length });
    }
  }
  // Kategorier i historikken uten registrert kostnad i perioden
  const utenKostnad = new Map();
  for (const h of iPerioden) {
    if (medKostnad.includes(h)) continue;
    for (const k of kategorierFor(h)) utenKostnad.set(k.id, (utenKostnad.get(k.id) ?? 0) + 1);
  }
  const total = medKostnad.reduce((n, h) => n + Number(h.kostnad), 0);

  // Perioden: fra første dag i fra-måneden til siste dag i til-måneden (men ikke etter i dag)
  const start = periode ? `${periode.fra}-01` : kjopsdato ?? medKostnad[0]?.dato ?? null;
  const sluttDato = periode && sisteDag(periode.til) < idag ? sisteDag(periode.til) : idag;
  const slutt = tilTekst(sluttDato);
  const sum = (filter) => medKostnad.filter(filter).reduce((n, h) => n + Number(h.kostnad), 0);

  // Per år og per måned: alle år/måneder i perioden, også de uten kostnader
  const perAr = [];
  const perManed = [];
  if (start) {
    for (let ar = Number(start.slice(0, 4)); ar <= Number(slutt.slice(0, 4)); ar++) {
      perAr.push({ ar, sum: sum((h) => h.dato.startsWith(String(ar))) });
    }
    for (const ym of manederMellom(maned(start), maned(slutt))) {
      perManed.push({ maned: ym, sum: sum((h) => h.dato.startsWith(ym)) });
    }
  }

  // Akkumulert i perioden: ett punkt per dato med kostnad
  let lop = 0;
  const akkumulert = start ? [{ dato: start, sum: 0 }] : [];
  for (const h of medKostnad) {
    lop += Number(h.kostnad);
    const siste = akkumulert[akkumulert.length - 1];
    if (siste && siste.dato === h.dato) siste.sum = lop;
    else akkumulert.push({ dato: h.dato, sum: lop });
  }

  const ar = start ? Math.max(0, arMellom(iDato(start), sluttDato)) : 0;
  // Kilometer kjørt i perioden: fra laveste til høyeste kjente kilometerstand.
  // Kjøpet og dagens kilometerstand teller med når de ligger i perioden.
  const kmListe = iPerioden.map((h) => h.kilometerstand).filter((k) => k != null);
  if (kjopsKm != null && kjopsdato && (!periode || (maned(kjopsdato) >= periode.fra && maned(kjopsdato) <= periode.til))) kmListe.push(kjopsKm);
  if (kmNaa != null && (!periode || periode.til >= maned(idag))) kmListe.push(kmNaa);
  const kmStart = !periode && kjopsKm != null ? kjopsKm : kmListe.length ? Math.min(...kmListe) : null;
  const kmSlutt = kmListe.length ? Math.max(...kmListe) : null;
  const kmKjort = kmStart != null && kmSlutt != null && kmSlutt > kmStart ? kmSlutt - kmStart : null;

  return {
    total,
    perKategori,
    // Største post først. Hver post har samme navn og ikon som på hendelsene.
    kategorier: ALLE_KATEGORIER.filter((k) => perKategori[k.id] > 0.005)
      .map((k) => ({ nokkel: k.id, navn: k.navn, ikon: k.ikon, sum: perKategori[k.id], andel: total ? perKategori[k.id] / total : 0,
        hendelser: iPost[k.id].sort((a, b) => b.dato.localeCompare(a.dato)) }))
      .sort((a, b) => b.sum - a.sum),
    // Kategorier som finnes i historikken i perioden, men uten kostnad: vises i tegnforklaringen med 0 kr
    kategorierUtenKostnad: ALLE_KATEGORIER.filter((k) => utenKostnad.has(k.id) && !(perKategori[k.id] > 0.005))
      .map((k) => ({ nokkel: k.id, navn: k.navn, ikon: k.ikon, antall: utenKostnad.get(k.id) })),
    perAr,
    perManed,
    akkumulert,
    start,
    slutt,
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
  // Utbedringer siste 3 år teller 30 %, men aldri mer enn 15 % av grunnverdien.
  // Alt unntatt rutine (oljer/væsker/filtre, EU-kontroll og service uten deler) regnes som utbedring.
  ikkeUtbedring: ["oljer", "eu_kontroll", "service"],
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
    .filter((h) => h.kostnad && h.dato >= kjopsdato && iDato(h.dato) >= fra)
    .flatMap((h) => kostnadPerKategori(h))
    .filter((x) => !A.ikkeUtbedring.includes(x.id))
    .reduce((n, x) => n + x.belop, 0);
  if (utbedringer > 0) {
    const tillegg = Math.min(A.utbedringAndel * utbedringer, A.utbedringMaksAndel * grunnverdi);
    steg.push({ tekst: `Utbedringer siste ${A.utbedringAr} år (${Math.round(utbedringer).toLocaleString("nb-NO")} kr, teller delvis)`, verdi: tillegg });
    verdi += tillegg;
  }

  verdi = Math.max(verdi, A.gulvAndel * kjopspris);
  const rund = (n) => Math.round(n / 1000) * 1000;
  return { verdi: rund(verdi), lav: rund(verdi * (1 - A.usikkerhet)), hoy: rund(verdi * (1 + A.usikkerhet)), steg };
}

// Logikk for oversiktssidene «Service og EU-kontroll» og «Vedlikehold».
// Ren modul: ingen DOM og ingen nettverk. Bilen er en rad fra tabellen `biler`
// med `vedlikehold` (og gjerne `utsettelser`) hentet med.

import { beregnServicefrist, fmtDato, fmtKm } from "./service.js";
import { sisteUtfortPerPunkt } from "./servicevarsler.js";
import { punkterFor } from "./servicepunkter.js";
import { slitasjeLinjer, SLITASJE_PUNKTER } from "./slitasje.js";
import { euStatus, dagerTil, KOMPONENT_NAVN } from "./bilstatus.js";
import { alleServicepunkter } from "./servicepunkt-gjetting.js";

export const MANEDSNAVN = ["januar", "februar", "mars", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "desember"];

// Felles status for visning: samme farger som Mine biler.
// ok = grønn, snart = gul, forfalt = rød, utsatt/ukjent = grå.
const RANG = { forfalt: 0, snart: 1, utsatt: 2, ok: 3, ukjent: 4 };

function iso(idag) {
  return idag.toISOString().slice(0, 10);
}

/** Navn på bilen slik det vises øverst. */
export function bilNavn(bil) {
  return bil?.kallenavn || [bil?.merke, bil?.modell].filter(Boolean).join(" ") || "Ukjent bil";
}

/** Bilen med gitt id, ellers den første (listen er sortert på `opprettet`). */
export function velgBil(biler, id) {
  if (!biler?.length) return null;
  return biler.find((b) => b.id === id) ?? biler[0];
}

/** EU-status (ok/sjekk/kritisk/ukjent) og slitasje-status (sjekk) → visningsstatus. */
export function normaliserStatus(status) {
  if (status === "kritisk") return "forfalt";
  if (status === "sjekk") return "snart";
  return RANG[status] != null ? status : "ukjent";
}

/** 1234.5 → «1 235 kr» */
export function formaterKr(belop) {
  if (belop == null || Number.isNaN(Number(belop))) return "–";
  return `${fmtKm(Number(belop))} kr`;
}

/** «2026-10» → «oktober 2026» */
export function maanedNavn(nokkel) {
  const [a, m] = nokkel.split("-").map(Number);
  return `${MANEDSNAVN[m - 1]} ${a}`;
}

function fristTekst(neste) {
  const deler = [];
  if (neste?.dato) deler.push(fmtDato(neste.dato));
  if (neste?.km != null) deler.push(`${fmtKm(neste.km)} km`);
  return deler.join(" eller ");
}

/**
 * Alle frister for bilen: EU-kontroll, servicepunkter og slitasjedeler.
 * @returns {Array<{id, kilde: "eu"|"service"|"slitasje", navn, status, dato, km, dagerIgjen, kmIgjen, tekst}>}
 *   status er ok/snart/forfalt/utsatt/ukjent. dato og km er neste frist (null hvis ukjent).
 */
export function alleFrister(bil, idag = new Date()) {
  const iDag = iso(idag);
  const rader = bil?.vedlikehold ?? [];
  const kmNaa = bil?.kilometerstand ?? null;
  const siste = sisteUtfortPerPunkt(rader);
  const frister = [];

  // EU-kontroll
  const eu = euStatus(bil?.eu_kontrollfrist ?? null, idag);
  frister.push({
    id: "eu",
    kilde: "eu",
    navn: "EU-kontroll",
    status: normaliserStatus(eu.status),
    dato: bil?.eu_kontrollfrist ?? null,
    km: null,
    dagerIgjen: bil?.eu_kontrollfrist ? dagerTil(bil.eu_kontrollfrist, idag) : null,
    kmIgjen: null,
    tekst: eu.tekst,
  });

  // Servicepunkter (foreløpig bare Discovery 3)
  for (const punkt of punkterFor(bil)) {
    const res = beregnServicefrist({ punkt, sist: siste[punkt.id] ?? null, idag: iDag, kmNaa });
    frister.push({
      id: punkt.id,
      kilde: "service",
      navn: punkt.navn,
      status: res.status,
      dato: res.neste?.dato ?? null,
      km: res.neste?.km ?? null,
      dagerIgjen: res.gjenstaar?.dager ?? null,
      kmIgjen: res.gjenstaar?.km ?? null,
      tekst: res.status === "ukjent" ? "Ingen registrering ennå" : fristTekst(res.neste),
    });
  }

  // Slitasje: status (med utsettelser) fra slitasjeLinjer, datoer fra samme beregning
  const linjer = slitasjeLinjer({ bil: bil ?? {}, rader, utsettelser: bil?.utsettelser ?? [], kmNaa, idag });
  for (const l of linjer) {
    const punkt = SLITASJE_PUNKTER.find((p) => p.id === l.id);
    const res = punkt && siste[punkt.id]
      ? beregnServicefrist({ punkt, sist: siste[punkt.id], idag: iDag, kmNaa })
      : null;
    frister.push({
      id: l.id,
      kilde: "slitasje",
      navn: l.navn,
      status: normaliserStatus(l.status),
      dato: res?.neste?.dato ?? null,
      km: res?.neste?.km ?? null,
      dagerIgjen: res?.gjenstaar?.dager ?? null,
      kmIgjen: res?.gjenstaar?.km ?? null,
      tekst: l.status === "ukjent" && l.id !== "dekk" ? "Ingen registrering ennå" : (punkt ? fristTekst(res?.neste) : l.frist),
    });
  }
  return frister;
}

/** Mest presserende først: forfalt, snart, …, så tidligste dato, så minst km igjen. */
export function sorterFrister(frister) {
  return [...frister].sort((a, b) =>
    (RANG[a.status] - RANG[b.status])
    || (a.dato ?? "9999").localeCompare(b.dato ?? "9999")
    || ((a.kmIgjen ?? Infinity) - (b.kmIgjen ?? Infinity))
    || a.navn.localeCompare(b.navn, "nb"));
}

/**
 * Årshjul: frister fordelt på de neste månedene.
 * - forfalt: alt som er forfalt (vises øverst i rødt)
 * - maaneder: én oppføring per måned fra og med denne (også tomme), sortert på dato
 * - senere: frister etter perioden
 * - utenDato: frister som bare har km-grense eller tekst (f.eks. bremseklosser, dekk), og utsatte
 * - ukjent: punkter uten registrering
 */
export function aarshjul(frister, idag = new Date(), antallMaaneder = 12) {
  const start = idag.getUTCFullYear() * 12 + idag.getUTCMonth();
  const maaneder = Array.from({ length: antallMaaneder }, (_, i) => {
    const a = Math.floor((start + i) / 12);
    const m = ((start + i) % 12) + 1;
    const nokkel = `${a}-${String(m).padStart(2, "0")}`;
    return { nokkel, navn: maanedNavn(nokkel), frister: [] };
  });
  const sluttNokkel = maaneder[maaneder.length - 1].nokkel;
  const res = { forfalt: [], maaneder, senere: [], utenDato: [], ukjent: [] };

  for (const f of sorterFrister(frister)) {
    if (f.status === "ukjent") res.ukjent.push(f);
    else if (f.status === "forfalt") res.forfalt.push(f);
    else if (!f.dato) res.utenDato.push(f);
    else {
      const nokkel = f.dato.slice(0, 7);
      const maaned = maaneder.find((m) => m.nokkel === nokkel);
      if (maaned) maaned.frister.push(f);
      else if (nokkel > sluttNokkel) res.senere.push(f);
      else res.utenDato.push(f); // passert dato uten å være forfalt, f.eks. utsatt
    }
  }
  for (const m of maaneder) m.frister.sort((a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn, "nb"));
  return res;
}

/**
 * Neste service: det mest presserende servicepunktet. Punkter med samme frist slås sammen
 * («Motorolje og oljefilter»). Null hvis ingen servicepunkt har en frist.
 */
export function nesteService(frister) {
  const kjente = sorterFrister(frister.filter((f) => f.kilde === "service" && f.status !== "ukjent"));
  if (!kjente.length) return null;
  const forste = kjente[0];
  const samme = kjente.filter((f) => f.status === forste.status && f.dato === forste.dato && f.km === forste.km);
  const navn = samme.map((f, i) => (i === 0 ? f.navn : f.navn.toLowerCase()));
  const navnTekst = navn.length > 1 ? `${navn.slice(0, -1).join(", ")} og ${navn.at(-1)}` : navn[0];
  return { ...forste, navn: navnTekst, antall: samme.length };
}

/** Verste slitasjestatus, med de delene som trekker ned. */
export function slitasjeOppsummering(frister) {
  const sl = frister.filter((f) => f.kilde === "slitasje" && f.status !== "ukjent");
  if (!sl.length) return { status: "ukjent", deler: [] };
  const sortert = sorterFrister(sl);
  const status = sortert[0].status;
  return { status, deler: sortert.filter((f) => f.status === status && status !== "ok") };
}

// ---------------------------------------------------------------------------
// Vedlikeholdshistorikk
// ---------------------------------------------------------------------------

const PUNKTNAVN = Object.fromEntries(alleServicepunkter().map((p) => [p.id, p.navn]));

/** Tittel på en hendelse: «Service» eller «Service: motorolje, oljefilter». */
export function hendelseTittel(rad) {
  const type = KOMPONENT_NAVN[rad.komponent] ?? rad.komponent ?? "Vedlikehold";
  const deler = (rad.servicepunkter ?? []).map((id) => PUNKTNAVN[id] ?? id);
  if (!deler.length) return type;
  return `${type}: ${deler.map((d) => d.toLowerCase()).join(", ")}`;
}

/** Nyeste først. Ved samme dato: høyest km først. */
export function sorterHendelser(rader) {
  return [...(rader ?? [])].sort((a, b) =>
    (b.dato ?? "").localeCompare(a.dato ?? "")
    || ((b.kilometerstand ?? -1) - (a.kilometerstand ?? -1)));
}

/** Summen av kostnad (rader uten kostnad teller som 0). */
export function sumKostnad(rader) {
  return (rader ?? []).reduce((sum, r) => sum + (r.kostnad != null ? Number(r.kostnad) || 0 : 0), 0);
}

/**
 * Oppsummering og tidslinje per år (nyeste år først).
 * @returns {{ antall, totalKostnad, medKostnad, siste, aar: Array<{aar, sum, hendelser}> }}
 */
export function vedlikeholdOversikt(rader) {
  const sortert = sorterHendelser(rader).filter((r) => r.dato);
  const perAar = new Map();
  for (const r of sortert) {
    const aar = r.dato.slice(0, 4);
    if (!perAar.has(aar)) perAar.set(aar, []);
    perAar.get(aar).push(r);
  }
  return {
    antall: sortert.length,
    totalKostnad: sumKostnad(sortert),
    medKostnad: sortert.filter((r) => r.kostnad != null).length,
    siste: sortert[0] ?? null,
    aar: [...perAar.entries()].map(([aar, hendelser]) => ({ aar, sum: sumKostnad(hendelser), hendelser })),
  };
}

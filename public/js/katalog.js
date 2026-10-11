// Bildelskatalogen: alle deler vi kan registrere, med område, underkategori og synonymer.
// Ren logikk, ingen DOM. Id-ene er det som lagres på vedlikeholdsrader (`servicepunkter`),
// så de må ikke endres uten migrering.
//
// Hver del har:
//   posisjon: "enkel" (én på bilen), "aksel" (par på samme aksel) eller "hjul" (én per hjul)
//   synonymer: alt vi har sett skrevet, også skrivefeil fra servicehefter. Lowercase.
//   kmIntervall / manederIntervall: bare der vi har et tall å stå for. Ellers null/utelatt.
//   kilde: hvor tallet kommer fra. Deler uten kilde er bare for registrering.

export const OMRADER = [
  { id: "service", navn: "Service" },
  { id: "bremser", navn: "Bremser" },
  { id: "hjul-styring", navn: "Hjul og styring" },
  { id: "luft", navn: "Luft og fjæring" },
  { id: "motor", navn: "Motor og avgass" },
];

const LR_TIME = "LR Time (versjon 12. okt 2023)";
const GRUPPEN = "Gruppen (ikke kontrollert)";

export const DELER = [
  // Service → Oljer og filtre
  { id: "motorolje", navn: "Motorolje", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["motorolje", "olje", "oljeskift"], kmIntervall: 10000, manederIntervall: 12, byttesMed: ["oljefilter"], kilde: LR_TIME },
  { id: "oljefilter", navn: "Oljefilter", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["oljefilter", "olje filter", "olje-filter"], kmIntervall: 10000, manederIntervall: 12, byttesMed: ["motorolje"], kilde: LR_TIME },
  { id: "dieselfilter", navn: "Dieselfilter", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["dieselfilter", "diesel filter", "diesel-filter", "drivstoffilter"], kmIntervall: 25000, manederIntervall: 36, kilde: GRUPPEN },
  { id: "pollenfilter", navn: "Pollenfilter", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["pollenfilter", "pollen", "kupefilter", "kabinfilter"] },
  { id: "luftfilter", navn: "Luftfilter", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["luftfilter", "luft filter", "luft-filter"], kmIntervall: 15000, manederIntervall: 12, kilde: GRUPPEN },
  { id: "automatgir", navn: "Automatgirolje", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel", gjelderFor: "automat",
    synonymer: ["automatgirolje", "automatgir", "girolje", "girkasse olje", "girkasseolje", "atf"], kmIntervall: 80000, manederIntervall: 60, byttesMed: ["automatgirfilter"], kilde: LR_TIME },
  { id: "automatgirfilter", navn: "Automatgirfilter", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel", gjelderFor: "automat",
    synonymer: ["automatgirfilter", "girkasse filter", "girkassefilter", "gir filter"], kmIntervall: 80000, manederIntervall: 60, byttesMed: ["automatgir"], kilde: LR_TIME },
  { id: "manuelt-gir", navn: "Manuelt gir", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel", gjelderFor: "manuell",
    synonymer: ["manuelt gir", "manuelt-gir", "manuell girolje"], kmIntervall: 80000, manederIntervall: 60, kilde: LR_TIME },
  { id: "overforing", navn: "Overføringskasse", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["transfercaseolje", "transferolje", "transfer", "transfercase", "overføringskasse", "overforing"], kmIntervall: 25000, manederIntervall: 24, kilde: LR_TIME },
  { id: "diff-foran", navn: "Differensial foran", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["diffolje forran", "diffolje foran", "diff foran", "diffolje forran og bak"], kmIntervall: 25000, manederIntervall: 24, kilde: LR_TIME },
  { id: "diff-bak", navn: "Differensial bak", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["diffolje bak", "diff bak", "diffolje forran og bak"], kmIntervall: 25000, manederIntervall: 24, kilde: LR_TIME },
  { id: "servostyring", navn: "Servoolje", omrade: "service", underkategori: "Oljer og filtre", posisjon: "enkel",
    synonymer: ["servoolje", "servo olje", "servostyring", "servo"], kmIntervall: 80000, manederIntervall: 60, kilde: LR_TIME },

  // Service → Væsker
  { id: "kjolevaeske", navn: "Kjølevæske", omrade: "service", underkategori: "Væsker", posisjon: "enkel",
    synonymer: ["kjølevæske", "kjøleveske", "kjølevæsken", "frostveske", "frostvæske"], manederIntervall: 60, kilde: LR_TIME },
  { id: "bremsevaeske", navn: "Bremsevæske", omrade: "service", underkategori: "Væsker", posisjon: "enkel",
    synonymer: ["bremsevæske", "bremseveske", "bremsevæsken"], manederIntervall: 60, kilde: LR_TIME },

  // Bremser
  { id: "bremseklosser", navn: "Bremseklosser", omrade: "bremser", posisjon: "aksel",
    synonymer: ["bremseklosser", "bremseklosse", "klosser", "klosse"], kmIntervall: 30000, kilde: GRUPPEN },
  { id: "bremseskiver", navn: "Bremseskiver", omrade: "bremser", posisjon: "aksel",
    synonymer: ["bremseskiver", "bremseskive", "bremsskiver", "skiver", "skriver"], kilde: GRUPPEN },
  { id: "caliper", navn: "Bremsecaliper", omrade: "bremser", posisjon: "hjul",
    synonymer: ["caliper", "calipere", "bremsecaliper", "kaliper"] },
  { id: "bremseslanger", navn: "Bremseslanger", omrade: "bremser", posisjon: "hjul",
    synonymer: ["bremseslanger", "bremseslange"] },
  { id: "bremserør", navn: "Bremserør", omrade: "bremser", posisjon: "aksel",
    synonymer: ["bremserør", "bremserøret", "bremsrør"] },
  { id: "handbrems", navn: "Håndbrems", omrade: "bremser", posisjon: "enkel",
    synonymer: ["håndbrems", "handbrems", "håndbremsen"] },

  // Hjul og styring
  { id: "hjullager", navn: "Hjullager", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["hjullager", "hjullagre", "hjullageret", "lager"] },
  { id: "nav", navn: "Nav", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["nav"] },
  { id: "styreledd", navn: "Styreledd", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["styreledd", "styreledd indre", "styreledd ytre"] },
  { id: "styrestag", navn: "Styrestag", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["styrestag", "styrestang"] },
  { id: "baerearm", navn: "Bærearm", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["bærearm", "bærearmer", "bærearm foring", "bærearmforing", "bjelke"] },
  { id: "baerekule", navn: "Bærekule / kuleledd", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["bærekule", "bærekuler", "kuleledd", "kuleledd nedre"] },
  { id: "stabilisatorstag", navn: "Stabilisatorstag", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["stabilisatorstag", "stabilisatorstagg", "stabilisator", "stabistag"] },
  { id: "endeledd", navn: "Endeledd", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["endeledd"] },
  { id: "drivakselledd", navn: "Drivakselledd", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["drivakselledd", "drivaksel"] },
  { id: "drivakselmansjett", navn: "Drivakselmansjett", omrade: "hjul-styring", posisjon: "hjul",
    synonymer: ["drivakselmansjett", "mansjett drivaksel"] },
  { id: "mellomaksel", navn: "Mellomaksel-oppheng", omrade: "hjul-styring", posisjon: "enkel",
    synonymer: ["mellomaksel", "mellomaksel oppheng", "mellomakselopphenget"] },

  // Luft og fjæring
  { id: "luftdemper", navn: "Luftdemper", omrade: "luft", posisjon: "hjul",
    synonymer: ["luftdemper", "luftdempere", "luftdemperne"] },
  { id: "nivasensor", navn: "Nivåsensor", omrade: "luft", posisjon: "hjul",
    synonymer: ["nivåsensor", "nivasensor", "høydesensor"] },
  { id: "kompressor", navn: "Kompressor", omrade: "luft", posisjon: "enkel",
    synonymer: ["kompressor", "luftkompressor"] },
  { id: "lufttank", navn: "Lufttank", omrade: "luft", posisjon: "enkel",
    synonymer: ["lufttank", "lufttanken"] },
  { id: "ventilblokk", navn: "Ventilblokk", omrade: "luft", posisjon: "enkel",
    synonymer: ["ventilblokk", "ventilblokken"] },

  // Motor og avgass
  { id: "registerreim", navn: "Registerreim", omrade: "motor", posisjon: "enkel",
    synonymer: ["registerreim", "multireim", "regreim", "reimstrammer", "spennrulle", "dynamoreim", "reim"], kmIntervall: 120000, manederIntervall: 72, kilde: GRUPPEN },
  { id: "egr", navn: "EGR-ventil", omrade: "motor", posisjon: "enkel",
    synonymer: ["egr-ventil", "egr ventil", "egr-ventilen", "egr"] },
  { id: "turbo", navn: "Turbo", omrade: "motor", posisjon: "enkel",
    synonymer: ["turbo", "turboen", "turboslage", "turboslange", "intercooler slange"] },
  { id: "glodeplugger", navn: "Glødeplugger", omrade: "motor", posisjon: "enkel",
    synonymer: ["glødeplugger", "glodeplugger", "glødeplugg"] },
  { id: "eksos", navn: "Eksos", omrade: "motor", posisjon: "enkel",
    synonymer: ["eksoslekasje", "eksosrør", "eksos"] },
  { id: "batteri", navn: "Batteri", omrade: "motor", posisjon: "enkel",
    synonymer: ["batteri", "batteriet"] },
];

/** Synonym → liste av del-id-er. Samme synonym kan gjelde flere deler (f.eks. «diffolje forran og bak»). */
const SYNONYMER = new Map();
for (const d of DELER) {
  for (const s of d.synonymer) {
    const liste = SYNONYMER.get(s) ?? [];
    if (!liste.includes(d.id)) liste.push(d.id);
    SYNONYMER.set(s, liste);
  }
}
// Lengste synonym først, slik at «oljefilter» tas før «olje».
const SORTERT = [...SYNONYMER.entries()].sort((a, b) => b[0].length - a[0].length);

const BOKSTAV = "a-zæøå0-9";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Tekst som beskriver hendelser, ikke deler. Disse gir ingen treff.
const HENDELSE = /feilsøk|bilsalg|godkjent|tectyl|diagnose/i;

/** Finner delene som nevnes i en tekst. Returnerer id-er i katalogens rekkefølge. */
export function finnDeler(tekst) {
  const råTekst = String(tekst ?? "");
  if (HENDELSE.test(råTekst)) return [];
  let t = ` ${råTekst.toLowerCase().replace(/[.,;:!?"()–]/g, " ")} `;
  const funnet = new Set();
  for (const [syn, ids] of SORTERT) {
    const re = new RegExp(`(^|[^${BOKSTAV}])${escape(syn)}(?=$|[^${BOKSTAV}])`, "g");
    const ny = t.replace(re, (_, før) => `${før} `);
    if (ny !== t) {
      ids.forEach((id) => funnet.add(id));
      t = ny;
    }
  }
  return DELER.filter((d) => funnet.has(d.id)).map((d) => d.id);
}

/** Delene i ett område, gruppert på underkategori. */
export function delerForOmrade(omradeId) {
  const deler = DELER.filter((d) => d.omrade === omradeId);
  const grupper = new Map();
  for (const d of deler) {
    const k = d.underkategori ?? "";
    grupper.set(k, [...(grupper.get(k) ?? []), d]);
  }
  return [...grupper.entries()].map(([underkategori, liste]) => ({ underkategori, deler: liste }));
}

export function finnDel(id) {
  return DELER.find((d) => d.id === id) ?? null;
}

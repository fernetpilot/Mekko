// Kategorier og deler per vedlikeholdshendelse. ÉN kilde for alle sider, så historikken,
// serviceheftet (nett og PDF) og biløkonomien alltid viser det samme.
// Ren logikk: ingen DOM, ingen nettverk.
//
// Kategoriene er de i servicekatalog.js (Oljer, væsker og filtre · Bremser · Hjuloppheng og styring …),
// pluss to som ikke er deler: «EU-kontroll» og «Service (uten spesifiserte deler)».
// Delene er de som er lagret på hendelsen (servicepunkter). Mangler de, gjettes de ut fra
// type og notat (som før), og hendelsen merkes som gjettet.

import { KATALOG, finnPunkt, punktNavn } from "./servicekatalog.js";
import { gjettServicepunkter } from "./servicepunkt-gjetting.js";
import { KOMPONENT_NAVN } from "./bilstatus.js";

const kat = ({ id, navn, ikon, gruppe }) => ({ id, navn, ikon, gruppe });

export const EU_KONTROLL = { id: "eu_kontroll", navn: "EU-kontroll", ikon: "✅", gruppe: "eu" };
export const SERVICE_UTEN_DELER = { id: "service", navn: "Service (uten spesifiserte deler)", ikon: "🧰", gruppe: "annet" };

/** Alle kategorier i fast rekkefølge: katalogen, så EU-kontroll og service uten deler. */
export const ALLE_KATEGORIER = [...KATALOG.map(kat), EU_KONTROLL, SERVICE_UTEN_DELER];
const KATEGORI = new Map(ALLE_KATEGORIER.map((k) => [k.id, k]));
export const kategori = (id) => KATEGORI.get(id) ?? KATEGORI.get("annet");

// Hendelser uten deler: kategorien følger feltet «Hva er gjort»
const FRA_TYPE = { bremser: "bremser", dekk: "dekk", motor: "oljer", annet: "annet" };

/**
 * Delene på en hendelse: de lagrede, eller gjettet ut fra type og notat.
 * @returns {{ deler: string[], gjettet: boolean }}
 */
export function delerFor(h) {
  const lagret = h?.servicepunkter ?? [];
  // Bare «Ekstra service»/«Annet» lagret (typisk fra import med de gamle reglene): se om notatet
  // nevner konkrete deler, så kostnaden havner i riktig kategori i stedet for «Annet».
  if (lagret.length && lagret.every((d) => (finnPunkt(d)?.kategori?.id ?? "annet") === "annet")) {
    const gjett = gjettServicepunkter(h?.komponent, h?.notat).filter((d) => finnPunkt(d)?.kategori?.id !== "annet");
    if (gjett.length) return { deler: gjett, gjettet: true };
  }
  if (lagret.length) return { deler: lagret, gjettet: false };
  if (h?.komponent === "eu_kontroll") return { deler: [], gjettet: false };
  const gjett = gjettServicepunkter(h?.komponent, h?.notat);
  return { deler: gjett, gjettet: gjett.length > 0 };
}

/**
 * Kategoriene en hendelse gjelder, i fast rekkefølge, med delene under hver.
 * @returns {Array<{ id, navn, ikon, gruppe, deler: string[], delNavn: string[] }>}
 */
export function kategorierFor(h) {
  const { deler } = delerFor(h);
  const perKategori = new Map();
  for (const del of deler) {
    const id = finnPunkt(del)?.kategori?.id ?? "annet";
    if (!perKategori.has(id)) perKategori.set(id, []);
    perKategori.get(id).push(del);
  }
  if (h?.komponent === "eu_kontroll") perKategori.set("eu_kontroll", []);
  if (!perKategori.size) {
    const id = h?.komponent === "service" ? "service" : FRA_TYPE[h?.komponent] ?? "annet";
    perKategori.set(id, []);
  }
  return ALLE_KATEGORIER
    .filter((k) => perKategori.has(k.id))
    .map((k) => ({ ...k, deler: perKategori.get(k.id), delNavn: perKategori.get(k.id).map(punktNavn) }));
}

/**
 * Tittel på en hendelse, samme overalt:
 * «Service: Oljer, væsker og filtre», «Bremser · Hjuloppheng og styring», «EU-kontroll».
 */
export function hendelseTittel(h) {
  let kategorier = kategorierFor(h).filter((k) => k.id !== "eu_kontroll" && k.id !== "service");
  // «Annet» (f.eks. merkelappen «Ekstra service») nevnes bare i tittelen når den står alene, som i kostnadsfordelingen
  if (kategorier.length > 1) kategorier = kategorier.filter((k) => k.id !== "annet");
  const type = h?.komponent === "service" ? "Service" : h?.komponent === "eu_kontroll" ? "EU-kontroll" : null;
  if (!kategorier.length) return type ?? KOMPONENT_NAVN[h?.komponent] ?? "Vedlikehold";
  const navn = kategorier.map((k) => k.navn).join(" · ");
  return type ? `${type}: ${navn}` : navn;
}

/**
 * Hvordan kostnaden på én hendelse fordeles på kategorier.
 * Lik andel per kategori, også «Annet», så biløkonomien viser de samme kategoriene som historikken.
 * @returns {Array<{ id: string, belop: number }>}
 */
export function kostnadPerKategori(h) {
  const belop = Number(h?.kostnad);
  if (!belop || belop < 0) return [];
  const alle = kategorierFor(h);
  return alle.map((k) => ({ id: k.id, belop: belop / alle.length }));
}

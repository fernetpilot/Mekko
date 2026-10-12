// Ikon og farge per servicepunkt, så man ser hva som er byttet på et besøk.
// Ren logikk. Fargene settes i CSS (klassen gruppe-<gruppe>).
// Punkter uten egen stil får ikonet og fargen til kategorien sin i servicekatalog.js.

import { finnPunkt, delId } from "./servicekatalog.js";

const STIL = {
  motorolje: { ikon: "🛢️", gruppe: "olje" },
  oljefilter: { ikon: "🧽", gruppe: "filter" },
  automatgir: { ikon: "⚙️", gruppe: "olje" },
  "manuelt-gir": { ikon: "⚙️", gruppe: "olje" },
  overforing: { ikon: "⚙️", gruppe: "olje" },
  "diff-foran": { ikon: "⚙️", gruppe: "olje" },
  "diff-bak": { ikon: "⚙️", gruppe: "olje" },
  servostyring: { ikon: "🛞", gruppe: "olje" },
  kjolevaeske: { ikon: "💧", gruppe: "vaeske" },
  bremsevaeske: { ikon: "💧", gruppe: "bremse" },
  spylervaeske: { ikon: "💧", gruppe: "vaeske" },
  bremseklosser: { ikon: "🛑", gruppe: "bremse" },
  luftfilter: { ikon: "🌬️", gruppe: "filter" },
  pollenfilter: { ikon: "🌬️", gruppe: "filter" },
  "drivstoffilter-diesel": { ikon: "🧽", gruppe: "filter" },
  "drivstoffilter-bensin": { ikon: "🧽", gruppe: "filter" },
  automatgirfilter: { ikon: "🧽", gruppe: "filter" },
  registerreim: { ikon: "🔗", gruppe: "motor" },
  "ekstra-service": { ikon: "🧰", gruppe: "annet" },
  "annet-arbeid": { ikon: "📝", gruppe: "annet" },
};

/** @returns {{ ikon: string, gruppe: string }} */
export function stilFor(punktId) {
  const id = delId(punktId).punktId;
  if (STIL[id]) return STIL[id];
  const k = finnPunkt(id)?.kategori;
  return k ? { ikon: k.ikon, gruppe: k.gruppe } : { ikon: "•", gruppe: "annet" };
}

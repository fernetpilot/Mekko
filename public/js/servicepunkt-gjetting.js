// Gjetter hvilke servicepunkter en vedlikeholdsregistrering gjelder, ut fra kategori og fritekst.
// Ren logikk. Brukes ved import og registrering, og som forslag på historikklinjer.

import { allePunkter } from "./servicekatalog.js";

/** Alle servicepunkter som kan velges, med norsk navn (hele katalogen, se servicekatalog.js). */
export function alleServicepunkter() {
  return allePunkter().map((p) => ({ id: p.id, navn: p.navn }));
}

const vask = (s) => String(s ?? "").toLowerCase();

// Rekkefølgen betyr noe: det mest spesifikke først. Treff fjernes fra teksten,
// slik at «oljefilter» ikke også gir «motorolje».
const REGLER = [
  [/bremsev[æa]ske/, "bremsevaeske"],
  [/kj[øo]lev[æa]ske/, "kjolevaeske"],
  [/servo/, "servostyring"],
  [/olje\s*-?\s*filter/, "oljefilter"],
  [/luft\s*-?\s*filter/, "luftfilter"],
  [/multi\s*-?\s*reim|aggregatreim/, "multireim"],
  [/reim/, "registerreim"],
  [/klosse/, "bremseklosser"],
  [/overf[øo]ring|transfer/, "overforing"],
  [/manuell|manuelt gir/, "manuelt-gir"],
  [/automatgir|girolje|gir-?olje|\batf\b/, "automatgir"],
];

/**
 * Motorolje og oljefilter byttes nesten alltid samtidig, så de følger hverandre.
 * @param {string[]} deler
 * @returns {string[]}
 */
export function utvidDeler(deler) {
  const s = new Set(deler ?? []);
  if (s.has("motorolje")) s.add("oljefilter");
  if (s.has("oljefilter")) s.add("motorolje");
  return [...s];
}

/**
 * @param {string} komponent  Kategori, f.eks. "bremser", "motor", "service"
 * @param {string} [tekst]    Fritekst fra notat eller type
 * @returns {string[]}        Id-er på servicepunkter, tom liste hvis ingen kunne avgjøres
 */
export function gjettServicepunkter(komponent, tekst) {
  let t = vask(tekst);
  const funnet = [];
  for (const [moenster, punkt] of REGLER) {
    if (new RegExp(moenster.source).test(t)) {
      funnet.push(punkt);
      t = t.replace(new RegExp(moenster.source, "g"), " ");
    }
  }
  if (/olje/.test(t) && (komponent === "motor" || komponent === "service")) funnet.push("motorolje");
  if (komponent === "motor" && funnet.length === 0) funnet.push("motorolje");
  // «Ekstra service» alene er bare en merkelapp, så det tas bare når ingen av de faste delene er funnet
  if (funnet.length === 0 && /ekstra service/.test(vask(tekst))) return ["ekstra-service"];
  return utvidDeler(funnet);
}

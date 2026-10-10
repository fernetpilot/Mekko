// Gjetter hvilket servicepunkt en vedlikeholdsregistrering gjelder, ut fra kategori og fritekst.
// Ren logikk. Brukes ved import og registrering, og som forslag på historikklinjer.

import { LR3_2_7_TDV6 } from "./servicepunkter.js";
import { SLITASJE_PUNKTER } from "./slitasje.js";

/** Alle servicepunkter som kan velges, med norsk navn. */
export function alleServicepunkter() {
  return [...LR3_2_7_TDV6, ...SLITASJE_PUNKTER].map((p) => ({ id: p.id, navn: p.navn }));
}

const vask = (s) => String(s ?? "").toLowerCase();

// Rekkefølgen betyr noe: det mest spesifikke først.
const REGLER = [
  [/bremsev[æa]ske/, "bremsevaeske"],
  [/kj[øo]lev[æa]ske/, "kjolevaeske"],
  [/servo/, "servostyring"],
  [/olje\s*-?\s*filter/, "oljefilter"],
  [/luft\s*-?\s*filter/, "luftfilter"],
  [/reim/, "registerreim"],
  [/klosse/, "bremseklosser"],
  [/overf[øo]ring|transfer/, "overforing"],
  [/manuell|manuelt gir/, "manuelt-gir"],
  [/automatgir|girolje|gir-?olje|\batf\b/, "automatgir"],
];

/**
 * @param {string} komponent  Kategori, f.eks. "bremser", "motor", "service"
 * @param {string} [tekst]    Fritekst fra notat eller type
 * @returns {string|null}     Id på servicepunkt, eller null hvis det ikke går å avgjøre
 */
export function gjettServicepunkt(komponent, tekst) {
  const t = vask(tekst);
  for (const [moenster, punkt] of REGLER) {
    if (moenster.test(t)) return punkt;
  }
  if (/olje/.test(t) && (komponent === "motor" || komponent === "service")) return "motorolje";
  if (komponent === "motor") return "motorolje";
  return null;
}

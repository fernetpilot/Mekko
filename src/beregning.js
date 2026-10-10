// Beregningslogikk for maks last på tilhenger.
// Ren funksjon: ingen DOM, ingen nettverk. Kan gjenbrukes i en app senere.
//
// Grenseverdiene for førerkort fylles inn fra regelverksdokumentet
// (kontrollert mot vegvesen.no). Ikke gjett på disse.

export const FORERKORT = {
  B: null,   // TODO: regler fra regelverksdokumentet
  B96: null, // TODO
  BE: null,  // TODO
};

/**
 * @param {object} bil     Vekter fra bilens vognkort (kg)
 * @param {object} henger  Vekter fra hengerens vognkort (kg)
 * @param {string} forerkort "B" | "B96" | "BE"
 * @returns {{ maksLast: number|null, begrensning: string, forklaring: string[] }}
 */
export function beregnMaksLast(bil, henger, forerkort) {
  // TODO: implementeres mot testcasene i tests/
  throw new Error("Ikke implementert ennå");
}

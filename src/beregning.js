// Beregningslogikk for maks last på tilhenger.
// Ren funksjon: ingen DOM, ingen nettverk. Kan gjenbrukes i en app senere.
//
// Kilde for førerkortreglene: Forskrift om førerkort m.m. (førerkortforskriften) kap. 3,
// §§ 3-5 (klasse B), 3-11 (klasse BE), lovdata.no. Ikke endre uten å sjekke kilden.
// Ikke kontrollert mot vegvesen.no ennå – gjøres før publisering.
//
// Alle vekter er i kg og er TILLATT totalvekt fra vognkortet, ikke faktisk vekt.

// Maks samlet tillatt totalvekt for vogntoget (bil + henger) for B og B96.
export const SAMLET_GRENSE_B = 3500;
export const SAMLET_GRENSE_B96 = 4250;

// Tilhengere opp til denne vekten kan føres med klasse B uten samlet grense.
export const TILHENGER_UTEN_SAMLET_GRENSE = 750;

// Klasse BE: tilhenger med tillatt totalvekt opp til denne grensen. Ingen samlet grense.
export const BE_TILHENGER_GRENSE = 3500;

export const FORERKORT = {
  B: {
    navn: "B",
    samletGrense: SAMLET_GRENSE_B,
    tilhengerUtenSamletGrense: TILHENGER_UTEN_SAMLET_GRENSE,
  },
  B96: {
    navn: "B96", // klasse B med fellesskapskode 96
    samletGrense: SAMLET_GRENSE_B96,
    tilhengerUtenSamletGrense: TILHENGER_UTEN_SAMLET_GRENSE,
  },
  BE: {
    navn: "BE",
    samletGrense: null, // ingen samlet grense
    tilhengerGrense: BE_TILHENGER_GRENSE,
  },
};

/**
 * Hvor tung tilhenger (tillatt totalvekt) førerkortet tillater for en gitt bil.
 *
 * B96 er klasse B med fellesskapskode 96, og gir samlet grense 4 250 kg.
 *
 * @param {"B"|"B96"|"BE"} forerkort
 * @param {number} bilTotalvekt  Bilens tillatte totalvekt (kg), fra vognkortet
 * @returns {number}  Maks tillatt totalvekt for hengeren (kg) etter førerkortets regler.
 */
export function forerkortMaksTilhenger(forerkort, bilTotalvekt) {
  if (forerkort === "BE") {
    return BE_TILHENGER_GRENSE;
  }
  if (forerkort === "B" || forerkort === "B96") {
    const samletGrense = forerkort === "B96" ? SAMLET_GRENSE_B96 : SAMLET_GRENSE_B;
    // Tilhenger opp til 750 kg er alltid tillatt. Over 750 kg må samlet vekt holde seg under grensen.
    return Math.max(TILHENGER_UTEN_SAMLET_GRENSE, samletGrense - bilTotalvekt);
  }
  throw new Error(`Ukjent førerkort: ${forerkort}`);
}

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

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

// Tilhengere med tillatt totalvekt opp til denne vekten kan føres med klasse B uten samlet grense.
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

// Vekt for en fører. Bilen regnes tom med fører. Brukes til kontroller av egenvekt med fører.
export const FORER_VEKT_KG = 80;

// Tilhengere med tillatt totalvekt opp til 750 kg kan trekkes uten brems.
const UTEN_BREMS_GRENSE = 750;

/**
 * Maks last på hengeren, og hvilken grense som begrenser den.
 *
 * For klasse B og B96 gjelder samlet grense når hengerens tillatte totalvekt er over 750 kg.
 * Da må bilens og hengerens tillatte totalvekt til sammen holde seg under grensen, og det
 * gjelder uansett hvor mye hengeren faktisk lastes. Ellers er maks last begrenset av
 * bilens tilhengervekt (med brems, eller uten brems hvis hengeren er 750 kg eller lettere),
 * av hengerens tillatte totalvekt, og for BE av 3 500 kg. Maks last er det hengeren kan
 * veie totalt, minus hengerens egenvekt.
 *
 * @param {object} bil     Vognkortverdier for bilen (kg):
 *                         tillattTotalvekt, tillattTilhengervektMedBrems, tillattTilhengervektUtenBrems
 * @param {object} henger  Vognkortverdier for hengeren (kg): tillattTotalvekt, egenvekt
 * @param {"B"|"B96"|"BE"} forerkort
 * @returns {{ maksLast: number|null, begrensning: "forerkort"|"bil"|"henger", forklaring: string[] }}
 *          maksLast er null hvis hengeren ikke kan trekkes med denne kombinasjonen.
 */
export function beregnMaksLast(bil, henger, forerkort, { medBrems = true } = {}) {
  if (!["B", "B96", "BE"].includes(forerkort)) {
    throw new Error(`Ukjent førerkort: ${forerkort}`);
  }

  // Bil som ikke er godkjent for tilhenger.
  if (bil.tillattTilhengervektMedBrems === 0) {
    return {
      maksLast: null,
      begrensning: "bil",
      forklaring: ["Bilen er ikke godkjent for å trekke tilhenger."],
    };
  }

  // Klasse B/B96: samlet grense gjelder når hengeren er over 750 kg.
  if (forerkort !== "BE") {
    const samletGrense = forerkort === "B96" ? SAMLET_GRENSE_B96 : SAMLET_GRENSE_B;
    if (
      henger.tillattTotalvekt > TILHENGER_UTEN_SAMLET_GRENSE &&
      bil.tillattTotalvekt + henger.tillattTotalvekt > samletGrense
    ) {
      return {
        maksLast: null,
        begrensning: "forerkort",
        forklaring: [
          `Med klasse ${forerkort} kan summen av bilens og hengerens tillatte totalvekt ikke overstige ${samletGrense} kg når hengeren er over 750 kg.`,
        ],
      };
    }
  }

  const grenser = {
    forerkort: forerkort === "BE" ? BE_TILHENGER_GRENSE : Infinity,
    bil: bil.tillattTilhengervektMedBrems,
    henger: henger.tillattTotalvekt,
  };

  // Laveste grense. Ved likhet vinner førerkort, så bil, så henger.
  let begrensning = "forerkort";
  for (const navn of ["bil", "henger"]) {
    if (grenser[navn] < grenser[begrensning]) begrensning = navn;
  }
  let maksTotal = grenser[begrensning];

  // Hengere på 750 kg eller lettere kan trekkes uten brems. Da gjelder bilens grense uten brems.
  if (maksTotal <= UTEN_BREMS_GRENSE && bil.tillattTilhengervektUtenBrems < maksTotal) {
    maksTotal = bil.tillattTilhengervektUtenBrems;
    begrensning = "bil";
  }

  // Hengeren uten brems kan veie høyst 750 kg totalt, og aldri mer enn bilens grense uten brems.
  if (!medBrems) {
    if (bil.tillattTilhengervektUtenBrems < UTEN_BREMS_GRENSE) {
      if (bil.tillattTilhengervektUtenBrems < maksTotal) {
        maksTotal = bil.tillattTilhengervektUtenBrems;
        begrensning = "bil";
      }
    } else if (UTEN_BREMS_GRENSE < maksTotal) {
      maksTotal = UTEN_BREMS_GRENSE;
      begrensning = "henger";
    }
  }

  const forklaring = [
    `Bilen: maks tilhengervekt ${bil.tillattTilhengervektMedBrems} kg med brems.`,
    `Hengeren: tillatt totalvekt ${henger.tillattTotalvekt} kg.`,
  ];

  const maksLast = maksTotal - henger.egenvekt;
  if (maksLast < 0) {
    forklaring.push(
      `Hengerens egenvekt (${henger.egenvekt} kg) er større enn ${maksTotal} kg, som er grensen for denne kombinasjonen.`
    );
    return { maksLast: null, begrensning, forklaring };
  }

  forklaring.push(
    `Begrenset av ${begrensning}: ${maksTotal} kg totalt, minus hengerens egenvekt ${henger.egenvekt} kg.`
  );
  return { maksLast, begrensning, forklaring };
}

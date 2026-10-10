// Beregning av maks last på tilhenger i Norge.
// Ren logikk: tall inn, resultat ut. Ingen DOM og ingen nettverkskall,
// slik at filen kan gjenbrukes i en app senere.
//
// Kilder:
// - Førerkortforskriften kap. 3 (Lovdata, utskrift 10.10.2026):
//   § 3-5 (klasse B, inkl. kode 96) og § 3-11 (klasse BE).
// - Bilens og hengerens vekter fra vognkortet (Vegvesenets API).
// Punkter merket «VERIFISER» skal bekreftes i regelverksdokumentet.

// ---------------------------------------------------------------------------
// Førerkortregler
// ---------------------------------------------------------------------------

/** Felles for B, B96 og BE: bilen må ha tillatt totalvekt på høyst 3500 kg (§ 3-5 første ledd nr. 1). */
export const MAKS_BIL_TOTALVEKT = 3500;

/** Lett tilhenger: tillatt totalvekt på høyst 750 kg (§ 3-5 nr. 2). */
export const LETT_HENGER_GRENSE = 750;

export const FORERKORT = {
  B: {
    navn: "B",
    // § 3-5 nr. 2 og 3: henger ≤ 750 kg, eller summen av tillatte totalvekter ≤ 3500 kg.
    maksSumTotalvekt: 3500,
    maksHengerTotalvekt: null,
    paragraf: "førerkortforskriften § 3-5 nr. 2 og 3",
  },
  B96: {
    navn: "B med kode 96",
    // § 3-5 nr. 4: henger over 750 kg når summen av tillatte totalvekter ≤ 4250 kg.
    maksSumTotalvekt: 4250,
    maksHengerTotalvekt: null,
    paragraf: "førerkortforskriften § 3-5 nr. 4",
  },
  BE: {
    navn: "BE",
    // § 3-11: henger med tillatt totalvekt høyst 3500 kg.
    maksSumTotalvekt: null,
    maksHengerTotalvekt: 3500,
    paragraf: "førerkortforskriften § 3-11",
  },
};

/**
 * Sjekker om førerkortet dekker kombinasjonen, basert på registrerte tillatte totalvekter.
 * Faktisk last spiller ingen rolle her.
 */
export function sjekkForerkort(bilTotalvekt, hengerTotalvekt, klasse) {
  const regel = FORERKORT[klasse];
  if (!regel) throw new Error(`Ukjent førerkortklasse: ${klasse}`);

  if (bilTotalvekt > MAKS_BIL_TOTALVEKT) {
    return {
      ok: false,
      maksHengerTotalvekt: 0,
      forklaring:
        `Bilen har tillatt totalvekt ${bilTotalvekt} kg. ` +
        `Med førerkort ${regel.navn} kan bilen ha høyst ${MAKS_BIL_TOTALVEKT} kg.`,
    };
  }

  // Høyeste tillatte totalvekt hengeren kan være registrert med for dette førerkortet.
  let maksHengerTotalvekt;
  if (regel.maksHengerTotalvekt !== null) {
    maksHengerTotalvekt = regel.maksHengerTotalvekt;
  } else {
    maksHengerTotalvekt = Math.max(LETT_HENGER_GRENSE, regel.maksSumTotalvekt - bilTotalvekt);
  }

  const ok = hengerTotalvekt <= maksHengerTotalvekt;
  let forklaring;
  if (regel.maksHengerTotalvekt !== null) {
    forklaring = ok
      ? `Med ${regel.navn} kan hengeren ha tillatt totalvekt opptil ${regel.maksHengerTotalvekt} kg. Hengeren er registrert med ${hengerTotalvekt} kg.`
      : `Med ${regel.navn} kan hengeren ha tillatt totalvekt høyst ${regel.maksHengerTotalvekt} kg, men hengeren er registrert med ${hengerTotalvekt} kg.`;
  } else if (hengerTotalvekt <= LETT_HENGER_GRENSE) {
    forklaring = `Hengeren har tillatt totalvekt ${hengerTotalvekt} kg (høyst ${LETT_HENGER_GRENSE} kg), og det dekkes av ${regel.navn}.`;
  } else {
    const sum = bilTotalvekt + hengerTotalvekt;
    forklaring = ok
      ? `Summen av tillatte totalvekter er ${sum} kg, innenfor grensen på ${regel.maksSumTotalvekt} kg for ${regel.navn}.`
      : `Summen av tillatte totalvekter er ${bilTotalvekt} + ${hengerTotalvekt} = ${sum} kg. ` +
        `Med ${regel.navn} kan summen være høyst ${regel.maksSumTotalvekt} kg.`;
  }

  return { ok, maksHengerTotalvekt, forklaring, paragraf: regel.paragraf };
}

/** Laveste førerkortklasse (av B, B96, BE) som dekker kombinasjonen, eller null. */
export function kreverForerkort(bilTotalvekt, hengerTotalvekt) {
  for (const klasse of ["B", "B96", "BE"]) {
    if (sjekkForerkort(bilTotalvekt, hengerTotalvekt, klasse).ok) return klasse;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hovedberegning
// ---------------------------------------------------------------------------

/**
 * Regner ut maks last på hengeren og hvilken grense som begrenser.
 *
 * @param {object} input
 * @param {object} input.bil     { tillattTotalvekt, egenvekt, tillattTilhengervektMedBrems,
 *                                 tillattTilhengervektUtenBrems, tillattVogntogvekt, tillattVertikalKoplingslast }
 * @param {object} input.henger  { tillattTotalvekt, egenvekt, tillattVertikalKoplingslast, harBrems }
 * @param {"B"|"B96"|"BE"} input.forerkort
 * @param {number} [input.bilFaktiskVekt] Bilens vekt med fører, passasjerer og last.
 *        Standard: bilens tillatte totalvekt (fullastet bil – det sikreste anslaget).
 */
export function beregnMaksLast({ bil, henger, forerkort, bilFaktiskVekt }) {
  const advarsler = [];
  const bilVekt = bilFaktiskVekt ?? bil.tillattTotalvekt;
  if (bilFaktiskVekt == null) {
    advarsler.push("Bilen er regnet som fullastet. Oppgi bilens faktiske vekt for et mer nøyaktig svar.");
  }

  // VERIFISER: hengere over 750 kg (O2) regnes som bremset når annet ikke er oppgitt.
  const harBrems = henger.harBrems ?? henger.tillattTotalvekt > LETT_HENGER_GRENSE;
  const bilTilhengervekt = harBrems
    ? bil.tillattTilhengervektMedBrems
    : bil.tillattTilhengervektUtenBrems;

  const grenser = [];

  // 1. Hengerens egen kapasitet
  grenser.push({
    id: "henger",
    navn: "Hengerens kapasitet",
    maksLast: henger.tillattTotalvekt - henger.egenvekt,
    forklaring: `Hengerens tillatte totalvekt ${henger.tillattTotalvekt} kg − egenvekt ${henger.egenvekt} kg.`,
  });

  // 2. Bilens tillatte tilhengervekt
  // VERIFISER: tillatt tilhengervekt gjelder hengerens faktiske vekt.
  if (bilTilhengervekt == null || bilTilhengervekt <= 0) {
    grenser.push({
      id: "bil",
      navn: "Bilens tilhengervekt",
      maksLast: 0,
      forklaring: "Bilen er ikke registrert for å trekke tilhenger" + (harBrems ? " med brems." : " uten brems."),
    });
  } else {
    grenser.push({
      id: "bil",
      navn: "Bilens tilhengervekt",
      maksLast: bilTilhengervekt - henger.egenvekt,
      forklaring:
        `Bilen kan trekke ${bilTilhengervekt} kg ${harBrems ? "med" : "uten"} brems − hengerens egenvekt ${henger.egenvekt} kg.`,
    });
  }

  // 3. Bilens tillatte vogntogvekt
  if (bil.tillattVogntogvekt) {
    grenser.push({
      id: "vogntog",
      navn: "Bilens vogntogvekt",
      maksLast: bil.tillattVogntogvekt - bilVekt - henger.egenvekt,
      forklaring:
        `Tillatt vogntogvekt ${bil.tillattVogntogvekt} kg − bilens vekt ${bilVekt} kg − hengerens egenvekt ${henger.egenvekt} kg.`,
    });
  }

  for (const g of grenser) g.maksLast = Math.max(0, g.maksLast);
  const strengeste = grenser.reduce((a, b) => (b.maksLast < a.maksLast ? b : a));

  // 4. Førerkort – avgjør om kombinasjonen i det hele tatt er lov
  const fk = sjekkForerkort(bil.tillattTotalvekt, henger.tillattTotalvekt, forerkort);
  const forerkortResultat = {
    klasse: forerkort,
    ok: fk.ok,
    forklaring: fk.forklaring,
    paragraf: fk.paragraf,
    maksHengerTotalvekt: fk.maksHengerTotalvekt,
    kreves: kreverForerkort(bil.tillattTotalvekt, henger.tillattTotalvekt),
  };

  // Kuletrykk: informasjon, ikke del av maks last.
  const kuletrykk = [bil.tillattVertikalKoplingslast, henger.tillattVertikalKoplingslast]
    .filter((v) => v > 0);

  return {
    lovlig: fk.ok,
    maksLast: fk.ok ? strengeste.maksLast : 0,
    begrensning: fk.ok ? strengeste.id : "forerkort",
    grenser,
    forerkort: forerkortResultat,
    maksKuletrykk: kuletrykk.length ? Math.min(...kuletrykk) : null,
    harBrems,
    advarsler,
  };
}

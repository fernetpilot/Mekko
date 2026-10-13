// Servicepunkter for Land Rover Discovery 3, 2.7 TDV6 276DT.
// Kilde: LR Time-tabell (tredjepart, versjon 12. okt 2023). Kopi med kilde ligger i
// docs/eksempeldata/servicekilder/lr3-2.7tdv6-lrtime.json. Kontroller mot servicebok før bruk.
// Regel: det som kommer først (km eller måned) gjelder.

// Foreløpig gjelder listen bare for Discovery 3 (2.7 TDV6 er ikke sjekket per bil ennå).
export function punkterFor(bil) {
  return /DISCOVERY 3/i.test(bil?.modell ?? "") ? LR3_2_7_TDV6 : [];
}

/**
 * Punkter som gjelder bilen: er ett girkassepunkt (automat/manuell) registrert, faller de
 * andre girtypene bort. Er ingen registrert, vet vi ikke girkassen, og alle blir med.
 * @param {Array} punkter
 * @param {Object<string, unknown>} siste  Siste utførte per punkt-id (se sisteUtfortPerPunkt)
 */
export function aktuellePunkter(punkter, siste = {}) {
  const kjent = punkter.find((p) => p.gjelderFor && siste[p.id])?.gjelderFor;
  return kjent ? punkter.filter((p) => !p.gjelderFor || p.gjelderFor === kjent) : punkter;
}

export const LR3_2_7_TDV6 = [
  { id: "motorolje", navn: "Motorolje", kmIntervall: 10000, manederIntervall: 12 },
  { id: "oljefilter", navn: "Oljefilter", kmIntervall: 10000, manederIntervall: 12 },
  { id: "overforing", navn: "Overføringskasse", kmIntervall: 25000, manederIntervall: 24 },
  { id: "automatgir", navn: "Automatgir (og filter)", kmIntervall: 80000, manederIntervall: 60, gjelderFor: "automat" },
  { id: "manuelt-gir", navn: "Manuelt gir", kmIntervall: 80000, manederIntervall: 60, gjelderFor: "manuell" },
  { id: "diff-foran", navn: "Differensial foran", kmIntervall: 25000, manederIntervall: 24 },
  { id: "diff-bak", navn: "Differensial bak", kmIntervall: 25000, manederIntervall: 24 },
  { id: "servostyring", navn: "Servoolje", kmIntervall: 80000, manederIntervall: 60 },
  { id: "kjolevaeske", navn: "Kjølevæske", kmIntervall: null, manederIntervall: 60 },
  { id: "bremsevaeske", navn: "Bremsevæske", kmIntervall: null, manederIntervall: 60 },
  // Ikke i LR Time-tabellen. Anders' erfaring: annethvert til hvert tredje oljeskift (20–30 000 km).
  // Vi bruker det strengeste: 20 000 km eller 24 måneder (to oljeskift).
  { id: "drivstoffilter-diesel", navn: "Drivstoffilter (diesel)", kmIntervall: 20000, manederIntervall: 24 },
];

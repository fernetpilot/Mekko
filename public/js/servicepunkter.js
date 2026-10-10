// Servicepunkter for Land Rover Discovery 3, 2.7 TDV6 276DT.
// Kilde: LR Time-tabell (tredjepart, versjon 12. okt 2023). Kopi med kilde ligger i
// docs/eksempeldata/servicekilder/lr3-2.7tdv6-lrtime.json. Kontroller mot servicebok før bruk.
// Regel: det som kommer først (km eller måned) gjelder.

export const LR3_2_7_TDV6 = [
  { id: "motorolje", navn: "Motorolje", kmIntervall: 10000, manederIntervall: 12 },
  { id: "oljefilter", navn: "Oljefilter", kmIntervall: 10000, manederIntervall: 12 },
  { id: "overforing", navn: "Overføringskasse", kmIntervall: 25000, manederIntervall: 24 },
  { id: "automatgir", navn: "Automatgir (og filter)", kmIntervall: 80000, manederIntervall: 60, gjelderFor: "automat" },
  { id: "manuelt-gir", navn: "Manuelt gir", kmIntervall: 80000, manederIntervall: 60, gjelderFor: "manuell" },
  { id: "diff-foran", navn: "Differensial foran", kmIntervall: 25000, manederIntervall: 24 },
  { id: "diff-bak", navn: "Differensial bak", kmIntervall: 25000, manederIntervall: 24 },
  { id: "servostyring", navn: "Servostyring", kmIntervall: 80000, manederIntervall: 60 },
  { id: "kjolevaeske", navn: "Kjølevæske", kmIntervall: null, manederIntervall: 60 },
  { id: "bremsevaeske", navn: "Bremsevæske", kmIntervall: null, manederIntervall: 60 },
];

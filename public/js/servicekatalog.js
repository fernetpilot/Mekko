// Katalog over servicepunkter: alt som kan registreres som gjort på et besøk, gruppert i kategorier.
// Ren data og logikk, ingen DOM. Godkjent av gruppen 12. okt 2026.
// Intervallene for de faste punktene ligger i servicepunkter.js og slitasje.js. Id-ene der brukes også her,
// så gamle registreringer beholder navnet sitt.
//
// gjelderFor: punktet vises bare for biler som passer (se passerBil). Uten gjelderFor vises det for alle.
// perPosisjon: punktet registreres per hjul, lagres som "<id>@<posisjon>", f.eks. "ovre-kuleledd@fv".

export const POSISJONER = [
  { id: "fv", navn: "foran venstre", kort: "FV" },
  { id: "fh", navn: "foran høyre", kort: "FH" },
  { id: "bv", navn: "bak venstre", kort: "BV" },
  { id: "bh", navn: "bak høyre", kort: "BH" },
];

const p = (id, navn, ekstra = {}) => ({ id, navn, ...ekstra });

export const KATALOG = [
  {
    id: "oljer", navn: "Oljer, væsker og filtre", ikon: "🛢️", gruppe: "olje",
    punkter: [
      p("motorolje", "Motorolje", { gjelderFor: ["forbrenningsmotor"] }),
      p("oljefilter", "Oljefilter", { gjelderFor: ["forbrenningsmotor"] }),
      p("drivstoffilter-diesel", "Drivstoffilter (diesel)", { gjelderFor: ["diesel"] }),
      p("drivstoffilter-bensin", "Drivstoffilter (bensin)", { gjelderFor: ["bensin"] }),
      p("luftfilter", "Luftfilter", { gjelderFor: ["forbrenningsmotor"] }),
      p("pollenfilter", "Pollenfilter / kupéfilter"),
      p("automatgir", "Automatgirolje", { gjelderFor: ["automat"] }),
      p("automatgirfilter", "Automatgirfilter", { gjelderFor: ["automat"] }),
      p("manuelt-gir", "Manuell girolje", { gjelderFor: ["manuell"] }),
      p("overforing", "Overføringskasseolje", { gjelderFor: ["4x4"] }),
      p("diff-foran", "Differensialolje foran", { gjelderFor: ["4x4"] }),
      p("diff-bak", "Differensialolje bak", { gjelderFor: ["bakhjulstrekk"] }),
      p("servostyring", "Servoolje"),
      p("kjolevaeske", "Kjølevæske"),
      p("bremsevaeske", "Bremsevæske"),
      p("spylervaeske", "Spylervæske"),
      p("ac-gass", "AC-gass (påfylling)"),
    ],
  },
  {
    id: "bremser", navn: "Bremser", ikon: "🛑", gruppe: "bremse",
    punkter: [
      p("bremseklosser", "Bremseklosser"),
      p("bremseskiver", "Bremseskiver"),
      p("bremsecaliper", "Bremsecaliper"),
      p("bremseslanger", "Bremseslanger"),
      p("bremseror", "Bremserør"),
      p("parkbrems", "Parkbrems (sko / wire / elektrisk)"),
      p("slitasjesensor-brems", "Slitasjesensor bremseklosser"),
      p("abs-sensor", "ABS-sensor"),
    ],
  },
  {
    id: "styring", navn: "Hjuloppheng og styring", ikon: "🔧", gruppe: "styring",
    punkter: [
      p("hjullager", "Hjullager / nav"),
      p("ytre-styreledd", "Ytre styreledd (endeledd)"),
      p("indre-styreledd", "Indre styreledd (aksialledd)"),
      p("styrestag", "Styrestag"),
      p("styresnekke", "Styresnekke (styrestativ)"),
      p("rattaksling", "Rattaksling øvre/nedre (inkl. kryssledd)"),
      p("rattstamme", "Rattstamme"),
      p("ovre-baerearm", "Øvre bærearm, komplett", { underkategori: "Bærearmer", perPosisjon: true }),
      p("nedre-baerearm", "Nedre bærearm, komplett", { underkategori: "Bærearmer", perPosisjon: true }),
      p("ovre-kuleledd", "Øvre kuleledd", { underkategori: "Bærearmer", perPosisjon: true }),
      p("nedre-kuleledd", "Nedre kuleledd", { underkategori: "Bærearmer", perPosisjon: true }),
      p("foring-ovre-fremre", "Fremre foring, øvre bærearm", { underkategori: "Bærearmer", perPosisjon: true }),
      p("foring-ovre-bakre", "Bakre foring, øvre bærearm", { underkategori: "Bærearmer", perPosisjon: true }),
      p("foring-nedre-fremre", "Fremre foring, nedre bærearm", { underkategori: "Bærearmer", perPosisjon: true }),
      p("foring-nedre-bakre", "Bakre foring, nedre bærearm", { underkategori: "Bærearmer", perPosisjon: true }),
      p("stabilisatorstag", "Stabilisatorstag"),
      p("stabilisatorforinger", "Stabilisatorforinger"),
      p("hjulstilling", "Hjulstilling"),
    ],
  },
  {
    id: "fjaering", navn: "Fjæring og demping", ikon: "🛞", gruppe: "fjaering",
    punkter: [
      p("stotdemper", "Støtdemper foran/bak"),
      p("spiralfjaer", "Spiralfjær"),
      p("toppfeste", "Toppfeste / fjærbeinslager"),
      p("luftfjaerbelg", "Luftfjærbelg / luftdemper", { gjelderFor: ["luftfjæring"] }),
      p("nivasensor", "Nivåsensor", { gjelderFor: ["luftfjæring"] }),
      p("luftkompressor", "Kompressor (luftfjæring)", { gjelderFor: ["luftfjæring"] }),
      p("lufttorker", "Lufttørker i kompressor", { gjelderFor: ["luftfjæring"] }),
      p("kompressorrele", "Kompressorrelé", { gjelderFor: ["luftfjæring"] }),
      p("lufttank", "Lufttank", { gjelderFor: ["luftfjæring"] }),
      p("ventilblokk", "Ventilblokk", { gjelderFor: ["luftfjæring"] }),
      p("luftror", "Luftrør og koblinger", { gjelderFor: ["luftfjæring"] }),
    ],
  },
  {
    id: "drivlinje", navn: "Drivlinje", ikon: "⚙️", gruppe: "drivlinje",
    punkter: [
      p("drivakselledd", "Drivakselledd"),
      p("drivakselmansjett", "Drivakselmansjett"),
      p("mellomaksel", "Mellomaksel-oppheng"),
      p("kardanaksel", "Kardanaksel og kardanknuter"),
      p("clutch", "Clutch og svinghjul", { gjelderFor: ["manuell"] }),
      p("girkassefester", "Girkassefester"),
      p("girkasse", "Girkasse / momentomformer (bytte, reparasjon)"),
      p("girvelger", "Girvelger og girkabel"),
    ],
  },
  {
    id: "motor", navn: "Motor", ikon: "🔩", gruppe: "motor",
    punkter: [
      p("registerreim", "Registerreim (inkl. strammer og styrehjul)", { gjelderFor: ["forbrenningsmotor"] }),
      p("hoytrykkspumpereim", "Reim til høytrykkspumpe", { gjelderFor: ["diesel"] }),
      p("registerkjede", "Registerkjede", { gjelderFor: ["forbrenningsmotor"] }),
      p("multireim", "Multireim (inkl. strammer)", { gjelderFor: ["forbrenningsmotor"] }),
      p("servopumpe", "Servopumpe"),
      p("vannpumpe", "Vannpumpe"),
      p("termostat", "Termostat"),
      p("oljepumpe", "Oljepumpe", { gjelderFor: ["forbrenningsmotor"] }),
      p("oljekjoler", "Oljekjøler", { gjelderFor: ["forbrenningsmotor"] }),
      p("kjoler", "Kjøler og intercooler"),
      p("kjolevifte", "Viftekobling / kjølevifte"),
      p("turbo", "Turbo", { gjelderFor: ["forbrenningsmotor"] }),
      p("gloeplugger", "Glødeplugger", { gjelderFor: ["diesel"] }),
      p("tennplugger", "Tennplugger", { gjelderFor: ["bensin"] }),
      p("coil", "Coil (tennspole)", { gjelderFor: ["bensin"] }),
      p("injektorer", "Dyser / injektorer", { gjelderFor: ["forbrenningsmotor"] }),
      p("sveivhusventilasjon", "Sveivhusventilasjon / oljeutskiller", { gjelderFor: ["forbrenningsmotor"] }),
      p("motorfester", "Motorfester"),
      p("ventildekselpakning", "Ventildekselpakning", { gjelderFor: ["forbrenningsmotor"] }),
    ],
  },
  {
    id: "avgass", navn: "Avgass og utslipp", ikon: "💨", gruppe: "avgass",
    punkter: [
      p("egr", "EGR-ventil / EGR-kjøler", { gjelderFor: ["forbrenningsmotor"] }),
      p("eksos", "Eksosanlegg / lyddemper", { gjelderFor: ["forbrenningsmotor"] }),
      p("katalysator", "Katalysator", { gjelderFor: ["forbrenningsmotor"] }),
      p("dpf", "Dieselpartikkelfilter (DPF)", { gjelderFor: ["diesel"] }),
      p("lambdasonde", "Lambdasonde", { gjelderFor: ["forbrenningsmotor"] }),
      p("adblue", "AdBlue-system", { gjelderFor: ["diesel"] }),
    ],
  },
  {
    id: "elektrisk", navn: "Elektrisk og lys", ikon: "🔋", gruppe: "elektrisk",
    punkter: [
      p("batteri", "Batteri"),
      p("dynamo", "Dynamo"),
      p("startmotor", "Startmotor"),
      p("lyspaerer", "Lyspærer foran/bak"),
      p("lyktjustering", "Lyktjustering"),
      p("sikringer", "Sikringer og releer"),
      p("hengerkontakt", "Tilhengerkontakt (elektrisk)"),
      p("motorvarmer", "Motorvarmer"),
    ],
  },
  {
    id: "dekk", navn: "Dekk og hjul", ikon: "🛞", gruppe: "dekk",
    punkter: [
      p("nye-dekk", "Nye dekk (sommer/vinter)"),
      p("dekkskift", "Dekkskift (sesong)"),
      p("hjulbalansering", "Hjulbalansering"),
      p("tpms", "Dekktrykksensor (TPMS)"),
      p("felger", "Felger"),
    ],
  },
  {
    id: "klima", navn: "Klima og kupé", ikon: "❄️", gruppe: "klima",
    punkter: [
      p("ac-service", "AC-service (gass, lekkasjesjekk)"),
      p("ac-kompressor", "AC-kompressor"),
      p("kupevifte", "Kupévifte"),
      p("varmeapparat", "Setevarme / varmeapparat"),
    ],
  },
  {
    id: "karosseri", navn: "Karosseri og understell", ikon: "🚗", gruppe: "karosseri",
    punkter: [
      p("rustbehandling", "Rustkontroll / understellsbehandling"),
      p("rustreparasjon", "Rustreparasjon / sveising (ramme, terskler)"),
      p("smoring-dorer", "Smøring av dørhengsler og låser"),
      p("avlop", "Avløp for soltak og vannkanaler"),
      p("hengerfeste", "Hengerfeste (mekanisk)"),
    ],
  },
  {
    id: "annet", navn: "Annet", ikon: "🧰", gruppe: "annet",
    punkter: [
      p("ekstra-service", "Ekstra service"),
      p("annet-arbeid", "Annet"),
    ],
  },
];

const PUNKT = new Map(KATALOG.flatMap((k) => k.punkter.map((pt) => [pt.id, { ...pt, kategori: k }])));

/** Deler en lagret id i punkt og posisjon: "ovre-kuleledd@fv" → { punktId, posisjon }. */
export function delId(id) {
  const [punktId, posisjon = null] = String(id).split("@");
  return { punktId, posisjon };
}

/** Punktet (med kategori) for en lagret id, eller null hvis id-en ikke finnes i katalogen. */
export function finnPunkt(id) {
  return PUNKT.get(delId(id).punktId) ?? null;
}

/** Lesbart navn, med posisjon hvis den finnes: «Øvre kuleledd (foran venstre)». */
export function punktNavn(id) {
  const { punktId, posisjon } = delId(id);
  const navn = PUNKT.get(punktId)?.navn ?? punktId;
  const pos = POSISJONER.find((x) => x.id === posisjon);
  return pos ? `${navn} (${pos.navn})` : navn;
}

/** Alle punkter i katalogen, flatt, i katalogens rekkefølge. */
export function allePunkter() {
  return [...PUNKT.values()];
}

/**
 * Passer punktet bilen? Egenskapene kommer fra bilEgenskaper() i kjoretoy.js.
 * Ukjent egenskap (null) gir ja, bortsett fra luftfjæring, som må være kjent.
 * Uten egenskaper (oppslaget feilet) vises alt.
 */
export function passerBil(punkt, egenskaper) {
  if (!egenskaper || !punkt?.gjelderFor) return true;
  const { drivstoff, drift, girkasse, luftfjaering } = egenskaper;
  return punkt.gjelderFor.every((krav) => {
    switch (krav) {
      case "forbrenningsmotor": return drivstoff !== "elektrisk";
      case "diesel": return drivstoff === null || drivstoff === "diesel";
      case "bensin": return drivstoff === null || drivstoff === "bensin";
      case "automat": return girkasse === null || girkasse === "automat";
      case "manuell": return girkasse === null || girkasse === "manuell";
      case "4x4": return drift === null || drift === "4x4";
      case "bakhjulstrekk": return drift === null || drift === "4x4" || drift === "bak";
      case "luftfjæring": return luftfjaering === true;
      default: return true;
    }
  });
}

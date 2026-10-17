// Land Rover Discovery 3 (2004–2009) og Discovery 4 (2009–2016). Samme karosseri (L319):
// kassete og loddrett, «stepped roof» over bakerste rad, sorte A-, B- og C-stolper så vinduene
// ser ut som ett glassbånd, lakkert D-stolpe, gjeller på framskjermen og reservehjulet under bilen.
// Forskjellene sitter foran og bak: Discovery 4 har LED-lys foran og bak, grill med to kraftige
// spiler, helt lakkert støtfanger og flere eiker i felgen.
// Mål fra databladet: lengde 4,84 m, bredde 1,92 m, høyde 1,88 m, akselavstand 2,885 m.
// Mer detaljert enn standardbilen, men samme stil: flate farger og skrå kanter (fas) i stedet for
// runde former, runde hjulbuer som mangekanter, skulderlinje og en kupé som smalner mot taket.

import * as THREE from 'three';

// Overheng foran ca. 0,86 m og bak ca. 1,09 m. Bilen er flyttet så hengerfestet havner der hengeren venter det.
const FORAKSEL = 1.53;
const BAKAKSEL = -1.355;
const FRONT = 2.24;          // fronten (uten støtfanger)
const BAK = -2.305;
const BREDDE = 1.9;

const felles = {
  hjulradius: 0.38,          // 255/55 R19
  hjulbredde: 0.255,
  foraksel: FORAKSEL,
  bakaksel: BAKAKSEL,
  sporvidde: 0.8,
  bredde: BREDDE,
  front: FRONT,
  bak: BAK,
  dekk: 'vei',
  bremse: { skala: 1.08, kaliper: 'flytende' },
  kupe: { bredde: 1.72, forskyv: [0, 0, 0.33] },
};

export const discovery3 = {
  ...felles,
  navn: 'Discovery 3',
  felg: { radius: 0.25, eiker: 7, eikebredde: 0.05 },
  karosseri: (ctx) => byggL319(ctx, false),
};

export const discovery4 = {
  ...felles,
  navn: 'Discovery 4',
  felg: { radius: 0.25, eiker: 10, eikebredde: 0.032 },
  karosseri: (ctx) => byggL319(ctx, true),
};

function byggL319({ karosseri, mat, boks, fboks, sideplate, rund }, d4) {
  const { solv, plast, glass, krom, titan, lykt, lyktglass, led, blinklys, baklykt, bakledd, motorrom, motorMat, oljeMat } = mat;
  const UNDER = 0.44;        // underkant av sidene mellom hjulene
  const BELTE = 1.13;        // der vinduene begynner
  const PANSER_FRONT = 1.07; // panseret faller litt mot fronten
  const MIDT_B = 1.28;       // innenfor hjulenes innerkant (0,8 − 0,128)
  const BUE_R = 0.48;        // hjulbuens radius (dekket er 0,38)
  const HENGSEL_Z = 0.97;    // panseret er hengslet ved frontruta
  const KUPE_B = 1.84;       // kupéens bredde ved beltelinjen
  const HELNING = 0.085;     // sideveggene heller innover mot taket (ca. 5°)
  const TAK_F = 1.79;        // takets underkant foran
  const TAK_B = 1.84;        // det hevede taket bak (over bakerste rad)
  const TRINN_Z = -0.92;     // der taket hever seg, ved C-stolpen
  const RUTE_FOT = { z: 0.93, y: BELTE };
  const RUTE_TOPP = { z: 0.48, y: TAK_F };
  const sideX = (BREDDE + MIDT_B) / 4;
  const sideB = (BREDDE - MIDT_B) / 2;
  const SIDE = BREDDE / 2;   // ytterflaten på siden
  const inn = (y) => (y - BELTE) * Math.tan(HELNING);              // hvor mye kupéen har smalnet ved høyden y
  const TAK_HALV = KUPE_B / 2 - inn(TAK_B + 0.07);                  // halv takbredde
  const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const motordeksel = std({ color: d4 ? 0x36383c : 0x222326, metalness: 0.3, roughness: 0.6 });
  const kjolevaske = std({ color: 0xd9d4c5, roughness: 0.55 });
  const skiltMat = std({ color: 0xf2f2ee, roughness: 0.5 });
  const euMat = std({ color: 0x1f3f9a, roughness: 0.5 });
  const merkeMat = std({ color: 0x174a2c, metalness: 0.5, roughness: 0.35 });
  const kledning = std({ color: 0x232427, metalness: 0.15, roughness: 0.7 });   // hjulbuer og terskler

  // ---------- Hjulbuer ----------
  // Runde buer tegnet som mangekant (lavpoly). Senter i hjulnavet, går ned til underkanten av karosseriet.
  const bueVinkel = (bunn) => Math.asin((bunn - 0.38) / BUE_R);
  // Punktene (z, y) over hjulet, bakfra og fram
  const buePunkter = (aksel, bunnBak, bunnFram, r = BUE_R, n = 11) => {
    const a1 = Math.PI - bueVinkel(bunnBak), a2 = bueVinkel(bunnFram);
    return Array.from({ length: n + 1 }, (_, i) => {
      const a = a1 + (a2 - a1) * (i / n);
      return [aksel + Math.cos(a) * r, 0.38 + Math.sin(a) * r];
    });
  };
  // Ring langs buen (mellom radius r1 og r2), brukt til kledningen utenpå og innerskjermen inni
  const bueRing = (aksel, bunnBak, bunnFram, r1, r2) => {
    const ytre = buePunkter(aksel, bunnBak, bunnFram, r2);
    const indre = buePunkter(aksel, bunnBak, bunnFram, r1).reverse();
    return [...ytre, ...indre];
  };

  // ---------- Nedre karosseri ----------
  // Midtpartiet er smalere enn sporvidden, så hjulene aldri går gjennom når bilen rister
  boks(MIDT_B, BELTE - UNDER, HENGSEL_Z - BAK, solv, 0, (BELTE + UNDER) / 2, (HENGSEL_Z + BAK) / 2);
  boks(MIDT_B, 0.32, FRONT - HENGSEL_Z, solv, 0, UNDER + 0.16, (FRONT + HENGSEL_Z) / 2);   // under motorrommet
  // Sidene: én plate per side i sideprofil, med hjulbuene skåret ut og skrå kanter (skulderlinjen)
  const profil = [
    [BAK, 0.52], ...buePunkter(BAKAKSEL, 0.52, UNDER),
    ...buePunkter(FORAKSEL, UNDER, 0.52), [FRONT, 0.52], [FRONT, PANSER_FRONT - 0.01], [HENGSEL_Z, BELTE], [BAK, BELTE],
  ];
  for (const s of [-1, 1]) {
    sideplate(profil, sideB, solv, s * sideX, [], karosseri, 0.025);
    for (const [aksel, bak, fram] of [[FORAKSEL, UNDER, 0.52], [BAKAKSEL, 0.52, UNDER]]) {
      // Kledning rundt buen (litt utenfor siden) og mørk innerskjerm
      sideplate(bueRing(aksel, bak - 0.03, fram - 0.03, BUE_R - 0.005, BUE_R + 0.075), 0.05, kledning, s * (SIDE + 0.012), [], karosseri, 0.012);
      sideplate(bueRing(aksel, bak, fram, BUE_R - 0.014, BUE_R - 0.002), sideB - 0.02, plast, s * sideX);
      sideplate([...buePunkter(aksel, bak, fram)], 0.01, plast, s * (MIDT_B / 2 + 0.012));
    }
    // Terskel i samme kledning mellom hjulbuene
    const tFra = BAKAKSEL + BUE_R + 0.03, tTil = FORAKSEL - BUE_R - 0.03;
    fboks(0.05, 0.12, tTil - tFra, kledning, s * (SIDE + 0.008), UNDER + 0.05, (tFra + tTil) / 2, 0.015);
    // Svak preglinje langs dørene, i høyde med håndtakene
    fboks(0.016, 0.03, tTil - tFra + 0.2, solv, s * (SIDE + 0.002), 0.99, (tFra + tTil) / 2, 0.008);
  }
  // Front- og bakplate i lakk over endene av sideplatene
  fboks(BREDDE - 0.02, PANSER_FRONT - 0.53, 0.05, solv, 0, (PANSER_FRONT + 0.52) / 2, FRONT + 0.002, 0.02);
  fboks(BREDDE - 0.02, BELTE - 0.53, 0.05, solv, 0, (BELTE + 0.52) / 2, BAK - 0.002, 0.02);

  // ---------- Motorrom ----------
  boks(MIDT_B - 0.02, 0.02, FRONT - HENGSEL_Z - 0.04, motorrom, 0, UNDER + 0.33, (FRONT + HENGSEL_Z) / 2);
  boks(MIDT_B - 0.02, BELTE - UNDER - 0.34, 0.04, motorrom, 0, (BELTE + UNDER + 0.32) / 2, HENGSEL_Z + 0.03);   // brannvegg
  for (const s of [-1, 1]) boks(0.01, 0.3, FRONT - HENGSEL_Z - 0.06, motorrom, s * (MIDT_B / 2 - 0.006), UNDER + 0.48, (FRONT + HENGSEL_Z) / 2);
  // V6-diesel på langs med stort plastdeksel. Oljelokket sitter oppå dekselet, oljefilterhuset foran.
  const motorZ = 1.62;
  boks(0.6, 0.16, 0.68, motorMat, 0, 0.88, motorZ);                                   // motorblokk
  fboks(0.74, 0.12, 0.7, motordeksel, 0, 1.0, motorZ, 0.04);                          // motordeksel
  for (const z of [-0.2, 0, 0.2]) boks(0.56, 0.015, 0.05, motordeksel, 0, 1.065, motorZ + z); // ribber
  if (d4) boks(0.3, 0.006, 0.08, titan, 0, 1.062, motorZ - 0.28);                    // merke på SDV6-dekselet
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), oljeMat);
  oljelokk.position.set(d4 ? -0.2 : 0.2, 1.08, motorZ + 0.22);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), oljeMat);
  oljefilter.position.set(-0.12, 0.98, motorZ + 0.4);
  karosseri.add(oljefilter);
  fboks(0.24, 0.18, 0.42, plast, -0.47, 0.96, 1.38, 0.03);                            // luftfilterboks
  fboks(0.18, 0.14, 0.22, kjolevaske, 0.48, 0.96, 1.26, 0.02);                        // ekspansjonstank
  boks(0.6, 0.04, 0.06, plast, 0, 0.98, FRONT - 0.12);                                // låsebjelke foran

  // ---------- Panser ----------
  // Bredt «clamshell»-panser over skjermene, med skrå kanter og en lav forhøyning i midten
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.005, HENGSEL_Z);
  karosseri.add(panser);
  const panserL = Math.hypot(FRONT - HENGSEL_Z, BELTE - PANSER_FRONT) + 0.03;
  fboks(BREDDE - 0.01, 0.06, panserL, solv, 0, 0, panserL / 2, 0.035, panser);
  fboks(BREDDE - 0.5, 0.025, panserL - 0.12, solv, 0, 0.035, panserL / 2 - 0.02, 0.02, panser);
  fboks(BREDDE - 0.01, 0.08, 0.04, solv, 0, -0.03, panserL - 0.02, 0.015, panser);   // forkanten bøyer ned
  const panserGrunn = Math.atan2(BELTE - PANSER_FRONT, FRONT - HENGSEL_Z);           // senker fronten

  // ---------- Kupé ----------
  // Taket: to nivåer med skrå kanter, soltak foran og alpine-glass i det hevede taket
  fboks(TAK_HALV * 2, 0.07, RUTE_TOPP.z + 0.06 - TRINN_Z, solv, 0, TAK_F + 0.035, (RUTE_TOPP.z + 0.06 + TRINN_Z - 0.02) / 2, 0.035);
  fboks(TAK_HALV * 2, 0.07, TRINN_Z - BAK + 0.01, solv, 0, TAK_B + 0.035, (TRINN_Z + BAK - 0.01) / 2, 0.035);
  boks(0.9, 0.006, 0.55, glass, 0, TAK_F + 0.071, -0.3);
  boks(1.1, 0.006, 0.42, glass, 0, TAK_B + 0.071, TRINN_Z - 0.4);
  // Takrails med føtter
  const RAIL_Y = TAK_B + 0.13;
  const railMat = d4 ? titan : plast;
  for (const s of [-1, 1]) {
    const rx = s * (TAK_HALV - 0.1);
    fboks(0.045, 0.035, RUTE_TOPP.z - 0.1 - BAK, railMat, rx, RAIL_Y, (RUTE_TOPP.z - 0.1 + BAK) / 2, 0.012);
    for (const [z, tak] of [[RUTE_TOPP.z - 0.15, TAK_F + 0.07], [TRINN_Z - 0.1, TAK_B + 0.07], [BAK + 0.12, TAK_B + 0.07]]) {
      fboks(0.05, RAIL_Y - tak + 0.01, 0.1, railMat, rx, (RAIL_Y + tak) / 2, z, 0.012);
    }
  }

  // Sideveggene ligger i en gruppe som heller innover fra beltelinjen. Høydene her er over beltet.
  const VF = 1.19;           // vinduenes underkant
  const VT = 1.74;           // overkant foran
  const VT_BAK = 1.79;       // bakre sidevindu følger det hevede taket
  const y0 = (pkt) => pkt.map(([z, y]) => [z, y - BELTE]);
  for (const s of [-1, 1]) {
    const vegg = new THREE.Group();
    vegg.position.y = BELTE;
    vegg.rotation.z = s * HELNING;
    karosseri.add(vegg);
    const ytre = s * (KUPE_B / 2 - 0.015);
    const vinduer = [
      [[0.06, VF], [aStolpeZ(VF) - 0.07, VF], [aStolpeZ(VT) - 0.07, VT], [0.06, VT]],   // fordør
      [[-0.86, VF], [-0.06, VF], [-0.06, VT], [-0.86, VT]],                             // bakdør
      [[BAK + 0.32, VF], [-0.98, VF], [-0.98, VT_BAK], [BAK + 0.32, VT_BAK]],           // bakre sidevindu
    ];
    sideplate(y0([[BAK, BELTE], [RUTE_FOT.z, BELTE], [RUTE_TOPP.z, TAK_F + 0.02], [TRINN_Z, TAK_F + 0.02], [TRINN_Z, TAK_B + 0.02], [BAK, TAK_B + 0.02]]),
      0.03, solv, ytre, vinduer.map(y0), vegg);
    const glassX = ytre + s * 0.02;
    for (const v of vinduer) sideplate(y0(v), 0.01, glass, glassX, [], vegg);
    // Sorte B- og C-stolper: vinduene blir ett mørkt bånd, D-stolpen er lakkert
    boks(0.012, VT - VF + 0.02, 0.13, plast, glassX, (VT + VF) / 2 - BELTE, 0, vegg);
    boks(0.012, VT_BAK - VF + 0.02, 0.14, plast, glassX, (VT_BAK + VF) / 2 - BELTE, -0.92, vegg);
    // A-stolpe (sort), skrå langs frontruta
    const aLengde = Math.hypot(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
    fboks(0.07, aLengde + 0.04, 0.08, plast, ytre - s * 0.01, (RUTE_TOPP.y - RUTE_FOT.y) / 2, (RUTE_FOT.z + RUTE_TOPP.z) / 2, 0.015, vegg)
      .rotation.x = -Math.atan2(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
    // Sort tetningslist langs vinduenes underkant
    boks(0.02, 0.015, aStolpeZ(VF) - 0.07 - BAK - 0.32, plast, ytre + s * 0.012, VF - BELTE - 0.012, (BAK + 0.32 + aStolpeZ(VF) - 0.07) / 2, vegg);
    // Bakre lys går rundt hjørnet på D-stolpen
    boks(0.012, 0.5, 0.1, baklykt, ytre + s * 0.018, 1.45 - BELTE, BAK + 0.04, vegg);
    // Speil: sort hus på en fot ved A-stolpen (Discovery 4: blinklys i speilet)
    fboks(0.12, 0.05, 0.1, plast, s * (SIDE + 0.03), 1.19, 0.82, 0.015);
    fboks(0.24, 0.16, 0.1, d4 ? solv : plast, s * (SIDE + 0.15), 1.25, 0.8, 0.03);
    boks(0.2, 0.13, 0.012, glass, s * (SIDE + 0.15), 1.25, 0.745);
    if (d4) boks(0.17, 0.014, 0.012, blinklys, s * (SIDE + 0.16), 1.185, 0.851);
  }
  // Frontrute: trapes som smalner mot taket, lagt skrått mellom foten og toppen
  const ruteDz = RUTE_TOPP.z - RUTE_FOT.z, ruteDy = RUTE_TOPP.y - RUTE_FOT.y;
  const ruteL = Math.hypot(ruteDz, ruteDy);
  const bunnB = KUPE_B / 2 - 0.06, toppB = KUPE_B / 2 - inn(RUTE_TOPP.y) - 0.06;
  const ruteForm = new THREE.Shape([[-bunnB, 0], [bunnB, 0], [toppB, ruteL], [-toppB, ruteL]].map(([x, y]) => new THREE.Vector2(x, y)));
  const rute = new THREE.Mesh(new THREE.ExtrudeGeometry(ruteForm, { depth: 0.015, bevelEnabled: false }), glass);
  rute.position.set(0, RUTE_FOT.y, RUTE_FOT.z - 0.02);
  rute.rotation.x = Math.atan2(ruteDz, ruteDy);       // formens y peker opp langs ruta, bakover
  karosseri.add(rute);
  // Viskere i hvilestilling
  for (const x of [-0.35, 0.25]) fboks(0.5, 0.012, 0.02, plast, x, BELTE + 0.035, RUTE_FOT.z - 0.03, 0.004).rotation.z = 0.06;

  // ---------- Sidedetaljer ----------
  for (const s of [-1, 1]) {
    const x = s * (SIDE + 0.004);
    // Gjelle på framskjermen bak hjulbuen: tre spiler på Discovery 3, to brede på Discovery 4
    const ventZ = FORAKSEL - BUE_R - 0.06;
    fboks(0.012, 0.11, 0.16, plast, x, 0.99, ventZ, 0.004);
    const spiler = d4 ? [0.965, 1.015] : [0.96, 0.99, 1.02];
    for (const y of spiler) fboks(0.014, d4 ? 0.02 : 0.012, 0.15, titan, x + s * 0.004, y, ventZ, 0.004);
    // Dørfuger og dørhåndtak
    for (const [z, fra] of [[aStolpeZ(BELTE) - 0.01, 0.5], [0, 0.5], [-0.92, 0.88]]) boks(0.004, BELTE - fra, 0.006, plast, x + s * 0.002, (BELTE + fra) / 2, z);
    for (const z of [0.25, -0.65]) fboks(0.018, 0.035, 0.16, d4 ? solv : titan, x + s * 0.008, 1.05, z, 0.008);
  }

  // ---------- Front ----------
  const FF = FRONT + 0.027;                    // frontplatens ytterflate
  // Støtfanger: lakkert øverst, mørk underdel med luftinntak (Discovery 4: lakkert helt ned)
  fboks(BREDDE + 0.02, 0.24, 0.16, solv, 0, 0.7, FRONT + 0.08, 0.05);
  fboks(BREDDE - 0.06, 0.16, 0.15, d4 ? solv : kledning, 0, 0.52, FRONT + 0.07, 0.04);
  const STF = FRONT + 0.16;                    // støtfangerens ytterflate
  fboks(d4 ? 1.1 : 0.9, d4 ? 0.12 : 0.09, 0.02, plast, 0, d4 ? 0.56 : 0.53, STF - 0.01, 0.02);   // luftinntak
  if (!d4) fboks(1.1, 0.012, 0.02, solv, 0, 0.6, STF - 0.004, 0.004);                     // skillelinje
  for (const s of [-1, 1]) {
    fboks(0.15, 0.13, 0.03, plast, s * 0.72, 0.6, STF - 0.012, 0.03);                      // tåkelysramme
    rund(0.045, 0.012, krom, s * 0.72, 0.6, STF + 0.003, karosseri, 12);
    rund(0.036, 0.012, lykt, s * 0.72, 0.6, STF + 0.008, karosseri, 12);
  }
  fboks(0.08, 0.05, 0.02, solv, -0.45, 0.7, STF + 0.002, 0.01);                           // deksel for slepekrok
  // Grill: mørkt nett med to spiler. Discovery 3: tynne spiler i en ramme, Discovery 4: kraftige spiler.
  const GY = 0.945;                            // grillens midte
  fboks(0.82, 0.22, 0.04, plast, 0, GY, FF, 0.02);
  for (let i = -6; i <= 6; i++) boks(0.006, 0.2, 0.01, kledning, i * 0.06, GY, FF + 0.022);   // nettet
  if (!d4) fboks(0.84, 0.23, 0.03, titan, 0, GY, FF - 0.003, 0.012);                       // ramme rundt grillen
  for (const y of d4 ? [GY + 0.045, GY - 0.045] : [GY + 0.04, GY - 0.03]) fboks(0.8, d4 ? 0.05 : 0.03, 0.04, titan, 0, y, FF + 0.02, 0.012);
  const merke = rund(0.035, 0.014, merkeMat, 0, GY + 0.04, FF + 0.044, karosseri, 16);      // det grønne Land Rover-merket
  merke.scale.x = 2;
  // Lykter: store, firkantede, går rundt hjørnet. To runde linser med kromring, blinklys ytterst.
  for (const s of [-1, 1]) {
    const lx = s * 0.71;
    const ly = 0.95;
    fboks(0.44, 0.21, 0.04, lyktglass, lx, ly, FF + 0.002, 0.015);
    fboks(0.03, 0.19, 0.2, lyktglass, s * (SIDE - 0.005), ly, FRONT - 0.06, 0.012);         // lykta går rundt hjørnet
    for (const dx of [-0.07, 0.08]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 16), krom);
      ring.position.set(lx - s * dx, ly + 0.015, FF + 0.026);
      karosseri.add(ring);
      rund(0.048, 0.01, lykt, lx - s * dx, ly + 0.015, FF + 0.024, karosseri, 16);
    }
    if (d4) {
      // LED-kontur under linsene og opp på utsiden
      boks(0.38, 0.012, 0.01, led, lx, ly - 0.075, FF + 0.025);
      boks(0.012, 0.13, 0.01, led, lx + s * 0.2, ly - 0.015, FF + 0.025);
      fboks(0.018, 0.05, 0.12, blinklys, s * (SIDE + 0.006), ly - 0.03, FRONT - 0.06, 0.006);
    } else {
      fboks(0.07, 0.17, 0.012, blinklys, lx + s * 0.18, ly, FF + 0.024, 0.005);
      fboks(0.018, 0.16, 0.12, blinklys, s * (SIDE + 0.006), ly, FRONT - 0.06, 0.006);
    }
  }

  // ---------- Bak ----------
  const BF = BAK - 0.027;                      // bakplatens ytterflate
  // Øvre del av bakluka: trapes som følger sideveggene innover mot taket
  const lukeH = TAK_B + 0.02 - BELTE;
  const lukeB = KUPE_B / 2, lukeT = KUPE_B / 2 - inn(TAK_B + 0.02);
  const lukeForm = new THREE.Shape([[-lukeB, 0], [lukeB, 0], [lukeT, lukeH], [-lukeT, lukeH]].map(([x, y]) => new THREE.Vector2(x, y)));
  const luke = new THREE.Mesh(new THREE.ExtrudeGeometry(lukeForm, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelOffset: -0.015, bevelSegments: 1 }), solv);
  luke.position.set(0, BELTE, BAK - 0.012);
  luke.castShadow = true;
  karosseri.add(luke);
  fboks(KUPE_B - 0.56, 0.4, 0.02, glass, 0, 1.55, BF - 0.012, 0.01);                   // bakrute
  fboks(KUPE_B - 0.5, 0.012, 0.02, plast, 0, 1.31, BF - 0.012, 0.004);                  // delt bakluke
  fboks(0.6, 0.16, 0.02, plast, 0, 0.98, BF - 0.006, 0.02);                            // skiltnisje
  boks(0.52, 0.11, 0.008, skiltMat, 0, 0.98, BF - 0.018);
  boks(0.045, 0.11, 0.009, euMat, -0.237, 0.98, BF - 0.019);                          // blått felt til venstre (sett bakfra)
  fboks(0.12, 0.03, 0.02, titan, 0, 1.1, BF - 0.008, 0.006);                          // håndtak over skiltet
  if (d4) fboks(0.7, 0.024, 0.02, titan, 0, 1.075, BF - 0.006, 0.006);                 // pyntelist over skiltet
  for (const s of [-1, 1]) {
    const lx = s * 0.8;
    if (d4) {
      // LED-baklys: mørkt rødt glass med en søyle av runde lys
      fboks(0.13, 0.72, 0.04, baklykt, lx, 1.37, BF, 0.015);
      for (let i = 0; i < 5; i++) rund(0.022, 0.01, bakledd, lx, 1.62 - i * 0.11, BF - 0.02, karosseri, 12);
      boks(0.012, 0.6, 0.012, bakledd, lx + s * 0.055, 1.37, BF - 0.02);
    } else {
      // Høye baklys: rødt øverst, blinklys og ryggelys under
      fboks(0.13, 0.42, 0.04, baklykt, lx, 1.52, BF, 0.015);
      fboks(0.13, 0.13, 0.04, blinklys, lx, 1.245, BF, 0.015);
      fboks(0.13, 0.16, 0.04, lyktglass, lx, 1.1, BF, 0.015);
    }
  }
  // Støtfanger med sort trinn oppå og plass til hengerfestet under
  fboks(BREDDE + 0.02, 0.3, 0.15, solv, 0, 0.65, BAK - 0.075, 0.05);
  fboks(1.5, 0.02, 0.12, plast, 0, 0.805, BAK - 0.08, 0.006);
  if (!d4) fboks(BREDDE - 0.2, 0.06, 0.155, kledning, 0, 0.52, BAK - 0.07, 0.02);
  for (const s of [-1, 1]) boks(0.12, 0.03, 0.01, baklykt, s * 0.78, 0.66, BAK - 0.153);  // reflekser

  return { panser, oljelokk, panserGrunn };
}

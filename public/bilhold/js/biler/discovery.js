// Land Rover Discovery 3 (2004–2009) og Discovery 4 (2009–2016). Samme karosseri (L319):
// kassete og loddrett, «stepped roof» over bakerste rad, sorte A-, B- og C-stolper så vinduene
// ser ut som ett glassbånd, lakkert D-stolpe, gjeller på framskjermen og reservehjulet under bilen.
// Forskjellene sitter foran og bak: Discovery 4 har LED-lys foran og bak, grill med to kraftige
// spiler, helt lakkert støtfanger og flere eiker i felgen.
// Mål fra databladet: lengde 4,84 m, bredde 1,92 m, høyde 1,88 m, akselavstand 2,885 m.
// Forenklet realisme med skarpe, enkle linjer, som standardbilen (standard.js).

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
  bremse: { skala: 1.08, kaliper: 'flytende' },
  kupe: { bredde: 1.84, forskyv: [0, 0, 0.33] },
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

function byggL319({ karosseri, mat, boks, sideplate, rund }, d4) {
  const { solv, plast, glass, titan, lykt, lyktglass, led, blinklys, baklykt, bakledd, motorrom, motorMat, oljeMat } = mat;
  const UNDER = 0.44;        // underkant av sidene mellom hjulene
  const BELTE = 1.13;        // der vinduene begynner
  const PANSER_FRONT = 1.07; // panseret faller litt mot fronten
  const MIDT_B = 1.28;       // innenfor hjulenes innerkant (0,8 − 0,128)
  const BUE_TOPP = 0.88;     // dekket rekker opp til 0,76
  const BUE_HALV = 0.5;
  const HENGSEL_Z = 0.97;     // panseret er hengslet ved frontruta
  const KUPE_B = 1.84;
  const TAK_F = 1.79;        // takets underkant foran
  const TAK_B = 1.84;        // det hevede taket bak (over bakerste rad)
  const TRINN_Z = -0.92;     // der taket hever seg, ved C-stolpen
  const RUTE_FOT = { z: 0.93, y: BELTE };
  const RUTE_TOPP = { z: 0.48, y: TAK_F };
  const fremreBue = [FORAKSEL - BUE_HALV, FORAKSEL + BUE_HALV];
  const bakreBue = [BAKAKSEL - BUE_HALV, BAKAKSEL + BUE_HALV];
  const sideX = (BREDDE + MIDT_B) / 4;
  const sideB = (BREDDE - MIDT_B) / 2;
  const SIDE = BREDDE / 2;   // ytterflaten på siden
  const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);
  const panserY = (z) => BELTE + (PANSER_FRONT - BELTE) * (z - HENGSEL_Z) / (FRONT - HENGSEL_Z);
  const motordeksel = new THREE.MeshStandardMaterial({ color: d4 ? 0x36383c : 0x222326, metalness: 0.3, roughness: 0.6 });
  const kjolevaske = new THREE.MeshStandardMaterial({ color: 0xd9d4c5, roughness: 0.55 });
  const skiltMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
  const euMat = new THREE.MeshStandardMaterial({ color: 0x1f3f9a, roughness: 0.5 });
  const merkeMat = new THREE.MeshStandardMaterial({ color: 0x174a2c, metalness: 0.5, roughness: 0.35 });

  // Hjulbueåpning (z, y): rett opp, skrå hjørner og flat topp, som på L319
  const bue = ([a, b], bunn) => [[a, bunn], [a, 0.7], [a + 0.1, BUE_TOPP], [b - 0.1, BUE_TOPP], [b, 0.7], [b, bunn]];

  // ---------- Nedre karosseri ----------
  // Midtpartiet er smalere enn sporvidden, så hjulene aldri går gjennom når bilen rister
  boks(MIDT_B, BELTE - UNDER, HENGSEL_Z - BAK, solv, 0, (BELTE + UNDER) / 2, (HENGSEL_Z + BAK) / 2);
  boks(MIDT_B, 0.32, FRONT - HENGSEL_Z, solv, 0, UNDER + 0.16, (FRONT + HENGSEL_Z) / 2);   // under motorrommet
  // Sidene: én plate per side i sideprofil med hjulbuene skåret ut. Kantene er mørke
  // (innsiden av hjulbuene og listen langs beltelinjen), flatene lakkert.
  const profil = [
    [BAK, 0.52], ...bue(bakreBue, 0.52).slice(0, -1), [bakreBue[1], UNDER],
    [fremreBue[0], UNDER], ...bue(fremreBue, 0.52).slice(1, -1), [fremreBue[1], 0.52],
    [FRONT, 0.52], [FRONT, PANSER_FRONT - 0.01], [HENGSEL_Z, BELTE], [BAK, BELTE],
  ];
  for (const s of [-1, 1]) {
    sideplate(profil, sideB, [solv, plast], s * sideX);
    // Mørk innerskjerm i hjulbuene, litt utenfor midtpartiet så flatene ikke flimrer
    for (const b of [fremreBue, bakreBue]) sideplate(bue(b, UNDER - 0.01), 0.01, plast, s * (MIDT_B / 2 + 0.012));
  }
  // Front- og bakplate i lakk over endene av sideplatene
  boks(BREDDE - 0.02, PANSER_FRONT - 0.53, 0.03, solv, 0, (PANSER_FRONT + 0.52) / 2, FRONT + 0.012);
  boks(BREDDE - 0.02, BELTE - 0.53, 0.03, solv, 0, (BELTE + 0.52) / 2, BAK - 0.012);

  // ---------- Motorrom ----------
  boks(MIDT_B - 0.02, 0.02, FRONT - HENGSEL_Z - 0.04, motorrom, 0, UNDER + 0.33, (FRONT + HENGSEL_Z) / 2);
  boks(MIDT_B - 0.02, BELTE - UNDER - 0.34, 0.04, motorrom, 0, (BELTE + UNDER + 0.32) / 2, HENGSEL_Z + 0.03);   // brannvegg
  for (const s of [-1, 1]) boks(0.01, 0.3, FRONT - HENGSEL_Z - 0.06, motorrom, s * (MIDT_B / 2 - 0.006), UNDER + 0.48, (FRONT + HENGSEL_Z) / 2);
  // V6-diesel på langs med stort plastdeksel. Oljelokket sitter oppå dekselet, oljefilterhuset foran.
  const motorZ = 1.62;
  boks(0.6, 0.16, 0.68, motorMat, 0, 0.88, motorZ);                                   // motorblokk
  boks(0.74, 0.12, 0.7, motordeksel, 0, 1.0, motorZ);                                 // motordeksel
  for (const z of [-0.2, 0, 0.2]) boks(0.6, 0.015, 0.05, motordeksel, 0, 1.065, motorZ + z); // ribber
  if (d4) boks(0.3, 0.006, 0.08, titan, 0, 1.062, motorZ - 0.28);                    // merke på SDV6-dekselet
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), oljeMat);
  oljelokk.position.set(d4 ? -0.2 : 0.2, 1.08, motorZ + 0.22);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), oljeMat);
  oljefilter.position.set(-0.12, 0.98, motorZ + 0.4);
  karosseri.add(oljefilter);
  boks(0.24, 0.18, 0.42, plast, -0.47, 0.96, 1.38);                                    // luftfilterboks
  boks(0.18, 0.14, 0.22, kjolevaske, 0.48, 0.96, 1.26);                               // ekspansjonstank
  boks(0.6, 0.04, 0.06, plast, 0, 0.98, FRONT - 0.12);                                // låsebjelke foran

  // ---------- Panser ----------
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.005, HENGSEL_Z);
  karosseri.add(panser);
  const panserL = Math.hypot(FRONT - HENGSEL_Z, BELTE - PANSER_FRONT) + 0.02;
  boks(BREDDE - 0.02, 0.045, panserL, solv, 0, 0, panserL / 2, panser);
  boks(BREDDE - 0.02, 0.07, 0.03, solv, 0, -0.02, panserL - 0.015, panser);         // forkanten bøyer ned
  const panserGrunn = Math.atan2(BELTE - PANSER_FRONT, FRONT - HENGSEL_Z);           // senker fronten

  // ---------- Kupé ----------
  boks(KUPE_B, 0.07, RUTE_TOPP.z + 0.04 - TRINN_Z, solv, 0, TAK_F + 0.035, (RUTE_TOPP.z + 0.04 + TRINN_Z - 0.02) / 2); // tak foran
  boks(KUPE_B, 0.07, TRINN_Z - BAK, solv, 0, TAK_B + 0.035, (TRINN_Z + BAK) / 2);       // hevet tak bak
  // Soltak foran og alpine-glass i det hevede taket
  boks(0.9, 0.006, 0.55, glass, 0, TAK_F + 0.072, -0.35);
  boks(1.1, 0.006, 0.42, glass, 0, TAK_B + 0.072, TRINN_Z - 0.4);
  // Takrails med føtter
  const RAIL_Y = TAK_B + 0.13;
  const railMat = d4 ? titan : plast;
  for (const s of [-1, 1]) {
    boks(0.04, 0.035, RUTE_TOPP.z - 0.1 - BAK, railMat, s * 0.76, RAIL_Y, (RUTE_TOPP.z - 0.1 + BAK) / 2);
    for (const [z, tak] of [[RUTE_TOPP.z - 0.15, TAK_F + 0.07], [TRINN_Z - 0.1, TAK_B + 0.07], [BAK + 0.12, TAK_B + 0.07]]) {
      boks(0.05, RAIL_Y - tak, 0.09, railMat, s * 0.76, (RAIL_Y + tak) / 2, z);
    }
  }

  const VF = 1.19;           // vinduenes underkant
  const VT = 1.74;           // overkant foran
  const VT_BAK = 1.79;       // bakre sidevindu følger det hevede taket
  for (const s of [-1, 1]) {
    const ytre = s * (KUPE_B / 2 - 0.015);
    const vinduer = [
      [[0.06, VF], [aStolpeZ(VF) - 0.07, VF], [aStolpeZ(VT) - 0.07, VT], [0.06, VT]],   // fordør
      [[-0.86, VF], [-0.06, VF], [-0.06, VT], [-0.86, VT]],                             // bakdør
      [[BAK + 0.32, VF], [-0.98, VF], [-0.98, VT_BAK], [BAK + 0.32, VT_BAK]],           // bakre sidevindu
    ];
    // Sidevegg fra beltelinjen til taket, med hull der vinduene er (så man ser inn når glasset blir klart)
    sideplate([[BAK, BELTE], [RUTE_FOT.z, BELTE], [RUTE_TOPP.z, TAK_F + 0.01], [TRINN_Z, TAK_F + 0.01], [TRINN_Z, TAK_B + 0.01], [BAK, TAK_B + 0.01]],
      0.03, solv, ytre, vinduer);
    const glassX = ytre + s * 0.02;
    for (const v of vinduer) sideplate(v, 0.01, glass, glassX);
    // Sorte B- og C-stolper: vinduene blir ett mørkt bånd, D-stolpen er lakkert
    boks(0.012, VT - VF + 0.02, 0.13, plast, glassX, (VT + VF) / 2, 0);
    boks(0.012, VT_BAK - VF + 0.02, 0.14, plast, glassX, (VT_BAK + VF) / 2, -0.92);
    // Speil med lakkert deksel (Discovery 4: blinklys i speilet)
    boks(0.1, 0.05, 0.08, plast, s * (SIDE + 0.03), 1.19, 0.8);
    boks(0.22, 0.15, 0.09, solv, s * (SIDE + 0.13), 1.24, 0.79);
    boks(0.2, 0.13, 0.012, glass, s * (SIDE + 0.13), 1.24, 0.739);
    if (d4) boks(0.16, 0.014, 0.012, blinklys, s * (SIDE + 0.15), 1.175, 0.836);
  }
  // Frontrute og A-stolper (sorte)
  const ruteVinkel = Math.atan2(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
  const ruteLengde = Math.hypot(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
  const ruteMidt = [(RUTE_FOT.y + RUTE_TOPP.y) / 2, (RUTE_FOT.z + RUTE_TOPP.z) / 2];
  boks(KUPE_B - 0.08, ruteLengde, 0.02, glass, 0, ruteMidt[0], ruteMidt[1]).rotation.x = -ruteVinkel;
  for (const s of [-1, 1]) {
    boks(0.07, ruteLengde + 0.04, 0.07, plast, s * (KUPE_B / 2 - 0.025), ruteMidt[0], ruteMidt[1]).rotation.x = -ruteVinkel;
  }

  // ---------- Sidedetaljer ----------
  for (const s of [-1, 1]) {
    const x = s * (SIDE + 0.004);
    // Gjelle på framskjermen bak hjulbuen: tre spiler på Discovery 3, to brede på Discovery 4
    const ventZ = fremreBue[0] - 0.02;
    boks(0.008, 0.1, 0.12, plast, x, 0.99, ventZ);
    const spiler = d4 ? [0.965, 1.015] : [0.96, 0.99, 1.02];
    for (const y of spiler) boks(0.012, d4 ? 0.02 : 0.012, 0.12, titan, x + s * 0.004, y, ventZ);
    // Dørfuger og dørhåndtak
    for (const [z, fra] of [[aStolpeZ(BELTE) - 0.01, 0.5], [0, 0.48], [-0.92, BUE_TOPP + 0.02]]) boks(0.004, BELTE - fra, 0.006, plast, x, (BELTE + fra) / 2, z);
    for (const z of [0.25, -0.65]) boks(0.014, 0.035, 0.15, solv, x + s * 0.006, 1.04, z);
    // Sort list langs dørterskelen
    boks(0.02, 0.07, fremreBue[0] - bakreBue[1] - 0.04, plast, s * (SIDE + 0.008), UNDER + 0.04, (fremreBue[0] + bakreBue[1]) / 2);
  }

  // ---------- Front ----------
  const FF = FRONT + 0.027;                    // frontplatens ytterflate
  // Støtfanger: Discovery 3 har sort underdel, Discovery 4 er lakkert helt ned
  boks(BREDDE + 0.02, 0.27, 0.15, solv, 0, 0.68, FRONT + 0.075);
  boks(BREDDE - 0.12, 0.08, 0.13, d4 ? solv : plast, 0, 0.51, FRONT + 0.055);
  const STF = FRONT + 0.151;                   // støtfangerens ytterflate
  boks(d4 ? 1.1 : 0.96, d4 ? 0.13 : 0.11, 0.01, plast, 0, 0.62, STF);              // luftinntak
  for (const s of [-1, 1]) {
    boks(d4 ? 0.15 : 0.12, d4 ? 0.13 : 0.11, 0.012, plast, s * 0.72, 0.62, STF);    // tåkelysramme
    rund(0.04, 0.012, lykt, s * 0.72, 0.62, STF + 0.006);
  }
  // Grill: mørkt nett med to spiler (Discovery 3: tynne spiler i en ramme, Discovery 4: kraftige spiler)
  const GY = 0.945;                            // grillens midte
  boks(0.8, 0.21, 0.02, plast, 0, GY, FF);
  if (!d4) {
    for (const y of [GY - 0.105, GY + 0.105]) boks(0.82, 0.014, 0.02, titan, 0, y, FF + 0.012);
    for (const x of [-0.41, 0.41]) boks(0.014, 0.224, 0.02, titan, x, GY, FF + 0.012);
  }
  for (const y of d4 ? [GY + 0.04, GY - 0.045] : [GY + 0.035, GY - 0.03]) boks(0.78, d4 ? 0.044 : 0.026, 0.024, titan, 0, y, FF + 0.016);
  const merke = rund(0.035, 0.012, merkeMat, 0, GY, FF + 0.032);                    // det grønne Land Rover-merket
  merke.scale.x = 2;
  // Lykter: store, firkantede, med to runde linser. Discovery 4 har LED-kontur under og utenfor.
  for (const s of [-1, 1]) {
    const lx = s * 0.72;
    const ly = 0.955;
    boks(0.42, 0.21, 0.03, lyktglass, lx, ly, FF + 0.002);
    boks(0.012, 0.17, 0.07, lyktglass, s * (SIDE + 0.003), ly, FRONT - 0.03);       // lykta går rundt hjørnet
    for (const dx of [-0.085, 0.085]) {
      rund(0.06, 0.012, plast, lx + s * dx, ly + 0.015, FF + 0.018);
      rund(0.045, 0.012, lykt, lx + s * dx, ly + 0.015, FF + 0.026);
    }
    if (d4) {
      boks(0.36, 0.012, 0.01, led, lx, ly - 0.08, FF + 0.022);
      boks(0.012, 0.13, 0.01, led, lx + s * 0.19, ly - 0.02, FF + 0.022);
    } else {
      boks(0.08, 0.045, 0.01, blinklys, lx + s * 0.16, ly - 0.07, FF + 0.022);
    }
  }

  // ---------- Bak ----------
  const BF = BAK - 0.027;                      // bakplatens ytterflate
  boks(KUPE_B, TAK_B - BELTE + 0.01, 0.03, solv, 0, (TAK_B + BELTE) / 2, BAK - 0.012); // bakluke, øvre del
  boks(KUPE_B - 0.52, 0.42, 0.012, glass, 0, 1.55, BF - 0.004);                      // bakrute
  boks(KUPE_B - 0.3, 0.008, 0.012, plast, 0, 1.3, BF - 0.004);                        // delt bakluke
  boks(0.56, 0.14, 0.012, plast, 0, 0.98, BF - 0.004);                                // skiltnisje
  boks(0.52, 0.11, 0.008, skiltMat, 0, 0.98, BF - 0.012);
  boks(0.045, 0.11, 0.009, euMat, -0.237, 0.98, BF - 0.013);                          // blått felt til venstre (sett bakfra)
  if (d4) boks(0.7, 0.022, 0.012, titan, 0, 1.085, BF - 0.006);                       // pyntelist over skiltet
  for (const s of [-1, 1]) {
    const lx = s * 0.83;
    if (d4) {
      // LED-baklys: mørkt rødt glass med en søyle av runde lys
      boks(0.13, 0.72, 0.03, baklykt, lx, 1.37, BF);
      for (let i = 0; i < 5; i++) rund(0.022, 0.01, bakledd, lx, 1.62 - i * 0.11, BF - 0.016, karosseri, 16).rotation.x = -Math.PI / 2;
      boks(0.012, 0.6, 0.012, bakledd, lx + s * 0.06, 1.37, BF - 0.016);
    } else {
      // Høye baklys: rødt øverst, blinklys og ryggelys under
      boks(0.13, 0.42, 0.03, baklykt, lx, 1.52, BF);
      boks(0.13, 0.13, 0.03, blinklys, lx, 1.245, BF);
      boks(0.13, 0.16, 0.03, lyktglass, lx, 1.1, BF);
    }
    boks(0.012, 0.5, 0.1, baklykt, s * (KUPE_B / 2 + 0.003), 1.45, BAK + 0.04);        // lyset går rundt hjørnet
  }
  // Støtfanger med sort trinn oppå og plass til hengerfestet under
  boks(BREDDE + 0.02, 0.3, 0.14, solv, 0, 0.65, BAK - 0.07);
  boks(1.5, 0.015, 0.12, plast, 0, 0.805, BAK - 0.08);
  if (!d4) boks(BREDDE - 0.2, 0.05, 0.142, plast, 0, 0.525, BAK - 0.07);
  for (const s of [-1, 1]) boks(0.12, 0.03, 0.01, baklykt, s * 0.78, 0.66, BAK - 0.142);  // reflekser

  return { panser, oljelokk, panserGrunn };
}

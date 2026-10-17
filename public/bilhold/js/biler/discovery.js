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
  dekk: 'terreng',           // grove dekk
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
  const BELTE = 1.25;        // der vinduene begynner (høy beltelinje, som på bilen)
  const PANSER_FRONT = 1.12; // panseret er nesten flatt og faller litt mot fronten
  const MIDT_B = 1.28;       // innenfor hjulenes innerkant (0,8 − 0,128)
  const BUE_R = 0.48;        // hjulbuens radius (dekket er 0,38)
  const HENGSEL_Z = 1.0;     // panseret er hengslet ved frontruta
  const KUPE_B = 1.78;       // kupéens bredde ved beltelinjen (smalere enn karosseriet: tydelig skulder)
  const HELNING = 0.045;     // sideveggene går nesten loddrett opp til taket
  const TAK_F = 1.86;        // takets underkant foran
  const TAK_B = 1.91;        // «Alpine»-taket bak trinnet, ca. 5 cm høyere
  const TRINN_Z = -1.0;      // der taket hever seg, like bak C-stolpen
  const RUTE_FOT = { z: 1.0, y: BELTE };
  const RUTE_TOPP = { z: 0.44, y: TAK_F };
  const sideX = (BREDDE + MIDT_B) / 4;
  const sideB = (BREDDE - MIDT_B) / 2;
  const SIDE = BREDDE / 2;   // ytterflaten på siden
  const inn = (y) => (y - BELTE) * Math.tan(HELNING);              // hvor mye kupéen har smalnet ved høyden y
  const TAK_HALV = KUPE_B / 2 - inn(TAK_B + 0.07);                  // halv takbredde
  const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // Mange like småbiter (vokskake, luftehull, riller) tegnes som én InstancedMesh
  const rekke = (geo, m, punkter, foreldre = karosseri) => {
    const im = new THREE.InstancedMesh(geo, m, punkter.length);
    const o = new THREE.Object3D();
    punkter.forEach(([x, y, z, rz = 0], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, 0, rz);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    foreldre.add(im);
    return im;
  };
  const motordeksel = std({ color: d4 ? 0x36383c : 0x222326, metalness: 0.3, roughness: 0.6 });
  const kjolevaske = std({ color: 0xd9d4c5, roughness: 0.55 });
  const skiltMat = std({ color: 0xf2f2ee, roughness: 0.5 });
  const euMat = std({ color: 0x1f3f9a, roughness: 0.5 });
  const merkeMat = std({ color: 0x174a2c, metalness: 0.5, roughness: 0.35 });
  const kledning = std({ color: 0x232427, metalness: 0.15, roughness: 0.7 });   // hjulbuer og terskler
  const rodtGlass = std({ color: 0xc8150f, emissive: 0x4a0000, metalness: 0.2, roughness: 0.25 });   // baklys

  // ---------- Hjulbuer ----------
  // Nesten rektangulære buer med avrundede hjørner, så hjulene ser ut til å stå i firkantede kasser.
  // Punktene (z, y) over hjulet, bakfra og fram. r styrer størrelsen (BUE_R er selve åpningen).
  const buePunkter = (aksel, bunnBak, bunnFram, r = BUE_R, n = 4) => {
    const w = r * 0.98, topp = 0.38 + r * 0.9, rh = 0.15 * r / BUE_R;
    const hjorne = (cz, cy, fra, til) => Array.from({ length: n + 1 }, (_, i) => {
      const a = fra + (til - fra) * (i / n);
      return [cz + Math.cos(a) * rh, cy + Math.sin(a) * rh];
    });
    return [[aksel - w, bunnBak], ...hjorne(aksel - w + rh, topp - rh, Math.PI, Math.PI / 2),
      ...hjorne(aksel + w - rh, topp - rh, Math.PI / 2, 0), [aksel + w, bunnFram]];
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
      sideplate(bueRing(aksel, bak - 0.06, fram - 0.06, BUE_R - 0.005, BUE_R + 0.13), 0.08, kledning, s * (SIDE + 0.03), [], karosseri, 0.016);
      sideplate(bueRing(aksel, bak, fram, BUE_R - 0.014, BUE_R - 0.002), sideB - 0.02, plast, s * sideX);
      sideplate([...buePunkter(aksel, bak, fram)], 0.01, plast, s * (MIDT_B / 2 + 0.012));
    }
    // Terskel i samme kledning mellom hjulbuene
    const tFra = BAKAKSEL + BUE_R + 0.03, tTil = FORAKSEL - BUE_R - 0.03;
    fboks(0.06, 0.17, tTil - tFra, kledning, s * (SIDE + 0.01), UNDER - 0.005, (tFra + tTil) / 2, 0.018);
    // Enkel, rett karakterlinje midt på dørsiden
    fboks(0.018, 0.035, tTil - tFra + 0.2, solv, s * (SIDE + 0.003), 0.88, (tFra + tTil) / 2, 0.01);
  }
  // Bakplate i lakk over endene av sideplatene (frontplaten ligger i byggFrontD3/D4)
  fboks(BREDDE - 0.02, BELTE - 0.53, 0.05, solv, 0, (BELTE + 0.52) / 2, BAK - 0.002, 0.02);

  // ---------- Motorrom ----------
  boks(MIDT_B - 0.02, 0.02, FRONT - HENGSEL_Z - 0.04, motorrom, 0, UNDER + 0.33, (FRONT + HENGSEL_Z) / 2);
  boks(MIDT_B - 0.02, BELTE - UNDER - 0.34, 0.04, motorrom, 0, (BELTE + UNDER + 0.32) / 2, HENGSEL_Z + 0.03);   // brannvegg
  for (const s of [-1, 1]) boks(0.01, 0.3, FRONT - HENGSEL_Z - 0.06, motorrom, s * (MIDT_B / 2 - 0.006), UNDER + 0.48, (FRONT + HENGSEL_Z) / 2);
  // V6-diesel på langs med stort plastdeksel. Oljelokket sitter oppå dekselet, oljefilterhuset foran.
  const motorZ = 1.62;
  boks(0.6, 0.16, 0.68, motorMat, 0, 0.96, motorZ);                                   // motorblokk
  fboks(0.74, 0.12, 0.7, motordeksel, 0, 1.08, motorZ, 0.04);                          // motordeksel
  for (const z of [-0.2, 0, 0.2]) boks(0.56, 0.015, 0.05, motordeksel, 0, 1.145, motorZ + z); // ribber
  if (d4) boks(0.3, 0.006, 0.08, titan, 0, 1.142, motorZ - 0.28);                    // merke på SDV6-dekselet
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), oljeMat);
  oljelokk.position.set(d4 ? -0.2 : 0.2, 1.16, motorZ + 0.22);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), oljeMat);
  oljefilter.position.set(-0.12, 1.06, motorZ + 0.4);
  karosseri.add(oljefilter);
  fboks(0.24, 0.18, 0.42, plast, -0.47, 1.04, 1.38, 0.03);                            // luftfilterboks
  fboks(0.18, 0.14, 0.22, kjolevaske, 0.48, 1.04, 1.26, 0.02);                        // ekspansjonstank
  boks(0.6, 0.04, 0.06, plast, 0, 1.06, FRONT - 0.12);                                // låsebjelke foran

  // ---------- Panser ----------
  // Bredt «clamshell»-panser over skjermene, med skrå kanter og en lav forhøyning i midten
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.005, HENGSEL_Z);
  karosseri.add(panser);
  const panserL = Math.hypot(FRONT - HENGSEL_Z, BELTE - PANSER_FRONT) + 0.03;
  // Helt flatt i midten, med markerte kanter som faller brått ned mot skjermene (tverrsnitt trukket langs panseret)
  const PB = BREDDE / 2 - 0.005;
  const snitt = new THREE.Shape([[-PB, -0.06], [-PB + 0.16, 0.035], [PB - 0.16, 0.035], [PB, -0.06], [PB - 0.02, -0.075], [-PB + 0.02, -0.075]]
    .map(([x, y]) => new THREE.Vector2(x, y)));
  const panserPlate = new THREE.Mesh(new THREE.ExtrudeGeometry(snitt, { depth: panserL, bevelEnabled: false }), solv);
  panserPlate.castShadow = true;
  panserPlate.receiveShadow = true;
  panser.add(panserPlate);
  if (!d4) {
    // Bokstavene LAND ROVER i en flat linje på forkanten, like over grillen
    const lerret = document.createElement('canvas');
    lerret.width = 1024;
    lerret.height = 128;
    const g = lerret.getContext('2d');
    g.fillStyle = '#1d1f22';
    g.font = '800 96px Arial, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '22px';
    g.fillText('LAND ROVER', 512, 68);
    const tekstur = new THREE.CanvasTexture(lerret);
    tekstur.colorSpace = THREE.SRGBColorSpace;
    const bokstaver = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.12), new THREE.MeshStandardMaterial({ map: tekstur, transparent: true, metalness: 0.5, roughness: 0.4 }));
    bokstaver.rotation.x = -Math.PI / 2;
    bokstaver.position.set(0, 0.037, panserL - 0.11);
    panser.add(bokstaver);
  }
  fboks(BREDDE - 0.01, 0.1, 0.08, solv, 0, -0.035, panserL - 0.04, 0.04, panser);    // forkanten bøyer ned, med bred fas
  const panserGrunn = Math.atan2(BELTE - PANSER_FRONT, FRONT - HENGSEL_Z);           // senker fronten

  // ---------- Kupé ----------
  // Taket: to nivåer med skrå kanter, soltak foran og alpine-glass i det hevede taket
  fboks(TAK_HALV * 2 + 0.02, 0.08, RUTE_TOPP.z + 0.06 - TRINN_Z, solv, 0, TAK_F + 0.04, (RUTE_TOPP.z + 0.06 + TRINN_Z - 0.02) / 2, 0.04);
  fboks(TAK_HALV * 2 + 0.02, 0.08, TRINN_Z - BAK + 0.01, solv, 0, TAK_B + 0.04, (TRINN_Z + BAK - 0.01) / 2, 0.04);
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
  const VF = 1.3;            // vinduenes underkant
  const VT = 1.81;           // overkant foran
  const VT_BAK = 1.86;       // bakre sidevindu følger det hevede taket
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
    // Stramme, rettvinklede sorte rammer rundt sidevinduene
    for (const v of vinduer) {
      const cz = v.reduce((a, p) => a + p[0], 0) / v.length, cy = v.reduce((a, p) => a + p[1], 0) / v.length;
      const ut = v.map(([z, y]) => [z + Math.sign(z - cz) * 0.025, y + Math.sign(y - cy) * 0.025]);
      sideplate(y0(ut), 0.012, plast, glassX + s * 0.006, [y0(v)], vegg);
    }
    // Sorte B- og C-stolper: vinduene blir ett mørkt bånd, D-stolpen er lakkert
    boks(0.012, VT - VF + 0.02, 0.13, plast, glassX, (VT + VF) / 2 - BELTE, 0, vegg);
    boks(0.012, VT_BAK - VF + 0.02, 0.14, plast, glassX, (VT_BAK + VF) / 2 - BELTE, -0.92, vegg);
    // A-stolpen er også sort på siden, fra vinduet fram til frontruta
    sideplate(y0([[aStolpeZ(VF) - 0.075, VF - 0.01], [aStolpeZ(VF) + 0.01, VF - 0.01], [aStolpeZ(TAK_F) + 0.01, TAK_F], [aStolpeZ(VT) - 0.075, VT]]), 0.012, plast, glassX, [], vegg);
    // Sort tetningslist langs vinduenes underkant
    boks(0.02, 0.015, aStolpeZ(VF) - 0.07 - BAK - 0.32, plast, ytre + s * 0.012, VF - BELTE - 0.012, (BAK + 0.32 + aStolpeZ(VF) - 0.07) / 2, vegg);
    // Speil: sort hus på en fot ved A-stolpen (Discovery 4: blinklys i speilet)
    fboks(0.12, 0.05, 0.1, plast, s * (SIDE + 0.03), BELTE + 0.06, 0.86, 0.015);
    fboks(0.24, 0.17, 0.1, d4 ? solv : plast, s * (SIDE + 0.15), BELTE + 0.12, 0.84, 0.03);
    boks(0.2, 0.14, 0.012, glass, s * (SIDE + 0.15), BELTE + 0.12, 0.785);
    if (d4) boks(0.17, 0.014, 0.012, blinklys, s * (SIDE + 0.16), BELTE + 0.05, 0.891);
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
  // Ramme i lakk rundt ruta: A-stolpene og takkanten, så ruta sitter i karosseriet
  const rB = 0.075, rT = 0.06;                          // stolpebredde og takkant
  const yb = bunnB + 0.045, yt = toppB + 0.045;
  const rammeForm = new THREE.Shape([[-yb, 0], [yb, 0], [yt, ruteL + 0.03], [-yt, ruteL + 0.03]].map(([x, y]) => new THREE.Vector2(x, y)));
  rammeForm.holes.push(new THREE.Path([[-yb + rB, 0.02], [yb - rB, 0.02], [yt - rB, ruteL + 0.03 - rT], [-yt + rB, ruteL + 0.03 - rT]].map(([x, y]) => new THREE.Vector2(x, y))));
  const ramme = new THREE.Mesh(new THREE.ExtrudeGeometry(rammeForm, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelOffset: -0.012, bevelSegments: 1 }), plast);   // sorte A-stolper
  ramme.position.copy(rute.position);
  ramme.rotation.x = rute.rotation.x;
  ramme.castShadow = true;
  karosseri.add(ramme);
  // Viskere i hvilestilling
  for (const x of [-0.35, 0.25]) fboks(0.5, 0.012, 0.02, plast, x, BELTE + 0.035, RUTE_FOT.z - 0.03, 0.004).rotation.z = 0.06;

  // ---------- Sidedetaljer ----------
  for (const s of [-1, 1]) {
    const x = s * (SIDE + 0.004);
    // Luftinntak bak forhjulet, under panserlinjen. Discovery 3: bare på høyre side, loddrett med mørkt gitter
    // og lakkert ramme. Discovery 4: gjelle med to brede spiler på begge sider.
    const ventZ = FORAKSEL - BUE_R - 0.06;
    if (d4) {
      fboks(0.012, 0.11, 0.16, plast, x, 1.11, ventZ, 0.004);
      for (const y of [1.085, 1.135]) fboks(0.014, 0.02, 0.15, titan, x + s * 0.004, y, ventZ, 0.004);
    } else if (s < 0) {
      const vz = FORAKSEL - BUE_R + 0.02, vy = 1.07;
      fboks(0.016, 0.22, 0.14, solv, x, vy, vz, 0.006);                                     // lakkert ramme
      boks(0.006, 0.18, 0.1, plast, x + s * 0.008, vy, vz);
      for (let i = -3; i <= 3; i++) boks(0.006, 0.006, 0.1, kledning, x + s * 0.011, vy + i * 0.024, vz);
      for (const dz of [-0.025, 0.025]) boks(0.006, 0.18, 0.006, kledning, x + s * 0.011, vy, vz + dz);
    }
    // Dørfuger og dørhåndtak
    for (const [z, fra] of [[aStolpeZ(BELTE) - 0.01, 0.5], [0, 0.5], [-0.92, 0.88]]) boks(0.004, BELTE - fra, 0.006, plast, x + s * 0.002, (BELTE + fra) / 2, z);
    for (const z of [0.25, -0.65]) fboks(0.018, 0.035, 0.16, d4 ? solv : titan, x + s * 0.008, 1.17, z, 0.008);
  }

  // ---------- Front ----------
  const FF = FRONT + 0.027;                    // frontplatens ytterflate
  const STF = FRONT + 0.16;                    // støtfangerens ytterflate
  if (d4) byggFrontD4();
  else byggFrontD3();

  // Discovery 3, rett forfra: to nesten kvadratiske lykter i de øvre hjørnene (ytterkanten i flukt med siden),
  // grill med to kraftige tverrstenger og vokskake mellom lyktene, en kraftig delelinje under dem, og under den
  // en støtfanger i mørk plast med traktformede tåkelys, lavt luftinntak og lys beskyttelsesplate.
  function byggFrontD3() {
    const SPLITT = 0.8;                        // delelinjen mellom lakk (over) og plast (under)
    const LB = 0.4, LH = 0.3;                  // lyktene
    const LX = SIDE - LB / 2, LY = PANSER_FRONT - 0.015 - LH / 2;
    const klart = std({ color: 0xdfe3e6, metalness: 0.55, roughness: 0.12 });
    const morkPlast = std({ color: 0x0c0d0e, roughness: 0.8 });
    const gitter = std({ color: 0x34373c, metalness: 0.3, roughness: 0.6 });
    // Lakkert felt rundt lykter og grill
    fboks(BREDDE - 0.02, PANSER_FRONT - SPLITT, 0.05, solv, 0, (PANSER_FRONT + SPLITT) / 2, FRONT + 0.002, 0.02);
    // Støtfanger i mørk plast under delelinjen, tredelt: midtparti og to hjørner i ulakkert, strukturert plast
    const struktur = std({ color: 0x2b2c2f, roughness: 1 });
    const MB = 1.12;
    fboks(MB, SPLITT - 0.36, 0.16, kledning, 0, (SPLITT + 0.36) / 2, FRONT + 0.08, 0.04);
    for (const s of [-1, 1]) fboks((BREDDE + 0.02 - MB) / 2 - 0.01, SPLITT - 0.35, 0.18, struktur, s * (MB / 2 + (BREDDE + 0.02 - MB) / 4), (SPLITT + 0.37) / 2, FRONT + 0.085, 0.05);
    boks(BREDDE - 0.14, 0.012, 0.02, morkPlast, 0, SPLITT + 0.002, FRONT + 0.175);
    for (const s of [-1, 1]) {
      const lx = s * LX;
      // Lyktehuset: trapesformet ramme med et trinn i underkanten som følger støtfangerlinjen
      // (u går utover fra lyktas midte, y opp)
      const u = [[-LB / 2, LH / 2], [LB / 2, LH / 2], [LB / 2, -LH / 2], [0.02, -LH / 2], [0, -LH / 2 + 0.05], [-LB / 2 + 0.05, -LH / 2 + 0.05]];
      const husForm = new THREE.Shape(u.map(([a, y]) => new THREE.Vector2(lx + s * a, LY + y)));
      const hus = new THREE.Mesh(new THREE.ExtrudeGeometry(husForm, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 1 }), klart);
      hus.position.z = FF - 0.008;
      karosseri.add(hus);
      fboks(0.03, LH - 0.02, 0.24, klart, s * (SIDE - 0.005), LY, FRONT - 0.08, 0.01);
      // Runde enheter i lykta: projektorlinse med markant ring ytterst, parabol i midten, svinglys innerst
      const oy = LY + 0.04;
      const px = lx + s * 0.12;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 20), krom);
      ring.position.set(px, oy, FF + 0.026);
      karosseri.add(ring);
      rund(0.04, 0.012, lykt, px, oy, FF + 0.026, karosseri, 20);
      const fx = lx - s * 0.005;
      rund(0.058, 0.01, std({ color: 0xb8bdc3, metalness: 1, roughness: 0.25 }), fx, oy, FF + 0.026, karosseri, 24);
      for (const rr of [0.046, 0.032, 0.02]) {
        const r2 = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.004, 4, 20), krom);
        r2.position.set(fx, oy, FF + 0.032);
        karosseri.add(r2);
      }
      rund(0.012, 0.02, lykt, fx, oy, FF + 0.036, karosseri, 12);
      const sx = lx - s * 0.125;
      const sring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 18), krom);
      sring.position.set(sx, oy - 0.01, FF + 0.026);
      karosseri.add(sring);
      rund(0.028, 0.01, std({ color: 0xc9cdd2, metalness: 1, roughness: 0.3 }), sx, oy - 0.01, FF + 0.026, karosseri, 18);
      rund(0.01, 0.016, lykt, sx, oy - 0.01, FF + 0.032, karosseri, 10);
      // Blinklys nede i det ytre, lavere feltet under trinnet
      boks(0.16, 0.035, 0.012, blinklys, lx + s * 0.11, LY - LH / 2 + 0.025, FF + 0.024);
      // Lyktespyler: lite, mørkt plastdeksel under lykta, over delelinjen
      fboks(0.08, 0.04, 0.03, plast, lx, SPLITT, FRONT + 0.185, 0.008);
      // Tåkelys langt ute i hjørnene, i en innstøpt, mangekantet fordypning
      const tx = s * (MB / 2 + (BREDDE + 0.02 - MB) / 4), ty = 0.55, TF = FRONT + 0.176;
      fboks(0.19, 0.15, 0.02, morkPlast, tx, ty, TF - 0.006, 0.04);
      const tring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 20), krom);
      tring.position.set(tx, ty, TF + 0.006);
      karosseri.add(tring);
      const linse = new THREE.Mesh(new THREE.SphereGeometry(0.046, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xf2f4f6, metalness: 0.4, roughness: 0.05, emissive: 0x444038 }));
      linse.rotation.x = Math.PI / 2;
      linse.scale.y = 0.4;
      linse.position.set(tx, ty, TF + 0.004);
      karosseri.add(linse);
    }
    // Grill: fyller hele rommet mellom lyktene. Overkanten buer svakt opp ytterst for å møte panseret.
    const GB = 2 * (LX - LB / 2) - 0.03, GBUNN = SPLITT + 0.035, GTOPP = PANSER_FRONT - 0.03;
    const gForm = new THREE.Shape([[-GB / 2, GBUNN], [GB / 2, GBUNN], [GB / 2, GTOPP + 0.012], [GB * 0.35, GTOPP - 0.002],
      [0, GTOPP - 0.006], [-GB * 0.35, GTOPP - 0.002], [-GB / 2, GTOPP + 0.012]].map(([x, y]) => new THREE.Vector2(x, y)));
    const gFlate = new THREE.Mesh(new THREE.ExtrudeGeometry(gForm, { depth: 0.03, bevelEnabled: false }), morkPlast);
    gFlate.position.z = FF;
    karosseri.add(gFlate);
    // Vokskake: sekskanter bak og mellom stengene
    const R = 0.0175, hex = new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.008, 6);
    hex.rotateX(Math.PI / 2);
    const celler = [];
    for (let rad = 0, y = GBUNN + R; y < GTOPP - R * 0.8; rad++, y += R * 1.5) {
      for (let x = -GB / 2 + R + (rad % 2) * R * 0.866; x < GB / 2 - R * 0.8; x += R * 1.732) celler.push([x, y, FF + 0.032]);
    }
    rekke(hex, gitter, celler);
    // To kraftige tverrstenger med en rekke små, stående luftehull
    const stenger = [GBUNN + 0.17, GBUNN + 0.07];
    const hull = [];
    for (const y of stenger) {
      fboks(GB - 0.02, 0.05, 0.04, titan, 0, y, FF + 0.05, 0.012);
      for (let x = -GB / 2 + 0.05; x < GB / 2 - 0.04; x += 0.038) hull.push([x, y, FF + 0.071]);
    }
    rekke(new THREE.BoxGeometry(0.012, 0.026, 0.004), morkPlast, hull);
    // Den grønne ovalen, innfelt i vokskaken øverst til venstre (sett forfra)
    const merke = rund(0.03, 0.012, merkeMat, -GB / 2 + 0.11, GTOPP - 0.035, FF + 0.04, karosseri, 20);
    merke.scale.x = 2;
    // Nedre luftinntak med grovt rutenett, mellom tåkelysene
    const IB = MB - 0.16;
    boks(IB, 0.12, 0.02, morkPlast, 0, 0.53, STF + 0.001);
    for (let x = -IB / 2 + 0.07; x < IB / 2 - 0.03; x += 0.075) boks(0.012, 0.11, 0.02, gitter, x, 0.53, STF + 0.006);
    boks(IB - 0.02, 0.012, 0.02, gitter, 0, 0.53, STF + 0.007);
    // Lys beskyttelsesplate under, vinklet opp under bilen
    const plate = fboks(IB + 0.1, 0.025, 0.24, std({ color: 0xa4a8ad, metalness: 0.7, roughness: 0.45 }), 0, 0.37, FRONT + 0.03, 0.01);
    plate.rotation.x = 0.32;
    fboks(0.08, 0.05, 0.02, kledning, -0.45, 0.66, STF + 0.002, 0.01);                         // deksel for slepekrok
    // Delelinje (panserfuge) rett over lykter og grill
    boks(BREDDE - 0.04, 0.008, 0.01, morkPlast, 0, PANSER_FRONT - 0.004, FF + 0.006);
  }

  function byggFrontD4() {
    // Støtfanger lakkert helt ut, med ett stort luftinntak
    fboks(BREDDE - 0.02, PANSER_FRONT - 0.53, 0.05, solv, 0, (PANSER_FRONT + 0.52) / 2, FRONT + 0.002, 0.02);
    fboks(BREDDE + 0.02, 0.27, 0.16, solv, 0, 0.72, FRONT + 0.08, 0.05);
    fboks(BREDDE - 0.06, 0.22, 0.15, solv, 0, 0.47, FRONT + 0.07, 0.04);
    fboks(1.1, 0.13, 0.02, plast, 0, 0.55, STF - 0.01, 0.02);
    for (const s of [-1, 1]) {
      const tx = s * 0.72, ty = 0.62;
      fboks(0.15, 0.13, 0.03, plast, tx, ty, STF - 0.012, 0.03);                            // tåkelysramme
      rund(0.045, 0.012, krom, tx, ty, STF + 0.003, karosseri, 12);
      rund(0.036, 0.012, lykt, tx, ty, STF + 0.008, karosseri, 12);
    }
    fboks(0.08, 0.05, 0.02, solv, -0.45, 0.78, STF + 0.002, 0.01);                           // deksel for slepekrok
    // Grill: mørkt nett med to kraftige spiler
    const GY = 0.99;
    fboks(0.82, 0.24, 0.04, plast, 0, GY, FF, 0.02);
    for (let i = -6; i <= 6; i++) boks(0.006, 0.22, 0.01, kledning, i * 0.06, GY, FF + 0.022);
    for (const y of [GY + 0.05, GY - 0.05]) fboks(0.8, 0.05, 0.04, titan, 0, y, FF + 0.02, 0.012);
    const merke = rund(0.035, 0.014, merkeMat, 0, GY + 0.045, FF + 0.044, karosseri, 16);
    merke.scale.x = 2;
    // Mørkt lysglass med LED-kontur
    for (const s of [-1, 1]) {
      const lx = s * 0.7, ly = 0.995;
      fboks(0.48, 0.25, 0.04, lyktglass, lx, ly, FF + 0.002, 0.02);
      fboks(0.03, 0.23, 0.26, lyktglass, s * (SIDE - 0.005), ly, FRONT - 0.09, 0.012);
      for (const dx of [-0.07, 0.08]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 16), krom);
        ring.position.set(lx - s * dx, ly + 0.015, FF + 0.026);
        karosseri.add(ring);
        rund(0.048, 0.01, lykt, lx - s * dx, ly + 0.015, FF + 0.024, karosseri, 16);
      }
      boks(0.38, 0.012, 0.01, led, lx, ly - 0.085, FF + 0.025);
      boks(0.012, 0.15, 0.01, led, lx + s * 0.21, ly - 0.015, FF + 0.025);
      fboks(0.018, 0.05, 0.14, blinklys, s * (SIDE + 0.006), ly - 0.04, FRONT - 0.08, 0.006);
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
  if (d4) byggBakD4();
  else byggBakD3();

  // Discovery 3, rett bakfra: delt bakluke med en horisontal fuge midt på. Bakruta har en knekk i underkanten
  // (rett fra venstre til litt forbi midten, så 25° ned mot høyre), skiltet sitter til venstre på nedre luke,
  // høye, smale baklys på D-stolpene ved siden av ruta, og en dyp, mørk støtfanger med trinn oppå.
  function byggBakD3() {
    const morkPlast = std({ color: 0x0c0d0e, roughness: 0.8 });
    const klart = std({ color: 0xdfe3e6, metalness: 0.55, roughness: 0.12 });
    const FUGE = 1.18;
    boks(BREDDE - 0.06, 0.01, 0.01, morkPlast, 0, FUGE, BF - 0.004);
    // Bakruta (sett bakfra er venstre +x). Underkanten: høy til venstre, knekk litt forbi midten, lav til høyre.
    const RX = lukeB - 0.19, RTOPP = TAK_B - 0.1, HOY = 1.39, LAV = 1.24;
    const knekkX = -0.08, slutt = knekkX - (HOY - LAV) / Math.tan(25 * Math.PI / 180);
    const ruteForm = new THREE.Shape([[RX, HOY], [knekkX, HOY], [slutt, LAV], [-RX, LAV], [-RX + 0.02, RTOPP], [RX - 0.02, RTOPP]]
      .map(([x, y]) => new THREE.Vector2(x, y)));
    const rute = new THREE.Mesh(new THREE.ExtrudeGeometry(ruteForm, { depth: 0.01, bevelEnabled: false }), glass);
    rute.position.z = BF - 0.012;
    karosseri.add(rute);
    // Vindusvisker: festet der knekken starter, liggende langs den skrå kanten
    const vinkel = Math.atan2(LAV - HOY, slutt - knekkX);
    const lengde = Math.hypot(slutt - knekkX, LAV - HOY);
    const visker = boks(lengde, 0.014, 0.012, plast, (knekkX + slutt) / 2 + 0.01, (HOY + LAV) / 2 + 0.025, BF - 0.02);
    visker.rotation.z = vinkel;
    rund(0.02, 0.02, plast, knekkX, HOY + 0.015, BF - 0.02, karosseri, 12);
    // Lav, mørk takspoiler over ruta med smalt LED-bremselys
    fboks(lukeT * 2 - 0.06, 0.07, 0.1, plast, 0, TAK_B + 0.03, BF - 0.03, 0.02);
    boks(0.5, 0.018, 0.01, bakledd, 0, TAK_B + 0.03, BF - 0.082);
    // Nedre luke: innfelt skiltnisje til venstre med mørk håndtaksleppe over, høyre side helt slett
    const SX = 0.3, SY = 0.99;
    fboks(0.6, 0.18, 0.02, plast, SX, SY, BF - 0.006, 0.02);
    boks(0.52, 0.11, 0.008, skiltMat, SX, SY - 0.005, BF - 0.018);
    boks(0.045, 0.11, 0.009, euMat, SX + 0.237, SY - 0.005, BF - 0.019);                // blått felt til venstre
    fboks(0.5, 0.035, 0.035, morkPlast, SX, SY + 0.13, BF - 0.012, 0.012);
    // Baklys: slanke, loddrette lykter helt ytterst, fra midjehøyde nesten opp til taket.
    // Runde lysgrafikker for bremselys og blinklys, ryggelys nederst.
    const hus = std({ color: 0x3a0c0c, metalness: 0.3, roughness: 0.25 });
    const ravGlass = std({ color: 0xffa21f, emissive: 0x6a3300, roughness: 0.25 });
    for (const s of [-1, 1]) {
      const lx = s * (lukeB - 0.095), ly = 1.48, lh = 0.72;
      fboks(0.15, lh, 0.04, hus, lx, ly, BF - 0.01, 0.015);
      const sirkler = [[ly + 0.25, bakledd], [ly + 0.11, bakledd], [ly - 0.03, ravGlass]];
      for (const [y, m] of sirkler) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 18), krom);
        ring.position.set(lx, y, BF - 0.032);
        karosseri.add(ring);
        rund(0.042, 0.012, m, lx, y, BF - 0.03, karosseri, 18);
      }
      boks(0.12, 0.1, 0.01, klart, lx, ly - 0.22, BF - 0.032);                              // ryggelys
      boks(0.012, lh, 0.05, rodtGlass, s * (lukeB - inn(ly) + 0.002), ly, BAK + 0.015);     // litt rundt hjørnet
    }
    // Dyp, mørk støtfanger med mønstret trinn oppå, røde reflekser nederst og deksel for hengerfestet
    fboks(BREDDE + 0.02, 0.42, 0.12, kledning, 0, 0.6, BAK - 0.055, 0.06);
    boks(BREDDE - 0.2, 0.02, 0.1, plast, 0, 0.815, BAK - 0.065);
    const riller = [];
    for (let x = -(BREDDE - 0.3) / 2; x <= (BREDDE - 0.3) / 2; x += 0.035) riller.push([x, 0.828, BAK - 0.065]);
    rekke(new THREE.BoxGeometry(0.008, 0.008, 0.09), kledning, riller);
    for (const s of [-1, 1]) boks(0.18, 0.025, 0.01, baklykt, s * 0.7, 0.45, BAK - 0.118);
    fboks(0.16, 0.15, 0.012, plast, 0, 0.6, BAK - 0.118, 0.01);
    boks(0.17, 0.006, 0.004, morkPlast, 0, 0.6 + 0.078, BAK - 0.124);
  }

  function byggBakD4() {
    // Stor bakrute over hele bredden mellom D-stolpene, og et bremselys øverst
    fboks(KUPE_B - 0.36, 0.52, 0.02, glass, 0, (BELTE + TAK_B) / 2 + 0.02, BF - 0.012, 0.012);
    fboks(0.5, 0.03, 0.02, bakledd, 0, TAK_B - 0.025, BF - 0.014, 0.008);
    fboks(KUPE_B - 0.4, 0.012, 0.02, plast, 0, BELTE + 0.035, BF - 0.012, 0.004);           // delt bakluke
    // Den asymmetriske bakluka: skiltet sitter forskjøvet mot venstre (sett bakfra), med en loddrett fuge ved siden av
    const SX = 0.2;
    fboks(0.6, 0.18, 0.02, plast, SX, 1.03, BF - 0.006, 0.02);                             // skiltnisje
    boks(0.52, 0.11, 0.008, skiltMat, SX, 1.02, BF - 0.018);
    boks(0.045, 0.11, 0.009, euMat, SX + 0.237, 1.02, BF - 0.019);                        // blått felt til venstre (sett bakfra)
    fboks(0.12, 0.03, 0.02, titan, SX, 1.15, BF - 0.008, 0.006);                           // håndtak over skiltet
    boks(0.008, BELTE - 0.84, 0.01, plast, -0.2, (BELTE + 0.84) / 2, BF - 0.012);          // fuge
    fboks(0.7, 0.024, 0.02, titan, SX, 1.13, BF - 0.006, 0.006);                           // pyntelist over skiltet
    // LED-baklys i hjørnene under bakruta: mørkt rødt glass med en søyle av runde lys, rundt hjørnet
    for (const s of [-1, 1]) {
      const lx = s * 0.8;
      fboks(0.15, 0.46, 0.04, baklykt, lx, 1.08, BF, 0.015);
      for (let i = 0; i < 5; i++) rund(0.022, 0.01, bakledd, lx, 1.26 - i * 0.09, BF - 0.02, karosseri, 12);
      boks(0.012, 0.38, 0.012, bakledd, lx + s * 0.06, 1.08, BF - 0.02);
      boks(0.012, 0.46, 0.16, baklykt, s * (SIDE + 0.004), 1.08, BAK + 0.07);
    }
    // Lakkert støtfanger med sort trinn oppå og plass til hengerfestet under
    fboks(BREDDE + 0.02, 0.42, 0.12, solv, 0, 0.6, BAK - 0.055, 0.06);
    fboks(1.5, 0.02, 0.1, plast, 0, 0.815, BAK - 0.065, 0.006);
    fboks(BREDDE - 0.2, 0.06, 0.155, kledning, 0, 0.42, BAK - 0.07, 0.02);
    for (const s of [-1, 1]) boks(0.12, 0.03, 0.01, baklykt, s * 0.72, 0.66, BAK - 0.118);  // reflekser
  }

  return { panser, oljelokk, panserGrunn };
}

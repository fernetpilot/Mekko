// Land Rover Discovery 2 (1998–2004) bygget i Three.js, uten modellfil.
// Karosseriet er laget av myke profiler med runde kanter (stil som «stock»-bilene i
// Need for Speed Underground 2), med mål fra Land Rover: 4,70 m lang med reservehjul,
// 1,88 m bred, 1,90 m høy og 2,54 m akselavstand.
// Bilen står i origo og peker mot +z. Bilens venstre side er +x (førersiden i Norge).
// Brukes både på forsiden (scene.js) og i spillet (/spill), så bilen er lik overalt.

import * as THREE from 'three';
import { lagSjiraff } from './tilhenger.js';
import { rundBoks, rundForm, profil, dekkGeo, felgGeo, slange, tekstTekstur } from './former.js';

export const HJULRADIUS = 0.39;
// Lakk: varm, litt gulaktig grå, som mange Discovery 2. Hengeren bruker samme farge.
export const LAKK = 0xbdb9ac;
export const FORAKSEL_Z = 1.32;
export const BAKAKSEL_Z = -1.22;
export const SPORVIDDE = 0.82;           // avstand fra midten til hjulsenter

const BREDDE = 1.86;
const FRONT = 2.28;                      // nesen (uten støtfanger)
const BAK = -2.22;                       // bakluka (uten støtfanger og reservehjul)
const BUNN = 0.5;                        // underkant av karosseriet
const BELTE = 1.14;                      // høyden der panser og vinduer begynner
const SIDE_X = BREDDE / 2;               // ytterkant av sidene
const KUPE_X = 0.87;                     // ytterkant av kupeen (smalere enn karosseriet)
const BUE_R = 0.5;                       // hjulbuene
const BUE_Y = 0.4;
const SKJERM_X = 0.64;                   // innerkant av forskjermene = sideveggene i motorrommet
const PANSER_Z = 0.76;                   // panserhengslet ved frontruta
const MOTORROM_GULV = 0.8;
// Frontruta: fra panseret opp til taket
const RUTE_FOT = { z: 0.72, y: BELTE - 0.04 };
const RUTE_TOPP = { z: 0.3, y: 1.8 };
const TAK = 1.82;                        // taket over forsetene
const TAK_BAK = 1.9;                     // det hevede taket bak (med alpine-vinduer)
const TRINN_Z = -1.28;
const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);

export function lagBil() {
  const gruppe = new THREE.Group();
  const karosseri = new THREE.Group();
  gruppe.add(karosseri);

  // ---------- Materialer ----------
  const solv = new THREE.MeshPhysicalMaterial({
    color: LAKK, metalness: 0.3, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.08, envMapIntensity: 0.9,
  });
  const plast = new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.72, metalness: 0.05 });   // grå støtfangere og lister
  const svart = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.55 });
  const krom = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, metalness: 1, roughness: 0.1 });
  const aluminium = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.35 });
  // Glasset kan bli gjennomsiktig når bilen «skannes», så man ser sjåføren
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1b2326, metalness: 0.3, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.4, transparent: true, opacity: 1 });
  const frontGlass = new THREE.MeshPhysicalMaterial({ color: 0x1c2427, metalness: 0.1, roughness: 0.12, envMapIntensity: 0.22, transparent: true, opacity: 1 });
  const glassListe = [glass, frontGlass];
  const lyktGlass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, clearcoat: 1, transparent: true, opacity: 0.14, depthWrite: false });
  const reflektor = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, metalness: 1, roughness: 0.18, emissive: 0xfff6e0, emissiveIntensity: 0.35 });
  const oransje = new THREE.MeshPhysicalMaterial({ color: 0xff8c1a, roughness: 0.15, emissive: 0x4a2000, clearcoat: 1 });
  const rod = new THREE.MeshPhysicalMaterial({ color: 0xa3111a, roughness: 0.12, emissive: 0x2a0000, clearcoat: 1 });
  const hvitLykt = new THREE.MeshPhysicalMaterial({ color: 0xe8eaec, roughness: 0.08, clearcoat: 1 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x55595f, metalness: 0.6, roughness: 0.45 });
  const motordeksel = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.6, metalness: 0.1 });
  const oljeMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.3, roughness: 0.5 });
  const gummi = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.85 });
  const beholder = new THREE.MeshPhysicalMaterial({ color: 0xf1ede2, roughness: 0.35, transparent: true, opacity: 0.85 });

  const legg = (m, x = 0, y = 0, z = 0, foreldre = karosseri) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };
  const boks = (b, h, l, r, mat, x, y, z, foreldre = karosseri) => legg(new THREE.Mesh(rundBoks(b, h, l, r), mat), x, y, z, foreldre);
  const sylinder = (r1, r2, h, mat, x, y, z, akse = 'x', foreldre = karosseri, seg = 32) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
    if (akse === 'x') m.rotation.z = Math.PI / 2;
    if (akse === 'z') m.rotation.x = Math.PI / 2;
    return legg(m, x, y, z, foreldre);
  };
  // Tynn plate formet etter (z, y)-punkter, i planet x (vender ut mot siden)
  const sideplate = (form, tykk, mat, x, kant = 0) => {
    const geo = new THREE.ExtrudeGeometry(form, kant
      ? { depth: tykk, bevelEnabled: true, bevelThickness: kant, bevelSize: kant, bevelSegments: 3, curveSegments: 16 }
      : { depth: tykk, bevelEnabled: false, curveSegments: 16 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = -Math.PI / 2;
    m.position.x = x + tykk / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    karosseri.add(m);
    return m;
  };

  // ---------- Nedre karosseri ----------
  // Sidene (skjermer, dører og bakskjermer) med hjulbuer, og midtpartiet med motorrom.
  // Skjøtene mellom dem blir de naturlige fugene langs panseret.
  const a0 = Math.asin((BUNN - BUE_Y) / BUE_R);
  const side = new THREE.Shape();
  side.moveTo(-2.16, BUNN);
  side.lineTo(BAKAKSEL_Z - BUE_R * Math.cos(a0), BUNN);
  side.absarc(BAKAKSEL_Z, BUE_Y, BUE_R, Math.PI - a0, a0, true);
  side.lineTo(FORAKSEL_Z - BUE_R * Math.cos(a0), BUNN);
  side.absarc(FORAKSEL_Z, BUE_Y, BUE_R, Math.PI - a0, a0, true);
  side.lineTo(2.12, BUNN);
  side.quadraticCurveTo(FRONT - 0.03, BUNN, FRONT - 0.02, 0.64);
  side.lineTo(FRONT - 0.01, 1.02);
  side.quadraticCurveTo(FRONT - 0.01, 1.12, FRONT - 0.12, BELTE - 0.01);
  side.lineTo(-2.12, BELTE);
  side.quadraticCurveTo(BAK, BELTE, BAK, 1.04);
  side.lineTo(BAK, 0.6);
  side.quadraticCurveTo(BAK, BUNN, -2.16, BUNN);
  for (const s of [-1, 1]) karosseri.add(profil(side, SIDE_X - SKJERM_X + 0.01, 0.09, solv, { midtX: s * (SIDE_X + SKJERM_X - 0.01) / 2, kant: 0.055 }));

  const midt = new THREE.Shape();
  midt.moveTo(-2.16, BUNN);
  midt.lineTo(2.12, BUNN);
  midt.quadraticCurveTo(FRONT - 0.03, BUNN, FRONT - 0.02, 0.64);
  midt.lineTo(FRONT - 0.01, 1.02);
  midt.quadraticCurveTo(FRONT - 0.01, 1.07, FRONT - 0.06, 1.07);   // tverrbjelke over grillen
  midt.lineTo(2.1, 1.07);
  midt.lineTo(2.08, MOTORROM_GULV);
  midt.lineTo(PANSER_Z + 0.04, MOTORROM_GULV);
  midt.lineTo(PANSER_Z, BELTE);                                         // brannvegg
  midt.lineTo(-2.12, BELTE);
  midt.quadraticCurveTo(BAK, BELTE, BAK, 1.04);
  midt.lineTo(BAK, 0.6);
  midt.quadraticCurveTo(BAK, BUNN, -2.16, BUNN);
  karosseri.add(profil(midt, SKJERM_X * 2 + 0.02, 0.05, solv, { kant: 0.04 }));

  // Mørk innerskjerm i hjulbuene, så man ikke ser karosseriet inni buen
  const innerskjerm = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9, side: THREE.DoubleSide });
  for (const s of [-1, 1]) for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
    const geo = new THREE.CylinderGeometry(BUE_R - 0.03, BUE_R - 0.03, SIDE_X - SKJERM_X + 0.04, 32, 1, true, Math.PI / 2 - 1.36, 2.72);
    const m = new THREE.Mesh(geo, innerskjerm);
    m.rotation.z = Math.PI / 2;
    legg(m, s * (SIDE_X + SKJERM_X) / 2, BUE_Y, z);
  }
  // Skjermbreddere i sort plast rundt buene
  for (const s of [-1, 1]) for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
    const f = new THREE.Shape();
    f.absarc(0, 0, BUE_R + 0.1, Math.PI - a0 + 0.02, a0 - 0.02, true);
    f.absarc(0, 0, BUE_R, a0 - 0.02, Math.PI - a0 + 0.02, false);
    const geo = new THREE.ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.018, bevelSegments: 4, curveSegments: 40 });
    const m = new THREE.Mesh(geo, plast);
    m.rotation.y = -Math.PI / 2;
    legg(m, s * (SIDE_X + 0.03) + 0.0175, BUE_Y - 0.005, z);
  }

  // ---------- Kupé: tak, sider med vindushull, bakdør og frontrute ----------
  // Sidene har ekte hull der vinduene er, så man ser inn når glasset blir klart.
  const vinduer = [
    [[0.0, 1.21], [aStolpeZ(1.21) - 0.09, 1.21], [aStolpeZ(1.74) - 0.09, 1.74], [0.0, 1.74]],     // fordør
    [[-1.0, 1.21], [-0.1, 1.21], [-0.1, 1.74], [-1.0, 1.74]],                                    // bakdør
    [[-2.07, 1.21], [-1.1, 1.21], [-1.1, 1.74], [-2.07, 1.74]],                                  // bakre sidevindu
    [[-2.05, 1.8], [-1.42, 1.8], [-1.42, 1.86], [-2.05, 1.86]],                                  // alpine-vindu i det hevede taket
  ];
  const sideOmriss = [[RUTE_FOT.z, RUTE_FOT.y], [RUTE_TOPP.z + 0.02, TAK - 0.03], [TRINN_Z + 0.04, TAK - 0.03],
    [TRINN_Z - 0.04, TAK_BAK - 0.03], [BAK + 0.01, TAK_BAK - 0.03], [BAK + 0.01, BELTE - 0.04]];
  const hull = (pkt, r) => rundForm(pkt, r, new THREE.Path());
  // Flytter hjørnene i et vindu d meter inn mot midten (negativ d gjør vinduet større)
  const inn = (pkt, d) => {
    const cz = pkt.reduce((a, p) => a + p[0], 0) / pkt.length, cy = pkt.reduce((a, p) => a + p[1], 0) / pkt.length;
    return pkt.map(([z, y]) => [z + Math.sign(cz - z) * d, y + Math.sign(cy - y) * d]);
  };
  for (const s of [-1, 1]) {
    const plate = rundForm(sideOmriss, 0.03);
    for (const v of vinduer) plate.holes.push(hull(v, 0.035));
    sideplate(plate, 0.025, solv, s * (KUPE_X - 0.02), 0.012);
    // Sort ramme rundt dørvinduene, som gjør B-stolpen og dørkarmene svarte slik de er på bilen.
    // Hullene er litt mindre enn i platen, så rammen dekker den avrundede lakkanten helt inn til glasset.
    const ramme = rundForm([[-1.07, 1.18], [aStolpeZ(1.18) - 0.055, 1.18], [aStolpeZ(1.77) - 0.055, 1.77], [-1.07, 1.77]], 0.05);
    for (const v of vinduer.slice(0, 2)) ramme.holes.push(hull(inn(v, 0.02), 0.03));
    sideplate(ramme, 0.004, svart, s * (KUPE_X + 0.006));
    // Bakerste sidevindu og alpine-vinduet sitter i lakken, med en smal, sort gummilist rundt glasset
    for (const v of vinduer.slice(2)) {
      const list = rundForm(inn(v, 0.006), 0.03);
      list.holes.push(hull(inn(v, 0.026), 0.025));
      sideplate(list, 0.004, svart, s * (KUPE_X + 0.004));
    }
    // Glass litt inne i åpningene
    for (const v of vinduer) sideplate(rundForm(inn(v, -0.01), 0.035), 0.006, glass, s * (KUPE_X - 0.026));
  }
  // Taket: avrundet over sidene, med trinn opp til det hevede taket bak
  const tak = new THREE.Shape();
  tak.moveTo(RUTE_TOPP.z + 0.05, TAK - 0.09);
  tak.lineTo(RUTE_TOPP.z + 0.03, TAK - 0.03);
  tak.quadraticCurveTo(RUTE_TOPP.z - 0.02, TAK, RUTE_TOPP.z - 0.12, TAK);
  tak.lineTo(TRINN_Z + 0.1, TAK);
  tak.quadraticCurveTo(TRINN_Z + 0.03, TAK, TRINN_Z, (TAK + TAK_BAK) / 2);
  tak.quadraticCurveTo(TRINN_Z - 0.03, TAK_BAK, TRINN_Z - 0.1, TAK_BAK);
  tak.lineTo(BAK + 0.08, TAK_BAK);
  tak.quadraticCurveTo(BAK, TAK_BAK, BAK, TAK_BAK - 0.06);
  tak.lineTo(BAK, TAK_BAK - 0.11);
  tak.lineTo(TRINN_Z - 0.06, TAK_BAK - 0.11);
  tak.lineTo(TRINN_Z + 0.04, TAK - 0.09);
  tak.closePath();
  karosseri.add(profil(tak, KUPE_X * 2, 0.1, solv, { kant: 0.025 }));
  // Bakdøra over beltelinjen, med bakrute
  const bakdor = rundForm([[-KUPE_X, BELTE - 0.04], [KUPE_X, BELTE - 0.04], [KUPE_X, TAK_BAK - 0.06], [-KUPE_X, TAK_BAK - 0.06]], 0.04);
  bakdor.holes.push(hull([[-0.62, 1.24], [0.62, 1.24], [0.62, 1.76], [-0.62, 1.76]], 0.06));
  {
    const geo = new THREE.ExtrudeGeometry(bakdor, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 12 });
    legg(new THREE.Mesh(geo, solv), 0, 0, BAK - 0.03);
    legg(new THREE.Mesh(new THREE.ExtrudeGeometry(rundForm([[-0.64, 1.22], [0.64, 1.22], [0.64, 1.78], [-0.64, 1.78]], 0.07), { depth: 0.006, bevelEnabled: false }), glass), 0, 0, BAK - 0.012);
    // Bred, sort gummilist rundt bakruta, som på bilen
    const list = rundForm([[-0.66, 1.2], [0.66, 1.2], [0.66, 1.8], [-0.66, 1.8]], 0.08);
    list.holes.push(hull([[-0.6, 1.26], [0.6, 1.26], [0.6, 1.74], [-0.6, 1.74]], 0.05));
    const m = legg(new THREE.Mesh(new THREE.ExtrudeGeometry(list, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 }), svart), 0, 0, BAK - 0.052);
    m.castShadow = false;
  }
  // Frontrute med sort ramme, og A-stolper i lakk
  const dz = RUTE_FOT.z - RUTE_TOPP.z, dy = RUTE_TOPP.y - RUTE_FOT.y;
  const ruteLengde = Math.hypot(dz, dy);
  const ruteVinkel = -Math.atan2(dz, dy);
  const ruteMidt = new THREE.Vector3(0, (RUTE_FOT.y + RUTE_TOPP.y) / 2, (RUTE_FOT.z + RUTE_TOPP.z) / 2);
  const rute = legg(new THREE.Mesh(rundBoks(KUPE_X * 2 - 0.1, ruteLengde, 0.01, 0.004), frontGlass), ruteMidt.x, ruteMidt.y, ruteMidt.z);
  rute.rotation.x = ruteVinkel;
  {
    const r = rundForm([[-KUPE_X + 0.02, -ruteLengde / 2 - 0.01], [KUPE_X - 0.02, -ruteLengde / 2 - 0.01], [KUPE_X - 0.02, ruteLengde / 2 + 0.01], [-KUPE_X + 0.02, ruteLengde / 2 + 0.01]], 0.04);
    r.holes.push(hull([[-KUPE_X + 0.1, -ruteLengde / 2 + 0.05], [KUPE_X - 0.1, -ruteLengde / 2 + 0.05], [KUPE_X - 0.1, ruteLengde / 2 - 0.05], [-KUPE_X + 0.1, ruteLengde / 2 - 0.05]], 0.05));
    const m = legg(new THREE.Mesh(new THREE.ExtrudeGeometry(r, { depth: 0.005, bevelEnabled: false }), svart), ruteMidt.x, ruteMidt.y, ruteMidt.z);
    m.rotation.x = ruteVinkel;
    m.translateZ(0.004);
  }
  for (const s of [-1, 1]) {
    const a = legg(new THREE.Mesh(rundBoks(0.07, ruteLengde + 0.06, 0.07, 0.03), solv), s * (KUPE_X - 0.03), ruteMidt.y, ruteMidt.z);
    a.rotation.x = ruteVinkel;
  }
  // Vindusviskere og torpedo (sort list ved frontrutas fot)
  boks(KUPE_X * 2 - 0.06, 0.03, 0.12, 0.012, svart, 0, BELTE + 0.005, RUTE_FOT.z - 0.02);
  for (const x of [-0.4, 0.28]) {
    const v = boks(0.62, 0.012, 0.016, 0.005, svart, x, BELTE + 0.035, RUTE_FOT.z - 0.05);
    v.rotation.z = 0.06;
    v.rotation.x = ruteVinkel;
  }
  // Takrails med føtter
  for (const s of [-1, 1]) {
    boks(0.045, 0.035, 2.3, 0.016, svart, s * 0.66, TAK_BAK + 0.07, -0.95);
    for (const [z, y] of [[0.05, TAK], [-0.95, TAK], [-2.0, TAK_BAK]]) boks(0.055, TAK_BAK + 0.07 - y + 0.02, 0.1, 0.015, svart, s * 0.66, (TAK_BAK + 0.07 + y) / 2, z);
  }
  // Høyt bremselys øverst på bakdøra og bakrutevisker
  boks(0.4, 0.04, 0.03, 0.012, rod, 0, TAK_BAK - 0.04, BAK - 0.05);
  {
    const v = boks(0.5, 0.012, 0.016, 0.005, svart, 0.05, 1.3, BAK - 0.045);
    v.rotation.z = 0.5;
  }

  // ---------- Panser (hengslet ved frontruta, så det kan åpnes) ----------
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.01, PANSER_Z);
  karosseri.add(panser);
  const PANSER_L = FRONT - PANSER_Z + 0.01;
  {
    const p = new THREE.Shape();
    p.moveTo(0, -0.02);
    p.lineTo(PANSER_L - 0.03, -0.035);
    p.quadraticCurveTo(PANSER_L + 0.01, -0.035, PANSER_L + 0.01, 0.0);
    p.quadraticCurveTo(PANSER_L, 0.04, PANSER_L - 0.08, 0.045);
    p.lineTo(0.05, 0.06);
    p.quadraticCurveTo(0, 0.06, 0, 0.03);
    p.closePath();
    const m = profil(p, SKJERM_X * 2 + 0.06, 0.05, solv, { kant: 0.015 });
    panser.add(m);
  }
  // Undersiden av panseret: en innerplate i lakk med store, pregede hull og ribber (gir dybde),
  // lydisolasjon i mørk filt bak hullene, panserlås, gummistopp, spylerdyser og hengsler.
  {
    const PB = SKJERM_X - 0.03;                       // halv bredde på innerplaten
    const Z0 = 0.06, Z1 = PANSER_L - 0.07;            // fra bakkant til forkant
    const ytre = rundForm([[-PB, Z0], [PB, Z0], [PB, Z1], [-PB, Z1]], 0.06);
    // To rader med tre hull hver, og en ribbe på langs i midten
    const hullB = (PB * 2 - 0.2) / 3 - 0.04;
    for (const [za, zb] of [[Z0 + 0.1, (Z0 + Z1) / 2 - 0.05], [(Z0 + Z1) / 2 + 0.05, Z1 - 0.12]]) {
      for (let i = 0; i < 3; i++) {
        const xa = -PB + 0.1 + i * (hullB + 0.06), xb = xa + hullB;
        ytre.holes.push(hull([[xa, za], [xb, za], [xb, zb], [xa, zb]], 0.07));
      }
    }
    const innerGeo = new THREE.ExtrudeGeometry(ytre, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 12 });
    innerGeo.rotateX(Math.PI / 2);                    // formen ligger i (x, z), tykkelsen går nedover
    legg(new THREE.Mesh(innerGeo, solv), 0, -0.07, 0, panser);
    // Kantflens rundt platen opp mot panserhuden, så platen ser ut til å henge under panseret
    for (const s of [-1, 1]) boks(0.025, 0.04, Z1 - Z0, 0.01, solv, s * (PB - 0.01), -0.06, (Z0 + Z1) / 2, panser);
    boks(PB * 2, 0.04, 0.025, 0.01, solv, 0, -0.06, Z1 - 0.01, panser);
    // Ribber på tvers mellom hullradene og på langs i midten
    boks(PB * 2 - 0.1, 0.03, 0.05, 0.012, solv, 0, -0.1, (Z0 + Z1) / 2, panser);
    boks(0.05, 0.025, Z1 - Z0 - 0.15, 0.012, solv, 0, -0.098, (Z0 + Z1) / 2, panser);
    // Lydisolasjon: mørk, quiltet filt rett under huden
    const filtTekstur = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#26272a'; g.fillRect(0, 0, 128, 128);
      const tf = lagFrø(23);
      for (let i = 0; i < 2500; i++) { const v = 28 + Math.floor(tf() * 22); g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(tf() * 128, tf() * 128, 1, 1); }
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2;
      for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(128, x); g.stroke(); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(5, 6);
      return tx;
    })();
    const filt = new THREE.MeshStandardMaterial({ map: filtTekstur, roughness: 1 });
    boks(PB * 2 - 0.06, 0.012, Z1 - Z0 - 0.04, 0.006, filt, 0, -0.043, (Z0 + Z1) / 2, panser);
    // Panserlås foran på midten (bøyle) og gummistopp i hjørnene
    const bøyle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 16, Math.PI), aluminium);
    bøyle.rotation.set(0, Math.PI / 2, Math.PI);
    legg(bøyle, 0, -0.1, Z1 - 0.04, panser);
    boks(0.1, 0.02, 0.05, 0.008, svart, 0, -0.095, Z1 - 0.04, panser);
    for (const s of [-1, 1]) {
      sylinder(0.016, 0.02, 0.03, gummi, s * (PB - 0.06), -0.105, Z1 - 0.05, 'y', panser, 12);
      // Hengsler bak og spylerdyser med slange
      boks(0.04, 0.05, 0.1, 0.01, svart, s * (PB - 0.04), -0.07, 0.04, panser);
      sylinder(0.01, 0.012, 0.03, svart, s * 0.25, 0.07, 0.12, 'y', panser, 10);
      panser.add(slange([[s * 0.25, -0.05, 0.12], [s * 0.18, -0.08, 0.2], [0, -0.08, 0.24], [0, -0.07, 0.05]], 0.005, gummi));
    }
    // Klips for panserstaget
    boks(0.03, 0.02, 0.06, 0.008, svart, PB - 0.08, -0.095, Z1 - 0.35, panser);
  }
  {
    const navn = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.06), new THREE.MeshStandardMaterial({
      map: tekstTekstur('LAND ROVER', { font: '700 46px "Helvetica Neue", Arial, sans-serif', sperring: 14, farge: '#5f6267' }), transparent: true, metalness: 0.7, roughness: 0.3,
    }));
    // Bokstavene står på den avrundede forkanten av panseret, så de synes forfra
    navn.rotation.x = -0.75;
    legg(navn, 0, 0.042, PANSER_L + 0.012, panser);
  }

  // ---------- Motorrommet (Td5) ----------
  const motor = new THREE.Group();
  karosseri.add(motor);
  boks(SKJERM_X * 2 - 0.02, 0.01, 1.3, 0.004, svart, 0, MOTORROM_GULV + 0.005, 1.43, motor);           // mørk bunn
  boks(SKJERM_X * 2 - 0.02, BELTE - MOTORROM_GULV - 0.02, 0.02, 0.008, svart, 0, (BELTE + MOTORROM_GULV) / 2, PANSER_Z + 0.05, motor); // brannvegg
  // Radiator med kjøleribber og vifte bak
  {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#3d4046'; g.lineWidth = 1;
    for (let x = 0; x < 128; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    boks(1.1, 0.24, 0.05, 0.01, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.3 }), 0, 0.93, 2.06, motor);
  }
  boks(1.14, 0.04, 0.08, 0.015, svart, 0, 1.065, 2.06, motor);
  sylinder(0.16, 0.16, 0.06, svart, 0, 0.93, 1.99, 'z', motor);
  // Motorblokk, ventildeksel og motordeksel i sort plast med «Td5»
  boks(0.6, 0.2, 0.74, 0.03, motorMat, 0.02, 0.92, 1.47, motor);
  boks(0.54, 0.06, 0.7, 0.02, motorMat, 0.02, 1.04, 1.47, motor);
  boks(0.5, 0.06, 0.6, 0.03, motordeksel, 0.02, 1.08, 1.5, motor);
  {
    const merke = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshStandardMaterial({
      map: tekstTekstur('Td5', { bredde: 256, hoyde: 80, font: 'italic 800 64px Arial, sans-serif', farge: '#c9ccd1' }), transparent: true,
    }));
    merke.rotation.x = -Math.PI / 2;
    legg(merke, 0.02, 1.112, 1.6, motor);
  }
  for (let i = 0; i < 5; i++) boks(0.4, 0.008, 0.012, 0.004, aluminium, 0.02, 1.112, 1.36 + i * 0.05, motor);   // ribber
  // Oljelokk og oljefilter (blir grønne i motorrom-seksjonen)
  const oljelokk = sylinder(0.055, 0.055, 0.045, oljeMat, 0.17, 1.125, 1.34, 'y', motor, 24);
  const oljefilter = sylinder(0.065, 0.065, 0.15, oljeMat, 0.4, 0.92, 1.58, 'x', motor, 24);
  // Peilestav med gult håndtak
  const peil = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.5 }));
  peil.rotation.y = Math.PI / 2;
  legg(peil, -0.27, 1.07, 1.72, motor);
  // Turbo og eksosmanifold med varmeskjold på høyre side
  boks(0.04, 0.12, 0.5, 0.015, aluminium, -0.3, 0.93, 1.45, motor);
  sylinder(0.07, 0.07, 0.08, aluminium, -0.36, 0.92, 1.2, 'x', motor, 24);
  // Luftfilterboks foran til venstre, med inntak fra skjermen og slange til turboen
  boks(0.3, 0.16, 0.42, 0.04, svart, 0.43, 0.96, 1.9, motor);
  sylinder(0.06, 0.06, 0.1, svart, 0.43, 0.96, 2.14, 'z', motor, 20);
  motor.add(slange([[0.43, 0.97, 1.68], [0.38, 0.99, 1.4], [0.1, 1.0, 1.14], [-0.3, 0.96, 1.2]], 0.045, gummi));
  // Intercooler-rør og øvre radiatorslange
  motor.add(slange([[-0.36, 0.95, 1.22], [-0.48, 1.0, 1.55], [-0.45, 1.02, 1.95], [-0.3, 1.02, 2.02]], 0.035, gummi));
  motor.add(slange([[0.2, 1.02, 2.02], [0.18, 1.05, 1.86], [0.12, 1.05, 1.82]], 0.025, gummi));
  // Batteri foran til høyre med pluss (rød) og minus
  boks(0.28, 0.18, 0.2, 0.02, new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 }), -0.42, 0.9, 1.88, motor);
  boks(0.04, 0.03, 0.04, 0.01, new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.5 }), -0.34, 1.0, 1.84, motor);
  boks(0.04, 0.03, 0.04, 0.01, svart, -0.5, 1.0, 1.84, motor);
  // Ekspansjonstank (kjølevæske) med blått lokk, spylervæske og bremsevæske med gule/sorte lokk
  boks(0.16, 0.14, 0.24, 0.04, beholder, 0.47, 0.98, 1.12, motor);
  sylinder(0.035, 0.035, 0.03, new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.5 }), 0.47, 1.065, 1.12, 'y', motor, 20);
  boks(0.14, 0.14, 0.16, 0.04, new THREE.MeshPhysicalMaterial({ color: 0xd9e6f2, roughness: 0.3, transparent: true, opacity: 0.85 }), -0.5, 0.96, 1.08, motor);
  sylinder(0.03, 0.03, 0.03, new THREE.MeshStandardMaterial({ color: 0x2f7de0, roughness: 0.5 }), -0.5, 1.045, 1.08, 'y', motor, 20);
  // Bremsepumpe med servo på førersiden ved brannveggen
  sylinder(0.15, 0.15, 0.1, svart, 0.38, 0.97, 0.88, 'z', motor, 32);
  sylinder(0.03, 0.03, 0.14, aluminium, 0.38, 0.97, 1.0, 'z', motor, 16);
  boks(0.1, 0.06, 0.06, 0.02, beholder, 0.38, 1.04, 1.0, motor);
  sylinder(0.025, 0.025, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0.38, 1.08, 1.0, 'y', motor, 16);
  // Sikringsboks og ledningsnett
  boks(0.16, 0.08, 0.14, 0.02, svart, -0.48, 1.0, 0.92, motor);
  motor.add(slange([[-0.48, 1.0, 0.98], [-0.35, 1.06, 1.2], [-0.12, 1.08, 1.75], [-0.3, 1.0, 1.84]], 0.012, svart));
  // Panserstag
  {
    const stag = boks(0.012, 0.012, 0.5, 0.005, aluminium, 0.58, 0.9, 1.95, motor);
    stag.rotation.x = 0.05;
  }

  // ---------- Front (facelift 2003–2004): grill, lykter, støtfanger ----------
  const FRONT_Z = FRONT + 0.035;
  // Bred, mørk grill med vannrette lameller og Land Rover-merket ute til venstre (sett forfra: til høyre)
  boks(0.86, 0.2, 0.04, 0.03, svart, 0, 0.95, FRONT_Z - 0.015);
  for (let i = 0; i < 5; i++) boks(0.82, 0.014, 0.025, 0.006, plast, 0, 0.875 + i * 0.036, FRONT_Z + 0.005);
  {
    const merke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 40), new THREE.MeshPhysicalMaterial({ color: 0x0e4a28, metalness: 0.4, roughness: 0.15, clearcoat: 1 }));
    merke.scale.set(1.6, 1, 0.75);
    merke.rotation.x = Math.PI / 2;
    legg(merke, 0.3, 0.95, FRONT_Z + 0.03);
    const kant = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 40), krom);
    kant.scale.set(1.6, 0.75, 1);
    legg(kant, 0.3, 0.95, FRONT_Z + 0.034);
  }
  // Lyktene: én klar lyktenhet per side med en stor og en liten rund lampe, blinklys ytterst nede.
  // Huset er mørkegrått med myke kanter, og glasset ligger flatt foran, så kantene blir rolige.
  // Lysene står på (kjørelys er påbudt i Norge): varmt, gult halogenlys som ikke blender.
  const lampeGlod = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc977, emissiveIntensity: 1.1, roughness: 0.4 });
  const glorie = glorieTekstur();
  for (const s of [-1, 1]) {
    const lykt = new THREE.Group();
    lykt.position.set(s * 0.66, 0.96, FRONT_Z);
    karosseri.add(lykt);
    boks(0.41, 0.25, 0.06, 0.04, plast, 0, 0, -0.012, lykt);
    boks(0.37, 0.21, 0.01, 0.03, new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.9, roughness: 0.25 }), 0, 0, 0.014, lykt);
    for (const [dx, r] of [[0.085, 0.078], [-0.1, 0.058]]) {
      const x = s * dx;
      sylinder(r, r * 0.8, 0.03, reflektor, x, 0.012, 0.03, 'z', lykt, 40);
      legg(new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 16, 12), lampeGlod), x, 0.012, 0.043, lykt);
      legg(new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 40), krom), x, 0.012, 0.046, lykt);
      // Svak glød rundt lampen
      const g = new THREE.Mesh(new THREE.PlaneGeometry(r * 4.2, r * 4.2), new THREE.MeshBasicMaterial({
        map: glorie, color: 0xffc46b, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      g.position.set(x, 0.012, 0.075);
      g.renderOrder = 5;
      lykt.add(g);
    }
    boks(0.09, 0.035, 0.02, 0.012, oransje, s * 0.13, -0.085, 0.03, lykt);
    const lgl = boks(0.39, 0.23, 0.012, 0.006, lyktGlass, 0, 0, 0.056, lykt);
    lgl.castShadow = false;
    boks(0.02, 0.035, 0.08, 0.012, oransje, s * (SIDE_X + 0.004), 0.98, 1.98);   // blinklys på skjermen
    // Lyskjegle framover: svakt og varmt, uten skygger
    const kjegle = new THREE.SpotLight(0xffc982, 32, 24, 0.5, 0.8, 1.4);
    kjegle.position.set(s * 0.66, 0.97, FRONT_Z + 0.1);
    kjegle.target.position.set(s * 0.9, 0, FRONT_Z + 7);
    karosseri.add(kjegle, kjegle.target);
  }
  // Støtfanger i lakk som går rundt hjørnene, med runde tåkelys, skilt og sort list nederst
  boks(1.98, 0.22, 0.3, 0.1, solv, 0, 0.62, 2.24);
  boks(1.9, 0.09, 0.26, 0.04, svart, 0, 0.47, 2.25);
  boks(0.9, 0.05, 0.04, 0.02, svart, 0, 0.49, 2.385);                     // luftinntak
  for (const s of [-1, 1]) {
    boks(0.17, 0.15, 0.03, 0.06, svart, s * 0.74, 0.62, 2.385);
    sylinder(0.055, 0.05, 0.03, reflektor, s * 0.74, 0.62, 2.395, 'z', karosseri, 32);
    sylinder(0.058, 0.058, 0.01, lyktGlass, s * 0.74, 0.62, 2.41, 'z', karosseri, 32);
  }
  {
    const krok = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 20), aluminium);
    legg(krok, 0.45, 0.45, 2.38);
  }

  // ---------- Sider ----------
  const fuge = new THREE.MeshBasicMaterial({ color: 0x1a1a1c });
  for (const s of [-1, 1]) {
    const x = s * (SIDE_X + 0.001);
    // Dørfuger (fordør, bakdør rundt hjulbuen)
    boks(0.004, BELTE - BUNN - 0.08, 0.006, 0.001, fuge, x, (BELTE + BUNN) / 2, 0.7);
    boks(0.004, BELTE - BUNN - 0.08, 0.006, 0.001, fuge, x, (BELTE + BUNN) / 2, -0.08);
    boks(0.004, BELTE - 0.95, 0.006, 0.001, fuge, x, (BELTE + 0.95) / 2 - 0.02, -1.05);
    // Dørhåndtak i sort med krom
    // Trinnbrett i aluminium under dørene
    boks(0.16, 0.035, 1.42, 0.015, aluminium, s * (SIDE_X + 0.01), 0.4, -0.03);
    boks(0.12, 0.02, 1.36, 0.008, svart, s * (SIDE_X + 0.01), 0.42, -0.03);
    for (const z of [0.48, -0.3]) {
      boks(0.03, 0.04, 0.18, 0.015, svart, s * (SIDE_X + 0.012), 1.05, z);
      boks(0.006, 0.012, 0.15, 0.004, krom, s * (SIDE_X + 0.028), 1.05, z);
    }
    // Dørlås på fordøra
    sylinder(0.012, 0.012, 0.01, krom, s * (SIDE_X + 0.01), 1.05, 0.33, 'x');
    // Terskel
    boks(0.14, 0.07, 1.5, 0.03, plast, s * (SIDE_X - 0.04), 0.47, -0.02);
    // Speil i lakk på sort fot. Huset og glasset er én gruppe, så glasset sitter flatt i huset.
    boks(0.1, 0.06, 0.12, 0.025, svart, s * 0.92, 1.22, 0.54);
    const speil = new THREE.Group();
    speil.position.set(s * 1.04, 1.31, 0.52);
    speil.rotation.y = s * -0.12;
    karosseri.add(speil);
    boks(0.24, 0.18, 0.11, 0.035, solv, 0, 0, 0, speil);
    boks(0.19, 0.13, 0.012, 0.006, svart, 0, 0, -0.052, speil);                     // sort kant rundt glasset
    const speilglass = new THREE.Mesh(new THREE.ExtrudeGeometry(rundForm([[-0.085, -0.055], [0.085, -0.055], [0.085, 0.055], [-0.085, 0.055]], 0.02), { depth: 0.004, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 1, roughness: 0.04 }));
    speilglass.rotation.y = Math.PI;
    legg(speilglass, 0, 0, -0.058, speil);
  }
  // Tanklokk (høyre bakskjerm)
  sylinder(0.08, 0.08, 0.008, solv, -(SIDE_X + 0.004), 0.98, -1.78, 'x');

  // ---------- Bak ----------
  const BAK_Z = BAK - 0.045;                         // utsiden av bakdøra
  for (const s of [-1, 1]) {
    // Høye baklys i sort ramme på bakstolpene: rødt øverst, så blinklys og ryggelys
    boks(0.15, 0.6, 0.05, 0.04, svart, s * 0.8, 1.47, BAK - 0.02);
    boks(0.12, 0.3, 0.05, 0.035, rod, s * 0.8, 1.6, BAK - 0.03);
    for (let i = 0; i < 4; i++) boks(0.115, 0.008, 0.01, 0.003, new THREE.MeshStandardMaterial({ color: 0x5a0a0e, roughness: 0.3 }), s * 0.8, 1.49 + i * 0.07, BAK - 0.058);
    boks(0.12, 0.11, 0.05, 0.03, oransje, s * 0.8, 1.38, BAK - 0.03);
    boks(0.12, 0.09, 0.05, 0.03, hvitLykt, s * 0.8, 1.26, BAK - 0.03);
    // Lys i støtfangeren: blinklys ytterst og rødt innenfor
    boks(0.12, 0.06, 0.03, 0.02, oransje, s * 0.86, 0.6, BAK - 0.12);
    boks(0.18, 0.06, 0.03, 0.02, rod, s * 0.68, 0.6, BAK - 0.12);
    // Dørfuger rundt bakdøra
    boks(0.006, 1.12, 0.004, 0.001, fuge, s * 0.725, 1.29, BAK_Z);
    // Skvettlapper bak bakhjulene
    boks(0.26, 0.24, 0.012, 0.01, gummi, s * SPORVIDDE, 0.24, BAKAKSEL_Z - 0.48);
  }
  boks(1.45, 0.006, 0.004, 0.001, fuge, 0, 0.73, BAK_Z);
  // Støtfanger i sort plast med trinnplate i midten og rødt tåkebaklys
  boks(2.0, 0.26, 0.28, 0.11, plast, 0, 0.58, BAK + 0.03);
  boks(0.62, 0.025, 0.16, 0.01, aluminium, 0, 0.715, BAK - 0.06);
  for (let i = 0; i < 6; i++) boks(0.58, 0.006, 0.012, 0.003, svart, 0, 0.73, BAK - 0.12 + i * 0.024);
  boks(0.08, 0.05, 0.02, 0.015, rod, -0.42, 0.52, BAK - 0.12);
  // Skiltet sitter på døra til venstre sett bakfra (bilens venstre side, +x), med håndtak og skiltlys over
  boks(0.56, 0.15, 0.02, 0.012, svart, 0.48, 0.9, BAK_Z - 0.005);
  boks(0.32, 0.075, 0.04, 0.02, svart, 0.48, 1.06, BAK_Z - 0.01);
  boks(0.2, 0.025, 0.02, 0.008, krom, 0.48, 1.05, BAK_Z - 0.03);
  sylinder(0.028, 0.028, 0.012, krom, 0.16, 1.06, BAK_Z - 0.006, 'z');               // lås
  // «DISCOVERY» og «Td5» på døra
  const bakMerke = (tekst, b, x, y, opts) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b, b * 0.14), new THREE.MeshStandardMaterial({
      map: tekstTekstur(tekst, opts), transparent: true, metalness: 0.7, roughness: 0.3,
    }));
    m.rotation.y = Math.PI;
    legg(m, x, y, BAK_Z - 0.002);
  };
  bakMerke('DISCOVERY', 0.46, 0.42, 0.77, { font: '700 46px "Helvetica Neue", Arial, sans-serif', sperring: 10, farge: '#3a3c40' });
  bakMerke('Td5', 0.16, -0.6, 0.77, { bredde: 256, hoyde: 80, font: 'italic 800 64px Arial, sans-serif', farge: '#c9ccd1' });
  // Reservehjul litt til høyre på døra sett bakfra, i sort deksel med Land Rover-merket
  const RX = -0.2, RY = 1.04;
  boks(0.16, 0.5, 0.06, 0.02, svart, RX, RY, BAK_Z - 0.03);                            // feste
  const reserve = sylinder(0.36, 0.36, 0.22, gummi, RX, RY, BAK - 0.17, 'z', karosseri, 48);
  const deksel = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.37, 0.04, 48), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.75 }));
  deksel.rotation.x = Math.PI / 2;
  legg(deksel, RX, RY, BAK - 0.29);
  {
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ map: landRoverLogo(), roughness: 0.5 }));
    logo.scale.set(1.5, 0.75, 1);
    logo.rotation.y = Math.PI;
    legg(logo, RX, RY, BAK - 0.312);
  }
  // Hengerfeste med kule og eksosrør
  boks(0.12, 0.08, 0.3, 0.02, svart, 0, 0.47, BAK - 0.24);
  sylinder(0.035, 0.035, 0.12, aluminium, 0.55, 0.46, BAK - 0.08, 'z', karosseri, 16);
  void reserve;

  // ---------- Hjul ----------
  const dekkMat = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.85 });
  const felgMat = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd1, metalness: 0.95, roughness: 0.22, clearcoat: 0.6 });
  const skiveMat = new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.9, roughness: 0.35 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.4, roughness: 0.5 });
  const klossMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.8 });

  const hjul = [];
  const hjulStille = [];             // bremsene, som ikke snurrer (men svinger med i spillet)
  const hotspots = {};
  const felles = { dekk: dekkGeo(HJULRADIUS, 0.25, 0.135), felg: felgGeo(0.255, { eiker: 10, eikeBredde: 0.1, indre: 0.09 }) };
  for (const s of [-1, 1]) {
    for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
      const { spinn, stille, mønsterpunkt } = lagHjul({ dekkMat, felgMat, skiveMat, caliperMat, klossMat, plast: svart }, s, felles);
      spinn.position.set(s * SPORVIDDE, HJULRADIUS, z);
      stille.position.copy(spinn.position);
      gruppe.add(spinn, stille);
      hjul.push(spinn);
      hjulStille.push(stille);
      if (s === 1 && z === FORAKSEL_Z) {
        hotspots.bremser = stille.getObjectByName('bremsepunkt');
        hotspots.dekk = mønsterpunkt;
      }
    }
  }
  hotspots.motor = oljelokk;

  // Statusmarkering: delene er nøytrale til kameraet zoomer inn
  const markerbare = {
    motor: [oljeMat],
    bremser: [klossMat, caliperMat],   // hele bremsen: klosser og kaliper
    dekk: [dekkMat],
  };
  const grunnfarge = new Map();
  for (const liste of Object.values(markerbare)) for (const m of liste) grunnfarge.set(m, m.color.clone());
  void oljefilter;

  // kritisk: delen blinker rolig i rødt, i stedet for den svake pulsen
  function marker(navn, styrke, farge, tid, kritisk = false) {
    const puls = kritisk ? 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(tid * 3.4)) : 0.75 + 0.25 * Math.sin(tid * 4);
    for (const m of markerbare[navn]) {
      m.color.copy(grunnfarge.get(m)).lerp(farge, styrke * (navn === 'dekk' ? 0.2 : 0.8));
      m.emissive.copy(farge).multiplyScalar(styrke * puls * (navn === 'dekk' ? (kritisk ? 0.4 : 0.22) : 0.9));
    }
  }

  // ---------- Kupéen: seter, ratt og en sjiraff som kjører (vises når bilen skannes) ----------
  const interior = new THREE.Group();
  interior.visible = false;
  karosseri.add(interior);
  const skinn = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.8 });
  const som = new THREE.MeshStandardMaterial({ color: 0x2a2421, roughness: 0.9 });          // sømmer og kantbånd
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.7 });
  const kledning = new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.85 });   // dørsider og konsoll
  const teppe = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 1 });
  const himling = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.95 });
  const iboks = (b, h, l, mat, x, y, z, rx = 0, r = 0.04) => {
    const m = boks(b, h, l, r, mat, x, y, z, interior);
    m.rotation.x = rx;
    m.castShadow = false;
    return m;
  };
  const isyl = (r1, r2, h, mat, x, y, z, akse) => {
    const m = sylinder(r1, r2, h, mat, x, y, z, akse, interior, 16);
    m.castShadow = false;
    return m;
  };
  // Gulv med teppe, himling og bagasjerom
  iboks(KUPE_X * 2 - 0.1, 0.03, 2.75, teppe, 0, 0.6, -0.68, 0, 0.01);
  iboks(KUPE_X * 2 - 0.12, 0.02, 1.5, himling, 0, TAK - 0.06, -0.5, 0, 0.01);
  iboks(KUPE_X * 2 - 0.12, 0.02, 0.85, himling, 0, TAK_BAK - 0.06, -1.72, 0, 0.01);
  iboks(KUPE_X * 2 - 0.12, 0.04, 0.5, teppe, 0, 0.82, -1.92, 0, 0.01);

  // Dashbord: buet profil fra frontruta og ned mot fotbrønnen
  {
    const d = new THREE.Shape();
    d.moveTo(RUTE_FOT.z - 0.02, BELTE + 0.0);
    d.lineTo(0.4, BELTE + 0.06);
    d.quadraticCurveTo(0.3, BELTE + 0.08, 0.29, BELTE - 0.02);
    d.lineTo(0.31, 0.92);
    d.quadraticCurveTo(0.33, 0.84, 0.42, 0.82);
    d.lineTo(0.62, 0.8);
    d.closePath();
    const m = profil(d, KUPE_X * 2 - 0.1, 0.03, dashMat, { kant: 0.02 });
    m.castShadow = false;
    interior.add(m);
  }
  // Instrumenthus foran rattet med to store og to små målere
  iboks(0.46, 0.1, 0.18, dashMat, 0.42, BELTE + 0.1, 0.38, -0.15, 0.04);
  {
    const maaler = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.11), new THREE.MeshBasicMaterial({ map: instrumentTekstur() }));
    maaler.rotation.set(-0.35, Math.PI, 0);
    maaler.position.set(0.42, BELTE + 0.08, 0.288);
    interior.add(maaler);
  }
  // Midtkonsoll med radio, varmekontroller og luftdyser
  iboks(0.34, 0.34, 0.12, dashMat, 0, 1.0, 0.36);
  {
    const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: radioTekstur() }));
    radio.rotation.y = Math.PI;
    radio.position.set(0, 1.0, 0.298);
    interior.add(radio);
  }
  for (const x of [-0.1, 0.1]) iboks(0.11, 0.05, 0.02, kledning, x, 1.13, 0.3, 0, 0.01);       // dyser i midten
  for (const s of [-1, 1]) isyl(0.04, 0.04, 0.02, kledning, s * 0.72, 1.1, 0.33, 'z');           // runde dyser ytterst
  iboks(0.38, 0.006, 0.01, som, -0.42, 0.98, 0.315, 0, 0.002);                                 // hanskerom-fuge
  // Konsoll mellom forsetene: girspak, giret for lavt/høyt og håndbrekk, koppholdere
  iboks(0.24, 0.2, 0.75, kledning, 0, 0.72, -0.02);
  iboks(0.22, 0.03, 0.3, kledning, 0, 0.84, -0.32, 0, 0.012);                                  // armlene
  for (const [x, z, h, r] of [[0.03, 0.18, 0.18, 0.028], [-0.06, 0.12, 0.12, 0.022]]) {
    isyl(0.008, 0.008, h, krom, x, 0.82 + h / 2, z, 'y');
    const knott = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), dashMat);
    knott.position.set(x, 0.82 + h, z);
    interior.add(knott);
    iboks(0.08, 0.01, 0.08, som, x, 0.825, z, 0, 0.004);                                       // mansjett
  }
  iboks(0.04, 0.03, 0.22, dashMat, 0.06, 0.86, -0.08, 0.25, 0.012);                            // håndbrekk
  for (const z of [0.0, 0.07]) isyl(0.03, 0.03, 0.006, som, -0.06, 0.825, z - 0.12, 'y');

  // Forsetene: sete og rygg med sidestøtter, sømmer og nakkestøtte på krompinner
  for (const sx of [-1, 1]) {
    const x = sx * 0.42;
    iboks(0.5, 0.12, 0.5, skinn, x, 0.76, -0.14, 0, 0.05);
    for (const k of [-1, 1]) iboks(0.08, 0.08, 0.48, skinn, x + k * 0.22, 0.84, -0.14, 0, 0.035);
    iboks(0.48, 0.004, 0.006, som, x, 0.821, -0.06, 0, 0.002);
    iboks(0.48, 0.6, 0.12, skinn, x, 1.12, -0.42, -0.12, 0.05);
    for (const k of [-1, 1]) iboks(0.08, 0.56, 0.1, skinn, x + k * 0.22, 1.1, -0.39, -0.12, 0.035);
    iboks(0.004, 0.5, 0.006, som, x - 0.14, 1.12, -0.355, -0.12, 0.002);
    iboks(0.004, 0.5, 0.006, som, x + 0.14, 1.12, -0.355, -0.12, 0.002);
    for (const k of [-1, 1]) isyl(0.006, 0.006, 0.08, krom, x + k * 0.07, 1.47, -0.49, 'y');
    iboks(0.27, 0.15, 0.1, skinn, x, 1.55, -0.5, -0.12, 0.045);
    // Sikkerhetsbelte fra B-stolpen
    const belte = iboks(0.05, 0.6, 0.008, svart, sx * (KUPE_X - 0.08), 1.25, -0.42, 0, 0.003);
    belte.rotation.z = sx * 0.15;
  }
  // Baksetet: delt rygg med tre nakkestøtter
  iboks(1.42, 0.13, 0.5, skinn, 0, 0.8, -1.3, 0, 0.05);
  iboks(1.42, 0.004, 0.006, som, 0, 0.866, -1.22, 0, 0.002);
  for (const [x, b] of [[-0.24, 0.92], [0.47, 0.46]]) iboks(b, 0.58, 0.12, skinn, x, 1.14, -1.58, -0.1, 0.05);
  for (const x of [-0.48, 0, 0.48]) {
    for (const k of [-1, 1]) isyl(0.006, 0.006, 0.08, krom, x + k * 0.06, 1.47, -1.64, 'y');
    iboks(0.24, 0.13, 0.09, skinn, x, 1.54, -1.65, -0.1, 0.04);
  }
  // Dørsider: kledning med armlene, dørhåndtak og høyttaler
  const hoyttaler = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const x = s * (KUPE_X - 0.055);
    for (const [z1, z2] of [[0.66, -0.06], [-0.1, -1.03]]) {
      const zm = (z1 + z2) / 2, l = z1 - z2;
      iboks(0.03, 0.52, l, kledning, x, 0.9, zm, 0, 0.012);
      iboks(0.07, 0.04, l * 0.55, som, x - s * 0.03, 0.95, zm - l * 0.1, 0, 0.015);              // armlene
      iboks(0.02, 0.03, 0.08, krom, x - s * 0.02, 1.06, zm + l * 0.3, 0, 0.008);                  // håndtak
      isyl(0.06, 0.06, 0.012, hoyttaler, x - s * 0.018, 0.74, zm + l * 0.25, 'x');
    }
    iboks(0.03, 0.5, 1.05, kledning, x, 0.95, -1.62, 0, 0.012);                                     // bagasjerommet
    iboks(0.02, 0.03, 0.18, kledning, x - s * 0.01, TAK - 0.12, -0.3, 0, 0.01);                     // takhåndtak
  }
  // Innvendig speil og solskjermer
  iboks(0.22, 0.06, 0.02, dashMat, 0, TAK - 0.16, RUTE_TOPP.z - 0.02, 0, 0.012);
  for (const s of [-1, 1]) iboks(0.36, 0.012, 0.16, himling, s * 0.4, TAK - 0.1, RUTE_TOPP.z - 0.1, 0.15, 0.006);

  // Ratt på venstre side (førersiden i Norge; bilens venstre er +x), med kollisjonspute og hendler
  const ratt = new THREE.Group();
  ratt.position.set(0.42, 1.3, 0.22);
  ratt.rotation.x = -1.05;
  interior.add(ratt);
  const rattring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 10, 36), dashMat);
  rattring.rotation.x = Math.PI / 2;
  ratt.add(rattring);
  for (let i = 0; i < 3; i++) {
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.04), dashMat);
    eike.rotation.y = (i / 3) * Math.PI * 2 - Math.PI / 2;
    eike.position.x = Math.cos(eike.rotation.y) * 0.08;
    eike.position.z = -Math.sin(eike.rotation.y) * 0.08;
    ratt.add(eike);
  }
  const pute = new THREE.Mesh(rundBoks(0.15, 0.05, 0.12, 0.02), dashMat);
  pute.position.y = 0.02;
  ratt.add(pute);
  const merkeLiten = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x0e4a28, roughness: 0.3 }));
  merkeLiten.scale.set(1.5, 1, 0.75);
  merkeLiten.position.y = 0.047;
  ratt.add(merkeLiten);
  const ror = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 12), dashMat);
  ror.position.set(0, -0.15, 0);
  ratt.add(ror);
  for (const s of [-1, 1]) {
    const hendel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.016), dashMat);
    hendel.position.set(s * 0.09, -0.06, 0.0);
    ratt.add(hendel);
  }
  // Sjåføren: en mindre sjiraff i førersetet
  const sjafor = lagSjiraff();
  sjafor.gruppe.scale.setScalar(0.48);
  sjafor.gruppe.position.set(0.42, 0.47, -0.14);
  interior.add(sjafor.gruppe);

  // Skanning: en lysende flate som glir over bilen og en tynn ramme rundt
  const skannMat = new THREE.MeshBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const skannFlate = new THREE.Mesh(new THREE.BoxGeometry(BREDDE + 0.12, 2.2, 0.04), skannMat);
  skannFlate.position.y = 1.1;
  skannFlate.visible = false;
  gruppe.add(skannFlate);
  const skannRamme = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BREDDE + 0.4, 2.35, FRONT - BAK + 0.6)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }),
  );
  skannRamme.position.set(0, 1.08, (FRONT + BAK) / 2 - 0.05);
  skannRamme.renderOrder = 10;
  gruppe.add(skannRamme);

  // Punkter for knappene: fem over bilen (i to høyder) og én nederst på siden.
  // main.js dytter knappene fra hverandre hvis de likevel havner oppå hverandre.
  const knappepunkter = {};
  for (const [navn, x, y, z] of [
    ['bil-1', 0.3, 2.45, 1.7], ['bil-2', 0.3, 3.25, 0.6], ['bil-3', 0.3, 2.45, -0.5],
    ['bil-4', 0.3, 3.25, -1.6], ['bil-5', 0.3, 2.45, -2.6],
    ['bil-apne', BREDDE / 2, 0.42, -0.05],
  ]) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    gruppe.add(o);
    knappepunkter[navn] = o;
  }

  // Der spillet fester skiltet: foran og bak på støtfangerne
  const skiltFeste = [{ x: 0, y: 0.62, z: 2.401, ry: 0 }, { x: 0.48, y: 0.9, z: BAK - 0.064, ry: Math.PI }];

  // styrke 0..1: hvor gjennomsiktig glasset er og hvor synlig skanningen er
  const glod = new THREE.Color(0x9cc8ff);
  function skann(styrke, tid, hover = 0) {
    for (const g of glassListe) {
      g.opacity = 1 - styrke * 0.9;
      g.depthWrite = styrke < 0.05;
    }
    glass.metalness = 0.3 - styrke * 0.25;             // mindre speiling, så man ser inn
    solv.emissive.copy(glod).multiplyScalar(hover * 0.14 * (0.8 + 0.2 * Math.sin(tid * 3)));
    interior.visible = styrke > 0.02;
    if (interior.visible) sjafor.oppdater(tid + 3);
    skannFlate.visible = styrke > 0.02;
    skannMat.opacity = styrke * 0.28;
    const t = (tid * 0.45) % 1;                       // glir fra front til bak og starter på nytt
    skannFlate.position.z = THREE.MathUtils.lerp(FRONT + 0.15, BAK - 0.15, t);
    skannRamme.material.opacity = styrke * (0.55 + 0.25 * Math.sin(tid * 3));
  }

  return { gruppe, karosseri, panser, hjul, hjulStille, hotspots, marker, skann, knappepunkter, skiltFeste, lakk: solv };
}

// ---------------------------------------------------------------------------
// Hjul: dekk med runde skuldre og mønster, femeikers alufelg, og bremsen bak felgen
// ---------------------------------------------------------------------------
function lagHjul(mat, side, felles) {
  const spinn = new THREE.Group();   // roterer
  const stille = new THREE.Group();  // caliper står stille

  const dekk = new THREE.Mesh(felles.dekk, mat.dekkMat);
  dekk.castShadow = true;
  spinn.add(dekk);
  // Dekkmønster: klosser rundt hele dekket i to forskjøvne rader (Discovery-dekkene er grove)
  const antall = 34;
  const klossGeo = rundBoks(0.085, 0.016, 0.05, 0.006, 2);
  for (let i = 0; i < antall; i++) {
    for (const rad of [-1, 1]) {
      const a = (i + (rad > 0 ? 0.5 : 0)) / antall * Math.PI * 2;
      const k = new THREE.Mesh(klossGeo, mat.dekkMat);
      k.position.set(rad * 0.055, Math.cos(a) * (HJULRADIUS - 0.002), Math.sin(a) * (HJULRADIUS - 0.002));
      k.rotation.x = a;
      spinn.add(k);
    }
  }
  // Felg: tønne, femeikers front, nav med bolter
  const tonne = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.22, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x8d9096, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide }));
  tonne.rotation.z = Math.PI / 2;
  spinn.add(tonne);
  const felg = new THREE.Mesh(felles.felg, mat.felgMat);
  if (side < 0) felg.rotation.y = Math.PI;
  felg.position.x = side * 0.1;
  felg.castShadow = true;
  spinn.add(felg);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 8, 48), mat.felgMat);
  kant.rotation.y = Math.PI / 2;
  kant.position.x = side * 0.115;
  spinn.add(kant);
  const nav = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.03, 32), mat.felgMat);
  nav.rotation.z = Math.PI / 2;
  nav.position.x = side * 0.125;
  spinn.add(nav);
  const boltGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const b = new THREE.Mesh(boltGeo, mat.felgMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(side * 0.12, Math.cos(a) * 0.075, Math.sin(a) * 0.075);
    spinn.add(b);
  }

  // Bremser som på en Discovery 2 (ca. 1999–2004): ventilert skive, fast firestempels kaliper
  // (en halvdel på hver side av skiva) og to klosser med stålbakplate, holdt av to pinner og en
  // fjærklemme. Klossene stikker opp over kaliperen, så man ser dem gjennom felgen.
  const skiveH = 0.013;                    // halv tykkelse på skiva
  for (const x of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.009, 36), mat.skiveMat);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x * (skiveH - 0.0045);
    spinn.add(plate);
  }
  const kjoling = new THREE.Mesh(new THREE.CylinderGeometry(0.186, 0.186, skiveH * 2 - 0.006, 36, 1, true), mat.plast);
  kjoling.rotation.z = Math.PI / 2;
  spinn.add(kjoling);                      // mørk spalte mellom platene = ventilert skive
  const hatt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 24), mat.skiveMat);
  hatt.rotation.z = Math.PI / 2;
  hatt.position.x = side * 0.035;
  spinn.add(hatt);

  // Bue-formet del i hjulets plan (y opp, z fram), sentrert rundt vinkel MIDT fra toppen
  const MIDT = -1.85;                      // bak på skiva, litt under midten: der ser kameraet inn gjennom felgen
  const bue = (r1, r2, spenn, tykk, mt, x, navn = null, midt = MIDT) => {
    const form = new THREE.Shape();
    const a1 = midt - spenn, a2 = midt + spenn, n = 14;
    for (let i = 0; i <= n; i++) {
      const a = a1 + (a2 - a1) * (i / n);
      (i ? form.lineTo : form.moveTo).call(form, Math.sin(a) * r2, Math.cos(a) * r2);
    }
    for (let i = n; i >= 0; i--) {
      const a = a1 + (a2 - a1) * (i / n);
      form.lineTo(Math.sin(a) * r1, Math.cos(a) * r1);
    }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: tykk, bevelEnabled: false, curveSegments: 1 }), mt);
    m.rotation.y = -Math.PI / 2;           // formens x blir hjulets z, uttrekket går langs x
    m.position.x = x + tykk / 2;
    if (navn) m.name = navn;
    stille.add(m);
    return m;
  };
  // Klossene: friksjonsbelegg mot skiva og bakplate utenpå, på begge sider
  for (const x of [-1, 1]) {
    bue(0.122, 0.188, 0.36, 0.012, mat.klossMat, x * (skiveH + 0.0065));
    bue(0.118, 0.198, 0.4, 0.005, mat.klossMat, x * (skiveH + 0.0155));
  }
  // Kaliperen: en halvdel på hver side (stemplene sitter her) og to broer over skivekanten
  const halv = 0.034;
  const kx = skiveH + 0.018 + halv / 2;
  // Den ytre halvdelen er lav, så klossene synes over den
  for (const x of [-1, 1]) bue(0.105, x === side ? 0.15 : 0.168, 0.5, halv, mat.caliperMat, x * kx);
  // Punktet hotspoten peker på: midt på bremsen, på utsiden
  const bremsepunkt = new THREE.Object3D();
  bremsepunkt.name = 'bremsepunkt';
  bremsepunkt.position.set(side * (kx + halv / 2), Math.cos(MIDT) * 0.16, Math.sin(MIDT) * 0.16);
  stille.add(bremsepunkt);
  for (const a of [-1, 1]) bue(0.196, 0.222, 0.075, kx * 2 + halv, mat.caliperMat, 0, null, MIDT + a * 0.43);
  // Holdepinner og fjærklemme over klossene
  for (const a of [MIDT - 0.17, MIDT + 0.17]) {
    const pinne = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, kx * 2 + halv + 0.02, 8), mat.felgMat);
    pinne.rotation.z = Math.PI / 2;
    pinne.position.set(0, Math.cos(a) * 0.203, Math.sin(a) * 0.203);
    stille.add(pinne);
  }
  const klemme = new THREE.Mesh(new THREE.BoxGeometry(kx * 2 - 0.01, 0.004, 0.07), mat.felgMat);
  klemme.position.set(0, Math.cos(MIDT) * 0.207, Math.sin(MIDT) * 0.207);
  klemme.rotation.x = MIDT;
  stille.add(klemme);
  // Luftenippel på innsiden
  const nippel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.025, 8), mat.felgMat);
  nippel.position.set(-side * (kx + halv / 2 + 0.008), Math.cos(MIDT + 0.3) * 0.16, Math.sin(MIDT + 0.3) * 0.16);
  nippel.rotation.z = Math.PI / 2;
  stille.add(nippel);

  // Punktet på dekkets mønster som hotspoten peker på (fremre del av dekket)
  const mønsterpunkt = new THREE.Object3D();
  mønsterpunkt.position.set(side * 0.06, 0.05, HJULRADIUS);
  stille.add(mønsterpunkt);

  return { spinn, stille, mønsterpunkt };
}

// Myk, rund glød (hvit i midten, gjennomsiktig ytterst) til lampene
function glorieTekstur() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lagFrø(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// Grønt, ovalt Land Rover-merke med hvit kant og tekst (på reservehjuldekselet)
function landRoverLogo() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#141416';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#e8e4d8';
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2c5a3a';
  g.beginPath(); g.arc(128, 128, 114, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e4d8';
  g.font = '800 46px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save(); g.scale(0.62, 1.25); g.fillText('LAND ROVER', 128 / 0.62, 128 / 1.25); g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Instrumenter: turteller og fartsmåler med hvite tall, og to små målere (drivstoff, temperatur)
function instrumentTekstur() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 140;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0c0e';
  g.fillRect(0, 0, 512, 140);
  const maaler = (cx, r, streker) => {
    g.strokeStyle = '#d8dbe0'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, 72, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    for (let i = 0; i <= streker; i++) {
      const a = Math.PI * 0.75 + (i / streker) * Math.PI * 1.5;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.78, 72 + Math.sin(a) * r * 0.78); g.lineTo(cx + Math.cos(a) * r * 0.92, 72 + Math.sin(a) * r * 0.92); g.stroke();
    }
    g.strokeStyle = '#ff7a2a'; g.lineWidth = 3;
    const a = Math.PI * 0.95;
    g.beginPath(); g.moveTo(cx, 72); g.lineTo(cx + Math.cos(a) * r * 0.8, 72 + Math.sin(a) * r * 0.8); g.stroke();
  };
  maaler(80, 52, 4);
  maaler(206, 58, 10);
  maaler(330, 58, 8);
  maaler(445, 44, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Radio med display og knapper, og varmeregulering under
function radioTekstur() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#16171a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3d7f9c';
  g.fillRect(30, 14, 68, 16);
  g.fillStyle = '#2a2c30';
  for (let i = 0; i < 6; i++) g.fillRect(14 + i * 17, 38, 13, 8);
  for (const x of [20, 108]) { g.beginPath(); g.arc(x, 22, 8, 0, Math.PI * 2); g.fill(); }
  for (const x of [28, 64, 100]) {
    g.fillStyle = '#2f3135'; g.beginPath(); g.arc(x, 92, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9ccd1'; g.fillRect(x - 1, 79, 2, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

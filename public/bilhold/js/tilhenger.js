// Tilhenger med høye vegger og en sjiraff oppi. Henger bak Land Roveren (som peker mot +z).

import * as THREE from 'three';

const LAKK = 0xbdb9ac;          // samme som bilen (scene.js)

const HJULRADIUS = 0.33;
const FRONT = -2.95;            // hengerkassens forkant
const BAK = -6.05;
const BREDDE = 1.76;
const GULV = 0.7;               // oversiden av gulvet
const VEGG_H = 1.15;
// Boggi: to aksler litt bak på midten, slik de fleste store hengere har
const BOGGI_Z = (FRONT + BAK) / 2 - 0.25;
const AKSLER = [BOGGI_Z + 0.37, BOGGI_Z - 0.37];

// Ujevnheter i veien (meter opp/ned) ved en gitt strekning. Bilen og hengeren kjører over de
// samme humpene, hengeren litt etter, så de hopper i takt uten å være helt like.
export function veiHump(s) {
  return Math.sin(s * 1.3) * 0.006 + Math.sin(s * 0.37) * 0.008;
}
export const HENGER_ETTER = 4.4;        // meter fra bilens midte til hengerens aksler

export function lagTilhenger() {
  const gruppe = new THREE.Group();
  const kasse = new THREE.Group();     // alt som rister litt (ikke hjulene)
  gruppe.add(kasse);

  // Egne materialer, så bare hengeren lyser opp når man peker på den
  const solv = new THREE.MeshStandardMaterial({ color: LAKK, metalness: 0.75, roughness: 0.3 });   // samme lakk som bilen
  const plast = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.1, roughness: 0.75 });
  const gulvMat = new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.9 });
  const dekkMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const felgMat = new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 });
  const baklykt = new THREE.MeshStandardMaterial({ color: 0x7a0b0b, emissive: 0x5a0000, roughness: 0.3 });

  const boks = (b, h, l, mat, x, y, z, foreldre = kasse) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, l), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };

  const LENGDE = FRONT - BAK;
  const MIDT_Z = (FRONT + BAK) / 2;
  const T = 0.05;                       // veggtykkelse
  const veggMidtY = GULV + VEGG_H / 2;

  // Gulv og ramme
  boks(BREDDE, 0.08, LENGDE, gulvMat, 0, GULV - 0.04, MIDT_Z);
  for (const s of [-1, 1]) boks(0.08, 0.12, LENGDE, plast, s * 0.55, GULV - 0.14, MIDT_Z);
  // Vegger (uten tak)
  for (const s of [-1, 1]) boks(T, VEGG_H, LENGDE, solv, s * (BREDDE / 2 - T / 2), veggMidtY, MIDT_Z);
  boks(BREDDE, VEGG_H, T, solv, 0, veggMidtY, FRONT - T / 2);
  boks(BREDDE, VEGG_H, T, solv, 0, veggMidtY, BAK + T / 2);
  // Ribber og topplist gir sølvveggene litt struktur
  for (const s of [-1, 1]) {
    const x = s * (BREDDE / 2 + 0.005);
    boks(0.03, 0.05, LENGDE + 0.04, solv, x, GULV + VEGG_H, MIDT_Z);
    for (let i = 1; i < 5; i++) boks(0.025, VEGG_H, 0.05, solv, x, veggMidtY, BAK + (LENGDE * i) / 5);
  }
  for (const z of [FRONT, BAK]) boks(BREDDE + 0.04, 0.05, 0.03, solv, 0, GULV + VEGG_H, z);
  // Skjermer over hjulene
  for (const s of [-1, 1]) {
    boks(0.26, 0.04, 1.7, plast, s * (BREDDE / 2 + 0.13), GULV + 0.02, BOGGI_Z);
    boks(0.26, 0.2, 0.04, plast, s * (BREDDE / 2 + 0.13), GULV - 0.08, BOGGI_Z + 0.83);
    boks(0.26, 0.2, 0.04, plast, s * (BREDDE / 2 + 0.13), GULV - 0.08, BOGGI_Z - 0.83);
    boks(0.05, 0.16, 0.08, baklykt, s * (BREDDE / 2 - 0.15), GULV + 0.12, BAK - 0.02);
  }
  // Drag (A-ramme) fram til kulen på bilen
  const KULE = new THREE.Vector3(0, 0.52, -2.6);
  for (const s of [-1, 1]) {
    const fra = new THREE.Vector3(s * 0.6, GULV - 0.14, FRONT);
    const lengde = fra.distanceTo(KULE);
    const bjelke = boks(0.07, 0.07, lengde, plast, (fra.x + KULE.x) / 2, (fra.y + KULE.y) / 2, (fra.z + KULE.z) / 2);
    bjelke.lookAt(kasse.localToWorld(KULE.clone()));
  }
  boks(0.12, 0.1, 0.2, plast, 0, KULE.y, KULE.z + 0.05);                    // hengerhode
  boks(0.05, 0.14, 0.05, plast, 0, KULE.y - 0.05, KULE.z + 0.17, gruppe);   // kulen på bilen

  // Hjul
  const hjul = [];
  for (const s of [-1, 1]) for (const akselZ of AKSLER) {
    const spinn = new THREE.Group();
    spinn.position.set(s * (BREDDE / 2 + 0.13), HJULRADIUS, akselZ);
    const dekk = new THREE.Mesh(new THREE.CylinderGeometry(HJULRADIUS, HJULRADIUS, 0.2, 28), dekkMat);
    dekk.rotation.z = Math.PI / 2;
    dekk.castShadow = true;
    const felg = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.21, 20), felgMat);
    felg.rotation.z = Math.PI / 2;
    const nav = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.3), felgMat);
    spinn.add(dekk, felg, nav);
    gruppe.add(spinn);
    hjul.push(spinn);
  }

  // Sjiraff
  const sjiraff = lagSjiraff();
  sjiraff.gruppe.position.set(0, GULV, MIDT_Z + 0.1);
  kasse.add(sjiraff.gruppe);

  // Markering når man peker på hengeren: en tynn ramme rundt kassen
  const ramme = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BREDDE + 0.5, VEGG_H + 0.45, LENGDE + 0.3)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }),
  );
  ramme.position.set(0, veggMidtY - 0.12, MIDT_Z);
  ramme.renderOrder = 10;
  kasse.add(ramme);

  // Punkt midt på hengerveggen mot kameraet der "Åpne tilhengerkalkulator"-skiltet festes,
  // så skiltet ligger på selve hengeren og ikke over sjiraffen
  const skiltpunkt = new THREE.Object3D();
  skiltpunkt.position.set(BREDDE / 2, veggMidtY, MIDT_Z - 0.3);
  kasse.add(skiltpunkt);

  const glod = new THREE.Color(0x9cc8ff);
  return {
    gruppe,
    skiltpunkt,
    sjiraffHode: sjiraff.hode,
    oppdater({ strekning, hjulvinkel, tid, hover, blink = 0 }) {
      for (const h of hjul) h.rotation.x = hjulvinkel;
      // Samme humper som bilen, litt senere og litt mykere, pluss en liten egen vugging
      const s = strekning - HENGER_ETTER;
      kasse.position.y = veiHump(s) * 0.85 + Math.sin(strekning * 2.1) * 0.0012;
      kasse.rotation.z = Math.sin(s * 0.5) * 0.0045;
      sjiraff.oppdater(tid);
      const puls = 0.8 + 0.2 * Math.sin(tid * 3);
      solv.emissive.copy(glod).multiplyScalar(hover * 0.28 * puls);
      // Sakte blink (ca. 3,5 s per runde) når det er slått på, ellers styrt av hover
      const blinkNivå = blink * Math.max(0, Math.sin((tid * Math.PI * 2) / 3.5)) * 0.75;
      ramme.material.opacity = Math.max(hover * 0.85, blinkNivå);
    },
  };
}

// Stilisert sjiraff som ser framover (+z). Nakken vugger rolig fra side til side.
// Brukes også alene som bakgrunn på innloggingssiden (sjiraff-bakgrunn.js).
export function lagSjiraff() {
  const gruppe = new THREE.Group();
  const pels = new THREE.MeshStandardMaterial({ map: lagFlekktekstur(), roughness: 0.85 });
  const lys = new THREE.MeshStandardMaterial({ color: 0xe1b866, roughness: 0.85 });
  const mork = new THREE.MeshStandardMaterial({ color: 0x4a2f17, roughness: 0.9 });

  const mesh = (geo, mat, foreldre = gruppe) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    foreldre.add(m);
    return m;
  };

  const BEN = 0.8;
  // Bein med mørke hover
  for (const [x, z] of [[-0.17, 0.32], [0.17, 0.32], [-0.17, -0.32], [0.17, -0.32]]) {
    const ben = mesh(new THREE.CylinderGeometry(0.045, 0.055, BEN, 8), pels);
    ben.position.set(x, BEN / 2, z);
    const hov = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), mork);
    hov.position.set(x, 0.03, z);
  }
  // Kropp, litt høyere foran som på en ekte sjiraff
  const kropp = mesh(new THREE.SphereGeometry(1, 20, 14), pels);
  kropp.scale.set(0.3, 0.32, 0.58);
  kropp.position.set(0, BEN + 0.2, 0);
  kropp.rotation.x = -0.12;
  const hale = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.5, 6), pels);
  hale.position.set(0, BEN + 0.05, -0.6);
  hale.rotation.x = 0.25;
  const dusk = mesh(new THREE.SphereGeometry(0.04, 8, 6), mork);
  dusk.position.set(0, BEN - 0.2, -0.66);

  // Nakke med ledd i skulderen, så den kan vugge
  const nakkeledd = new THREE.Group();
  nakkeledd.position.set(0, BEN + 0.36, 0.38);
  gruppe.add(nakkeledd);
  const NAKKE = 1.15;
  const nakke = mesh(new THREE.CylinderGeometry(0.075, 0.13, NAKKE, 12), pels, nakkeledd);
  nakke.position.set(0, NAKKE / 2, 0.12);
  nakke.rotation.x = 0.2;
  // Manke
  const manke = mesh(new THREE.BoxGeometry(0.03, NAKKE * 0.9, 0.05), mork, nakkeledd);
  manke.position.set(0, NAKKE / 2, 0.0);
  manke.rotation.x = 0.2;

  // Hode med eget ledd, så det kan se seg litt rundt
  const hodeledd = new THREE.Group();
  hodeledd.position.set(0, NAKKE + 0.02, 0.12 + Math.sin(0.2) * NAKKE / 2 + 0.06);
  nakkeledd.add(hodeledd);
  const hode = mesh(new THREE.BoxGeometry(0.17, 0.17, 0.3), lys, hodeledd);
  hode.position.set(0, 0, 0.08);
  const mule = mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), lys, hodeledd);
  mule.position.set(0, -0.03, 0.28);
  for (const s of [-1, 1]) {
    const horn = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), lys, hodeledd);
    horn.position.set(s * 0.05, 0.15, -0.02);
    const knott = mesh(new THREE.SphereGeometry(0.03, 8, 6), mork, hodeledd);
    knott.position.set(s * 0.05, 0.23, -0.02);
    const ore = mesh(new THREE.ConeGeometry(0.035, 0.12, 6), lys, hodeledd);
    ore.position.set(s * 0.12, 0.07, -0.04);
    ore.rotation.z = -s * 1.1;
    const oye = mesh(new THREE.SphereGeometry(0.022, 8, 6), mork, hodeledd);
    oye.position.set(s * 0.087, 0.03, 0.12);
  }

  // Punkt midt på hodet, som kameraet zoomer inn på før innlogging
  const hodepunkt = new THREE.Object3D();
  hodepunkt.position.set(0, 0.02, 0.12);
  hodeledd.add(hodepunkt);

  return {
    gruppe,
    hode: hodepunkt,
    oppdater(tid) {
      // Rolig, nesten umerkelig bevegelse
      nakkeledd.rotation.z = Math.sin(tid * 0.55) * 0.09;
      nakkeledd.rotation.x = Math.sin(tid * 0.37 + 1) * 0.03;
      hodeledd.rotation.y = Math.sin(tid * 0.55 + 0.8) * 0.28;
      hodeledd.rotation.z = -nakkeledd.rotation.z * 0.6;
    },
  };
}

// Sjiraffmønster tegnet på et lerret: brune flekker med lyse linjer mellom
function lagFlekktekstur() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f0d39a';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#9a5a24';
  let frø = 11;
  const tilfeldig = () => ((frø = (frø * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const cx = x * 52 + (y % 2) * 26 + tilfeldig() * 8;
      const cy = y * 52 + tilfeldig() * 8;
      g.beginPath();
      const hjorner = 6;
      for (let i = 0; i < hjorner; i++) {
        const a = (i / hjorner) * Math.PI * 2 + tilfeldig() * 0.4;
        const r = 18 + tilfeldig() * 6;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    }
  }
  const tekstur = new THREE.CanvasTexture(c);
  tekstur.colorSpace = THREE.SRGBColorSpace;
  tekstur.wrapS = tekstur.wrapT = THREE.RepeatWrapping;
  tekstur.repeat.set(2, 2);
  return tekstur;
}

// Kameraet rett foran sjiraffhodet, brukt både når forsiden zoomer inn og som bakgrunn
// på innloggingssiden, så de to bildene blir like. Hodet havner ca. 30 % fra toppen.
export function sjiraffKamera(hodePos, aspekt, fov, utPos, utMal) {
  const avstand = aspekt < 1 ? 1.05 : 1.35;
  const halvHoyde = avstand * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  utPos.set(hodePos.x, hodePos.y + 0.03, hodePos.z + avstand);
  utMal.set(hodePos.x, hodePos.y - halvHoyde * 0.4, hodePos.z);
}

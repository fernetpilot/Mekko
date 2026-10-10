// 3D-scenen: en stilisert sølvgrå Land Rover (Discovery 2-aktig) som kjører på en vei.
// Alt er bygget av enkle former i Three.js, så det trengs ingen modellfil.
// Bilen står i origo og peker mot +z. Bilens venstre side er +x.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FARTKMT = 60;
const FART = FARTKMT / 3.6;              // meter per sekund
const HJULRADIUS = 0.39;
const FORAKSEL_Z = 1.32;
const BAKAKSEL_Z = -1.22;
const SPORVIDDE = 0.82;                  // avstand fra midten til hjulsenter

const STATUSFARGER = {
  motor: new THREE.Color('#34c759'),
  bremser: new THREE.Color('#ffcc00'),
  dekk: new THREE.Color('#ff3b30'),
};

const TEMA = {
  dark: { bg: new THREE.Color('#0a0b0d'), gress: new THREE.Color('#1d2a1f'), vei: new THREE.Color('#2a2c30') },
  light: { bg: new THREE.Color('#eef0f2'), gress: new THREE.Color('#9db88a'), vei: new THREE.Color('#8d9096') },
};

// Kameraposisjoner per seksjon: [kamera, punkt kameraet ser på]
// 0 = hero, 1 = motorrom, 2 = bremser, 3 = dekk
function lagKamerapunkter(aspekt) {
  // Smal mobilskjerm trenger større avstand for å få med hele bilen
  const k = THREE.MathUtils.clamp(0.75 / aspekt, 1, 1.9);
  return [
    { pos: new THREE.Vector3(5.2 * k, 2.4 + 0.5 * k, 5.2 * k), mal: new THREE.Vector3(0, 0.7 + 0.25 * k, 0) },
    { pos: new THREE.Vector3(1.5, 3.6, 4.6), mal: new THREE.Vector3(0, 0.75, 1.35) },
    { pos: new THREE.Vector3(3.3, 0.95, 2.6), mal: new THREE.Vector3(SPORVIDDE, 0.2, FORAKSEL_Z) },
    { pos: new THREE.Vector3(1.75, 0.55, 2.85), mal: new THREE.Vector3(SPORVIDDE, 0.05, FORAKSEL_Z + 0.1) },
  ];
}

export function lagScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = TEMA.dark.bg.clone();
  scene.fog = new THREE.Fog(scene.background, 18, 60);

  // Refleksjoner til metallet
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);

  // Lys
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, 0.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(6, 10, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
  sol.shadow.bias = -0.0005;
  scene.add(sol);

  const omgivelser = lagOmgivelser(scene);
  const bil = lagBil();
  scene.add(bil.gruppe);

  // ---------- Tilstand som styres fra scrolling ----------
  let kamerapunkter = lagKamerapunkter(1);
  let fremdrift = 0;                 // 0..3, scroll-posisjon målt i seksjoner
  let temaMal = 'dark';
  const kamPos = kamerapunkter[0].pos.clone();
  const kamMal = kamerapunkter[0].mal.clone();
  const onsketPos = new THREE.Vector3();
  const onsketMal = new THREE.Vector3();
  const aktivitet = { motor: 0, bremser: 0, dekk: 0 };
  const redusertBevegelse = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tilpassStorrelse() {
    const b = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(b, h, false);
    kamera.aspect = b / h;
    kamera.fov = kamera.aspect < 1 ? 50 : 38;
    kamera.updateProjectionMatrix();
    kamerapunkter = lagKamerapunkter(kamera.aspect);
  }
  tilpassStorrelse();
  window.addEventListener('resize', tilpassStorrelse);

  // "Snappy" kurve: rolig ut og inn, rask i midten
  const kurve = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function beregnKameramal() {
    const maks = kamerapunkter.length - 1;
    const p = THREE.MathUtils.clamp(fremdrift, 0, maks);
    const i = Math.min(Math.floor(p), maks - 1);
    const t = kurve(p - i);
    onsketPos.lerpVectors(kamerapunkter[i].pos, kamerapunkter[i + 1].pos, t);
    onsketMal.lerpVectors(kamerapunkter[i].mal, kamerapunkter[i + 1].mal, t);
  }

  const klokke = new THREE.Clock();
  let veistrekning = 0;

  function tegn() {
    const dt = Math.min(klokke.getDelta(), 0.05);
    const demp = 1 - Math.exp(-dt * 7);

    // Kamera
    beregnKameramal();
    kamPos.lerp(onsketPos, demp);
    kamMal.lerp(onsketMal, demp);
    kamera.position.copy(kamPos);
    kamera.lookAt(kamMal);

    // Kjøring
    const fart = redusertBevegelse ? FART * 0.15 : FART;
    veistrekning += fart * dt;
    omgivelser.oppdater(veistrekning);
    for (const hjul of bil.hjul) hjul.rotation.x = veistrekning / HJULRADIUS;
    // Litt liv i karosseriet
    bil.karosseri.position.y = Math.sin(veistrekning * 1.3) * 0.006 + Math.sin(veistrekning * 0.37) * 0.008;
    bil.karosseri.rotation.z = Math.sin(veistrekning * 0.5) * 0.004;

    // Hvor aktiv hver seksjon er (1 når den er midt på skjermen)
    const naer = (k) => THREE.MathUtils.clamp(1 - Math.abs(fremdrift - k) * 1.6, 0, 1);
    for (const [navn, k] of [['motor', 1], ['bremser', 2], ['dekk', 3]]) {
      aktivitet[navn] = THREE.MathUtils.lerp(aktivitet[navn], naer(k), demp);
      bil.marker(navn, aktivitet[navn], STATUSFARGER[navn], klokke.elapsedTime);
    }
    // Panseret åpnes i motorrom-seksjonen
    bil.panser.rotation.x = -1.05 * THREE.MathUtils.smoothstep(aktivitet.motor, 0.05, 0.9);

    // Fargetema glir over
    const tema = TEMA[temaMal];
    scene.background.lerp(tema.bg, demp * 0.6);
    scene.fog.color.copy(scene.background);
    omgivelser.gressMat.color.lerp(tema.gress, demp * 0.6);
    omgivelser.veiMat.color.lerp(tema.vei, demp * 0.6);

    renderer.render(scene, kamera);
    requestAnimationFrame(tegn);
  }
  requestAnimationFrame(tegn);

  const tmp = new THREE.Vector3();
  return {
    settFremdrift(p) { fremdrift = p; },
    settTema(t) { temaMal = t === 'light' ? 'light' : 'dark'; },
    // Skjermposisjon (px) for en bildel, brukt til hotspot og styrelinje
    skjermpunkt(navn) {
      const objekt = bil.hotspots[navn];
      if (!objekt) return null;
      objekt.getWorldPosition(tmp);
      tmp.project(kamera);
      if (tmp.z > 1) return null;
      return {
        x: (tmp.x * 0.5 + 0.5) * window.innerWidth,
        y: (-tmp.y * 0.5 + 0.5) * window.innerHeight,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Vei, gress og ting som passerer
// ---------------------------------------------------------------------------
function lagOmgivelser(scene) {
  const LENGDE = 140;
  // Bilen kjører i høyre felt, så midtstripen ligger på bilens venstre side (+x)
  const MIDTSTRIPE_X = 1.9;
  const gressMat = new THREE.MeshStandardMaterial({ color: TEMA.dark.gress, roughness: 1 });
  const gress = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gressMat);
  gress.rotation.x = -Math.PI / 2;
  gress.position.y = -0.01;
  gress.receiveShadow = true;
  scene.add(gress);

  const veiMat = new THREE.MeshStandardMaterial({ color: TEMA.dark.vei, roughness: 0.92 });
  const vei = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 200), veiMat);
  vei.rotation.x = -Math.PI / 2;
  vei.position.x = MIDTSTRIPE_X;
  vei.receiveShadow = true;
  scene.add(vei);

  const linjeMat = new THREE.MeshBasicMaterial({ color: 0xd9dadc });
  for (const x of [MIDTSTRIPE_X - 3.6, MIDTSTRIPE_X + 3.6]) {
    const kant = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 200), linjeMat);
    kant.rotation.x = -Math.PI / 2;
    kant.position.set(x, 0.002, 0);
    scene.add(kant);
  }

  // Ting som beveger seg forbi: midtstriper, brøytestikker og noen få trær
  const flyttbare = [];
  const stripeGeo = new THREE.PlaneGeometry(0.12, 3);
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 9) {
    const s = new THREE.Mesh(stripeGeo, linjeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(MIDTSTRIPE_X, 0.003, z);
    flyttbare.push({ obj: s, start: z });
    scene.add(s);
  }

  const stikkeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const refleksMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0x552200, roughness: 0.4 });
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 25) {
    for (const x of [MIDTSTRIPE_X - 4.4, MIDTSTRIPE_X + 4.4]) {
      const g = new THREE.Group();
      const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), stikkeMat);
      stang.position.y = 0.9;
      const refleks = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), refleksMat);
      refleks.position.y = 1.6;
      g.add(stang, refleks);
      g.position.set(x, 0, z + (x > MIDTSTRIPE_X ? 12 : 0));
      flyttbare.push({ obj: g, start: g.position.z });
      scene.add(g);
    }
  }

  const stammeMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 1 });
  const kroneMat = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1, flatShading: true });
  const tilfeldig = lagTilfeldig(7);
  for (let i = 0; i < 14; i++) {
    const tre = new THREE.Group();
    const h = 2.5 + tilfeldig() * 2.5;
    const stamme = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h * 0.35, 6), stammeMat);
    stamme.position.y = h * 0.175;
    const krone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.8, 7), kroneMat);
    krone.position.y = h * 0.35 + h * 0.4;
    krone.castShadow = true;
    tre.add(stamme, krone);
    const side = i % 2 ? 1 : -1;
    tre.position.set(MIDTSTRIPE_X + side * (8 + tilfeldig() * 14), 0, -LENGDE / 2 + (i / 14) * LENGDE + tilfeldig() * 6);
    flyttbare.push({ obj: tre, start: tre.position.z });
    scene.add(tre);
  }

  return {
    gressMat,
    veiMat,
    oppdater(strekning) {
      // Verden flytter seg bakover (-z) mens bilen står stille
      for (const f of flyttbare) {
        let z = f.start - strekning;
        z = ((z + LENGDE / 2) % LENGDE + LENGDE) % LENGDE - LENGDE / 2;
        f.obj.position.z = z;
      }
    },
  };
}

function lagTilfeldig(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// ---------------------------------------------------------------------------
// Land Rover – forenklet realisme med skarpe, enkle linjer
// ---------------------------------------------------------------------------
function lagBil() {
  const gruppe = new THREE.Group();
  const karosseri = new THREE.Group();
  gruppe.add(karosseri);

  const solv = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 0.85, roughness: 0.28 });
  const plast = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.1, roughness: 0.75 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, metalness: 0.9, roughness: 0.08 });
  const krom = new THREE.MeshStandardMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.15 });
  const lykt = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xfff4dc, emissiveIntensity: 0.6, roughness: 0.2 });
  const baklykt = new THREE.MeshStandardMaterial({ color: 0x7a0b0b, emissive: 0x5a0000, roughness: 0.3 });
  const motorrom = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.85 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x5b5f66, metalness: 0.6, roughness: 0.45 });

  const boks = (b, h, l, mat, x, y, z, foreldre = karosseri) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, l), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };

  const BREDDE = 1.86;
  const FRONT = 2.28;
  const BAK = -2.22;
  const BELTE = 1.12;      // høyden der panser og vinduer begynner

  // Nedre del av karosseriet (bak motorrommet)
  boks(BREDDE, BELTE - 0.48, 2.95, solv, 0, (BELTE + 0.48) / 2, (0.73 + BAK) / 2);
  // Under motorrommet
  boks(BREDDE, 0.32, FRONT - 0.73, solv, 0, 0.64, (FRONT + 0.73) / 2);
  // Skjermer på hver side av motorrommet
  for (const s of [-1, 1]) boks(0.14, BELTE - 0.8, FRONT - 0.73, solv, s * (BREDDE / 2 - 0.07), (BELTE + 0.8) / 2, (FRONT + 0.73) / 2);
  // Frontpanel med grill
  boks(BREDDE - 0.28, BELTE - 0.8, 0.06, solv, 0, (BELTE + 0.8) / 2, FRONT - 0.03);
  boks(0.9, 0.2, 0.04, plast, 0, 0.94, FRONT + 0.01);
  for (let i = 0; i < 4; i++) boks(0.86, 0.015, 0.02, krom, 0, 0.87 + i * 0.045, FRONT + 0.035);
  // Lykter
  for (const s of [-1, 1]) {
    boks(0.32, 0.2, 0.04, lykt, s * 0.7, 0.94, FRONT + 0.01);
    boks(0.09, 0.06, 0.03, new THREE.MeshStandardMaterial({ color: 0xff9a1f, emissive: 0x663300 }), s * 0.7, 0.8, FRONT + 0.01);
    boks(0.04, 0.42, 0.14, baklykt, s * 0.9, 0.98, BAK + 0.1);
  }
  // Brannvegg og selve motorrommet
  boks(BREDDE - 0.28, 0.32, 0.05, motorrom, 0, 0.96, 0.75);
  boks(BREDDE - 0.3, 0.02, FRONT - 0.82, motorrom, 0, 0.81, (FRONT + 0.77) / 2);

  // Motor med oljelokk og oljefilter (blir grønne i motorrom-seksjonen)
  const motorGruppe = new THREE.Group();
  karosseri.add(motorGruppe);
  boks(0.62, 0.24, 0.72, motorMat, 0, 0.94, 1.45, motorGruppe);                       // motorblokk
  boks(0.66, 0.06, 0.66, motorMat, 0, 1.08, 1.45, motorGruppe);                       // ventildeksel
  boks(0.32, 0.14, 0.4, plast, -0.55, 0.98, 1.65, motorGruppe);                       // luftfilterboks
  const oljeMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.3, roughness: 0.5 });
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), oljeMat);
  oljelokk.position.set(0.15, 1.13, 1.32);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20), oljeMat);
  oljefilter.rotation.z = Math.PI / 2;
  oljefilter.position.set(0.42, 0.95, 1.55);
  karosseri.add(oljefilter);

  // Panser (hengslet ved frontruta så det kan åpnes)
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.01, 0.76);
  karosseri.add(panser);
  boks(BREDDE - 0.02, 0.05, FRONT - 0.76, solv, 0, 0, (FRONT - 0.76) / 2, panser);
  boks(BREDDE - 0.5, 0.012, FRONT - 0.9, solv, 0, 0.03, (FRONT - 0.76) / 2, panser); // pregning

  // Kupé med "stepped roof" som på Discovery
  const KUPE_B = 1.76;
  boks(KUPE_B, 0.04, 2.75, solv, 0, BELTE + 0.02, -0.8);                              // overgang
  boks(KUPE_B, 0.08, 2.15, solv, 0, 1.93, -0.55);                                     // tak foran
  boks(KUPE_B - 0.02, 0.12, 0.95, solv, 0, 1.97, BAK + 0.5);                           // hevet tak bak
  for (const s of [-1, 1]) boks(0.04, 0.04, 2.9, plast, s * 0.72, 2.06, -0.75);       // takrails
  // Stolper
  for (const s of [-1, 1]) {
    for (const z of [0.0, -1.0, BAK + 0.05]) boks(0.07, 0.78, 0.09, solv, s * (KUPE_B / 2 - 0.035), 1.52, z);
  }
  // Frontrute (skrå)
  const rute = boks(KUPE_B - 0.06, 0.88, 0.02, glass, 0, 1.52, 0.42);
  rute.rotation.x = -0.42;
  for (const s of [-1, 1]) {
    const a = boks(0.07, 0.9, 0.07, solv, s * (KUPE_B / 2 - 0.035), 1.52, 0.42);
    a.rotation.x = -0.42;
  }
  // Sidevinduer
  for (const s of [-1, 1]) {
    boks(0.02, 0.62, 0.9, glass, s * (KUPE_B / 2 - 0.005), 1.5, -0.5);
    boks(0.02, 0.62, 1.02, glass, s * (KUPE_B / 2 - 0.005), 1.5, -1.6);
    boks(0.02, 0.1, 0.5, glass, s * (KUPE_B / 2 - 0.005), 1.96, BAK + 0.5);           // alpine-vinduer
    boks(0.02, 0.5, 0.36, glass, s * (KUPE_B / 2 - 0.005), 1.55, 0.18);
    // Speil
    boks(0.2, 0.14, 0.08, plast, s * 1.02, 1.3, 0.4);
  }
  // Bakrute og reservehjul på bakdøra
  boks(KUPE_B - 0.2, 0.58, 0.02, glass, 0, 1.55, BAK - 0.005);
  boks(KUPE_B, 0.76, 0.04, solv, 0, 0.8, BAK - 0.01);

  // Støtfangere og hjulbuer i sort plast
  boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, FRONT + 0.08);
  boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, BAK - 0.08);
  boks(BREDDE + 0.02, 0.08, 4.0, plast, 0, 0.5, 0.03);                               // sidelist nede
  for (const s of [-1, 1]) {
    for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
      boks(0.1, 0.07, 1.0, plast, s * (BREDDE / 2 + 0.03), 0.93, z);
      for (const zz of [-1, 1]) boks(0.1, 0.3, 0.07, plast, s * (BREDDE / 2 + 0.03), 0.78, z + zz * 0.49);
    }
  }

  // Hjul
  const dekkMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const felgMat = new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 });
  const skiveMat = new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.9, roughness: 0.35 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.4, roughness: 0.5 });
  const klossMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.8 });

  const hjul = [];
  const hotspots = {};
  for (const s of [-1, 1]) {
    for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
      const { spinn, stille, mønsterpunkt } = lagHjul({ dekkMat, felgMat, skiveMat, caliperMat, klossMat, plast }, s);
      spinn.position.set(s * SPORVIDDE, HJULRADIUS, z);
      stille.position.copy(spinn.position);
      gruppe.add(spinn, stille);
      hjul.push(spinn);
      if (s === 1 && z === FORAKSEL_Z) {
        hotspots.bremser = stille.getObjectByName('caliper');
        hotspots.dekk = mønsterpunkt;
      }
    }
  }
  // Reservehjul på bakdøra
  const reserve = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 28), dekkMat);
  reserve.rotation.x = Math.PI / 2;
  reserve.position.set(0, 1.08, BAK - 0.16);
  reserve.castShadow = true;
  karosseri.add(reserve);
  const deksel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 28), solv);
  deksel.rotation.x = Math.PI / 2;
  deksel.position.set(0, 1.08, BAK - 0.29);
  karosseri.add(deksel);

  hotspots.motor = oljelokk;

  // Statusmarkering: delene er nøytrale til kameraet zoomer inn
  const markerbare = {
    motor: [oljeMat],
    bremser: [caliperMat, klossMat],
    dekk: [dekkMat],
  };
  const grunnfarge = new Map();
  for (const liste of Object.values(markerbare)) for (const m of liste) grunnfarge.set(m, m.color.clone());

  function marker(navn, styrke, farge, tid) {
    const puls = 0.75 + 0.25 * Math.sin(tid * 4);
    for (const m of markerbare[navn]) {
      m.color.copy(grunnfarge.get(m)).lerp(farge, styrke * (navn === 'dekk' ? 0.2 : 0.8));
      m.emissive.copy(farge).multiplyScalar(styrke * puls * (navn === 'dekk' ? 0.22 : 0.9));
    }
  }

  return { gruppe, karosseri, panser, hjul, hotspots, marker };
}

function lagHjul(mat, side) {
  const spinn = new THREE.Group();   // roterer
  const stille = new THREE.Group();  // caliper står stille
  const B = 0.27;

  // Dekk
  const dekk = new THREE.Mesh(new THREE.CylinderGeometry(HJULRADIUS - 0.02, HJULRADIUS - 0.02, B, 36, 1, true), mat.dekkMat);
  dekk.rotation.z = Math.PI / 2;
  dekk.castShadow = true;
  spinn.add(dekk);
  for (const x of [-1, 1]) {
    const vegg = new THREE.Mesh(new THREE.RingGeometry(0.25, HJULRADIUS - 0.02, 36), mat.dekkMat);
    vegg.rotation.y = x * Math.PI / 2;
    vegg.position.x = x * B / 2;
    spinn.add(vegg);
  }
  // Dekkmønster: klosser rundt hele dekket i to forskjøvne rader
  const antall = 30;
  const klossGeo = new THREE.BoxGeometry(0.1, 0.035, 0.055);
  for (let i = 0; i < antall; i++) {
    for (const rad of [-1, 1]) {
      const a = (i + (rad > 0 ? 0.5 : 0)) / antall * Math.PI * 2;
      const k = new THREE.Mesh(klossGeo, mat.dekkMat);
      k.position.set(rad * 0.068, Math.cos(a) * (HJULRADIUS - 0.01), Math.sin(a) * (HJULRADIUS - 0.01));
      k.rotation.x = a;
      spinn.add(k);
    }
  }

  // Felg med eiker, så bremseskiven synes
  const ytterX = side * (B / 2 - 0.03);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 8, 36), mat.felgMat);
  kant.rotation.y = Math.PI / 2;
  kant.position.x = ytterX;
  spinn.add(kant);
  const nav = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), mat.felgMat);
  nav.rotation.z = Math.PI / 2;
  nav.position.x = ytterX;
  spinn.add(nav);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.065), mat.felgMat);
    eike.position.set(ytterX, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
    eike.rotation.x = a;
    spinn.add(eike);
  }
  // Bremseskive
  const skive = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 32), mat.skiveMat);
  skive.rotation.z = Math.PI / 2;
  spinn.add(skive);

  // Caliper og bremseklosser (står stille, øverst foran på skiva så kameraet ser dem)
  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.16), mat.caliperMat);
  caliper.name = 'caliper';
  caliper.position.set(side * 0.02, 0.13, 0.08);
  caliper.rotation.x = -0.55;
  stille.add(caliper);
  for (const x of [-1, 1]) {
    const kloss = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.12), mat.klossMat);
    kloss.position.set(x * 0.025, 0.14, 0.08);
    kloss.rotation.x = -0.55;
    stille.add(kloss);
  }

  // Punktet på dekkets mønster som hotspoten peker på (fremre del av dekket)
  const mønsterpunkt = new THREE.Object3D();
  mønsterpunkt.position.set(side * 0.06, 0.05, HJULRADIUS);
  stille.add(mønsterpunkt);

  return { spinn, stille, mønsterpunkt };
}

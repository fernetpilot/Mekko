// Spillet: kjør din egen Mekko-bil rundt en landevei. Hengeren blir igjen på forsiden.
// Bygget på ideene fra Starter Kit Racing av mrdoob og Kenney (MIT, se ../LISENS-starter-kit-racing.txt),
// men med bilen, veien og lyset fra forsiden (bilhold/js/scene.js og tilhenger.js).
//
// Kommer man fra forsiden, har forsiden allerede flydd kameraet hit og lagt igjen et stillbilde
// (sessionStorage 'mekko-spill-overgang'). Bildet ligger over lerretet til første bilde er tegnet,
// og glir så bort, så man ikke merker at siden ble byttet.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lagBil } from '/bilhold/js/bil.js';
import { veiHump } from '/bilhold/js/tilhenger.js';
import { lagBane, naermeste, punktVed, lagRundeteller, VEI_BREDDE, GRENSE, MIDTSTRIPE_X } from './banedata.js';
import { lagBane3d } from './bane-3d.js';
import { nyBil, kjor, kmt, stoppMotVegg, autopilot, VMAKS } from './kjoring.js';
import { spillKamera, folgKamera } from './kamera.js';
import { lagKontroller } from './kontroller.js';

const START_FART = 60 / 3.6;          // samme fart som bilen har på forsiden
const BIL_HALV = 1.05;                // halv bredde: så nær autovernet kan midten av bilen komme
const BESTE_NOKKEL = 'mekko-spill-beste';

const rot = document.documentElement;
const canvas = document.getElementById('scene');
const overgangBilde = document.getElementById('overgang');
const hud = {
  runde: document.getElementById('hud-runde'),
  beste: document.getElementById('hud-beste'),
  fart: document.getElementById('hud-fart'),
  hint: document.getElementById('hint'),
  melding: document.getElementById('melding'),
  nyStart: document.getElementById('ny-start'),
};

// ---------- Fra forsiden: stillbilde, tid og bilens farge og skilt ----------
let overgang = null;
try {
  overgang = JSON.parse(sessionStorage.getItem('mekko-spill-overgang') || 'null');
  sessionStorage.removeItem('mekko-spill-overgang');
  if (!overgang || Date.now() - overgang.naa > 8000) overgang = null;
} catch { overgang = null; }
let minBil = null;
try { minBil = JSON.parse(localStorage.getItem('mekko-spill-bil') || 'null'); } catch { /* ingen lagring */ }

// ---------- Renderer, lys og miljø: likt forsiden ----------
const svak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || navigator.connection?.saveData === true
  || new URLSearchParams(location.search).has('lett');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !svak, powerPreference: 'high-performance' });
renderer.setPixelRatio(svak ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !svak;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0b0d');
scene.fog = new THREE.Fog(scene.background, 18, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, 0.6));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 30 });
sol.shadow.bias = -0.0005;
sol.shadow.normalBias = 0.02;
scene.add(sol, sol.target);

const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
let kam = spillKamera(1);
function tilpassStorrelse() {
  const b = window.innerWidth, h = window.innerHeight;
  renderer.setSize(b, h, false);
  kam = spillKamera(b / h);
  kamera.aspect = b / h;
  kamera.fov = kam.fov;
  kamera.updateProjectionMatrix();
}
tilpassStorrelse();
addEventListener('resize', tilpassStorrelse);

// ---------- Banen og bilen ----------
const bane = lagBane();
const bane3d = lagBane3d(scene, bane);

const bil3d = lagBil();
scene.add(bil3d.gruppe);
const lakk = overgang?.lakk ?? minBil?.lakk;
if (lakk != null) bil3d.lakk.color.setHex(lakk);
for (const i of [0, 2]) {                   // forhjulene (venstre og høyre) svinger
  bil3d.hjul[i].rotation.order = 'YXZ';
  bil3d.hjulStille[i].rotation.order = 'YXZ';
}
if (minBil?.skilt) leggTilSkilt(bil3d, minBil.skilt);

// Midtstripene skal ligge der de lå på forsiden i overgangen: bilen starter litt ut på startrettas
const fase = overgang?.stripeFase ?? 1.5;
const startZ = (((1.5 - fase) % 9) + 9) % 9;

let bil, kamTilstand, kamBilde, runder, spor, tattOver, strekning, hjulvinkel;
let sistFart = -1, meldingTimer = null;
// Sjiraffen fortsetter bevegelsen fra forsiden
const tidStart = performance.now() / 1000 - (overgang ? overgang.tid + (Date.now() - overgang.naa) / 1000 : 0);
const tid = () => performance.now() / 1000 - tidStart;

function nyRunde() {
  bil = nyBil({ x: 0, z: startZ, retning: 0, fart: START_FART });
  kamTilstand = { retning: bil.retning };
  kamBilde = folgKamera(kamTilstand, kam, bil.x, bil.z, bil.retning, 0);
  runder = lagRundeteller(bane.lengde);
  try {
    const lagret = Number(localStorage.getItem(BESTE_NOKKEL));
    if (lagret > 0) runder.beste = lagret;
  } catch { /* ingen lagring */ }
  spor = naermeste(bane, bil.x, bil.z).i;
  tattOver = false;
  strekning = 0;
  hjulvinkel = 0;
  bane3d.nullstill();
  dekkspor.nullstill();
  oppdaterHud(true);
}

// ---------- Dekkspor når bilen skrenser ----------
const dekkspor = (() => {
  const ANTALL = 900;
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.24, 0.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 0.45, depthWrite: false }),
    ANTALL,
  );
  mesh.frustumCulled = false;
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const skjult = new THREE.Matrix4().makeScale(0, 0, 0);
  let neste = 0, sidenSist = 0;     // sidenSist: meter igjen til neste spor
  return {
    nullstill() { for (let i = 0; i < ANTALL; i++) mesh.setMatrixAt(i, skjult); mesh.instanceMatrix.needsUpdate = true; },
    // Legger spor langs strekningen bilen kjørte siden forrige bilde (fra fraX/fraZ), ett par hver 0,4 m
    oppdater(b, fraX, fraZ) {
      const dx = b.x - fraX, dz = b.z - fraZ;
      const lengde = Math.hypot(dx, dz);
      const sin = Math.sin(b.retning), cos = Math.cos(b.retning);
      while (sidenSist <= lengde) {
        const t = lengde ? sidenSist / lengde : 1;
        const x = fraX + dx * t, z = fraZ + dz * t;
        for (const side of [-1, 1]) {
          const lx = side * 0.82, lz = -1.22;      // bakhjulene
          m.makeRotationY(b.retning).setPosition(x + lx * cos + lz * sin, 0.006, z - lx * sin + lz * cos);
          mesh.setMatrixAt(neste, m);
          neste = (neste + 1) % ANTALL;
        }
        sidenSist += 0.4;
      }
      sidenSist -= lengde;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
})();

nyRunde();
const kontroller = lagKontroller(document.getElementById('styre-sone'));

// ---------- Hovedløkka ----------
const klokke = new THREE.Clock();
let forsteBilde = true;
let fokTilSpill = overgang ? 0 : 1;   // tåken trekkes gradvis tilbake etter overgangen
const tmpMal = new THREE.Vector3();

function tegn() {
  const dt = Math.min(klokke.getDelta(), 0.05);

  // Styring: bilen kjører selv i høyre felt til man rører noe
  const inn = kontroller.les(kamBilde);
  if (!tattOver && inn.aktiv) {
    tattOver = true;
    hud.hint.classList.add('skjult');
  }
  let styring = inn;
  if (!tattOver) {
    const naer = naermeste(bane, bil.x, bil.z, spor);
    const p = punktVed(bane, naer.s + 12, -MIDTSTRIPE_X);
    styring = autopilot(bil, p.x, p.z, START_FART);
  }

  const forX = bil.x, forZ = bil.z;
  const naer = naermeste(bane, bil.x, bil.z, spor);
  kjor(bil, styring, dt, { gress: Math.abs(naer.avvik) > VEI_BREDDE / 2 + 0.3 });
  // Autovernet
  const etter = naermeste(bane, bil.x, bil.z, naer.i);
  spor = etter.i;
  const grense = GRENSE - BIL_HALV;
  if (Math.abs(etter.avvik) > grense) {
    const side = Math.sign(etter.avvik);
    stoppMotVegg(bil, etter.nx * side, etter.nz * side, Math.abs(etter.avvik) - grense);
  }
  const kjort = Math.hypot(bil.x - forX, bil.z - forZ);
  strekning += kjort;

  // Rundetid (først når man har tatt over)
  if (tattOver) {
    const hendelse = runder.oppdater(naermeste(bane, bil.x, bil.z, spor).s, tid());
    if (hendelse === 'rekord') {
      try { localStorage.setItem(BESTE_NOKKEL, String(runder.beste)); } catch { /* bare en snarvei */ }
      visMelding(`Ny rekord! ${formaterTid(runder.beste)}`);
    } else if (hendelse === 'runde') {
      visMelding(`Runde ${formaterTid(runder.siste)}`);
    }
  }

  // Bilen i 3D
  bil3d.gruppe.position.set(bil.x, 0, bil.z);
  bil3d.gruppe.rotation.y = bil.retning;
  bil3d.karosseri.position.y = veiHump(strekning);
  bil3d.karosseri.rotation.x = bil.neiing;
  bil3d.karosseri.rotation.z = bil.krengning + Math.sin(strekning * 0.5) * 0.004;
  // Hjulene snurrer saktere enn farten tilsier, som på forsiden, så eikene ikke ser ut til å stå stille
  const fremover = bil.vx * Math.sin(bil.retning) + bil.vz * Math.cos(bil.retning);
  hjulvinkel += dt * Math.PI * 2 * Math.max(-1.3, Math.min(1.3, 0.7 * (fremover / START_FART)));
  for (const h of bil3d.hjul) h.rotation.x = hjulvinkel;
  for (const i of [0, 2]) {
    bil3d.hjul[i].rotation.y = bil.styr;
    bil3d.hjulStille[i].rotation.y = bil.styr;
  }

  bane3d.oppdater(bil.x, bil.z, bil.vx, bil.vz, dt);
  if (bil.skrens > 0.14 && Math.abs(naer.avvik) < VEI_BREDDE / 2 && Math.abs(bil.s) > 0.25) dekkspor.oppdater(bil, forX, forZ);

  // Kameraet og sola følger bilen
  kamBilde = folgKamera(kamTilstand, kam, bil.x, bil.z, bil.retning, dt);
  kamera.position.set(kamBilde.pos.x, kamBilde.pos.y, kamBilde.pos.z);
  kamera.lookAt(tmpMal.set(kamBilde.mal.x, kamBilde.mal.y, kamBilde.mal.z));
  sol.position.set(bil.x + 6, 10, bil.z + 2.2);
  sol.target.position.set(bil.x, 0, bil.z - 1.8);

  // Samme tåke som på forsiden i overgangen, så trekkes den litt tilbake så man ser veien
  fokTilSpill = Math.min(1, fokTilSpill + dt / 2.5);
  const f = fokTilSpill * fokTilSpill * (3 - 2 * fokTilSpill);
  scene.fog.near = 18 + f * 8;
  scene.fog.far = 60 + f * 25;

  if (Math.round(tid() * 10) % 2 === 0) oppdaterHud();
  renderer.render(scene, kamera);

  if (forsteBilde) {
    forsteBilde = false;
    rot.classList.add('i-gang');
    overgangBilde?.classList.add('borte');
    setTimeout(() => overgangBilde?.remove(), 700);
  }
  requestAnimationFrame(tegn);
}
requestAnimationFrame(tegn);

// ---------- Visning over spillet ----------
function formaterTid(sek) {
  if (sek == null) return '–';
  const m = Math.floor(sek / 60);
  const s = sek - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
function oppdaterHud(alt = false) {
  const fart = Math.round(kmt(bil));
  if (alt || fart !== sistFart) { hud.fart.textContent = fart; sistFart = fart; }
  hud.runde.textContent = runder.startTid == null ? '–' : formaterTid(tid() - runder.startTid);
  hud.beste.textContent = formaterTid(runder.beste);
}
function visMelding(tekst) {
  hud.melding.textContent = tekst;
  hud.melding.classList.add('synlig');
  clearTimeout(meldingTimer);
  meldingTimer = setTimeout(() => hud.melding.classList.remove('synlig'), 2200);
}

hud.nyStart.addEventListener('click', () => { nyRunde(); hud.hint.classList.remove('skjult'); hud.nyStart.blur(); });
addEventListener('keydown', (e) => { if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) { nyRunde(); hud.hint.classList.remove('skjult'); } });

// Toppfart brukes i HUD-en som skala for fartsmåleren
document.documentElement.style.setProperty('--toppfart', String(Math.round(VMAKS * 3.6)));

// ---------- Skilt med bilens kjennemerke, foran og bak ----------
function leggTilSkilt(bil, kjennemerke) {
  const c = document.createElement('canvas');
  c.width = 520; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 520, 112);
  g.fillStyle = '#1f3f8f';
  g.fillRect(0, 0, 56, 112);
  g.fillStyle = '#ffffff';
  g.font = '600 30px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('N', 28, 92);
  g.fillStyle = '#111214';
  g.font = '700 74px "Helvetica Neue", Arial, sans-serif';
  g.textBaseline = 'middle';
  const tekst = String(kjennemerke).toUpperCase().replace(/^([A-ZÆØÅ]{2})(\d+)$/, '$1 $2');
  g.fillText(tekst, 290, 60, 440);
  g.strokeStyle = '#111214';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 516, 108);
  const tekstur = new THREE.CanvasTexture(c);
  tekstur.colorSpace = THREE.SRGBColorSpace;
  tekstur.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tekstur, roughness: 0.4 });
  for (const { x = 0, y, z, ry } of bil.skiltFeste) {
    const skilt = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.112), mat);
    skilt.position.set(x, y, z);
    skilt.rotation.y = ry;
    bil.karosseri.add(skilt);
  }
}

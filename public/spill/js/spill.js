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
// Hvert bakhjul tegner et sammenhengende bånd: hvert nytt stykke starter der det forrige sluttet,
// så sporet blir en jevn stripe gjennom svingen. Kantene er myke, og sporet er mørkere jo mer
// bilen skrenser. Stykkene ligger i en ringbuffer, så de eldste forsvinner når den er full.
const dekkspor = (() => {
  const ANTALL = 1600;                 // stykker totalt (begge hjul)
  const BREDDE = 0.22;
  const STEG = 0.12;                   // nytt stykke for hver 12. cm
  const pos = new Float32Array(ANTALL * 4 * 3);
  const farge = new Float32Array(ANTALL * 4 * 4);
  const uv = new Float32Array(ANTALL * 4 * 2);
  const indeks = new Uint32Array(ANTALL * 6);
  for (let i = 0; i < ANTALL; i++) {
    uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8);
    indeks.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(farge, 4));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(indeks, 1));
  // Myke kanter på tvers av sporet
  const kant = (() => {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 1;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 32, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.25, 'rgba(255,255,255,1)');
    grad.addColorStop(0.75, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 1);
    return new THREE.CanvasTexture(c);
  })();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0x050506, map: kant, vertexColors: true, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  let neste = 0;
  // Per hjul: forrige punkt på bakken, kantene der, og styrken der
  const hjul = [-1, 1].map((side) => ({ side, sist: null }));
  let aktiv = false;

  function leggStykke(h, x, z, styrke) {
    const dx = x - h.sist.x, dz = z - h.sist.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * BREDDE / 2, nz = (dx / l) * BREDDE / 2;
    const y = 0.006;
    const i = neste;
    neste = (neste + 1) % ANTALL;
    pos.set([h.sist.vx, y, h.sist.vz, h.sist.hx, y, h.sist.hz, x + nx, y, z + nz, x - nx, y, z - nz], i * 12);
    for (const [k, a] of [[0, h.sist.styrke], [1, h.sist.styrke], [2, styrke], [3, styrke]]) farge.set([1, 1, 1, a], i * 16 + k * 4);
    h.sist = { x, z, vx: x + nx, vz: z + nz, hx: x - nx, hz: z - nz, styrke };
  }

  return {
    nullstill() {
      farge.fill(0);
      geo.attributes.color.needsUpdate = true;
      for (const h of hjul) h.sist = null;
      aktiv = false;
    },
    // Kalles hvert bilde. skrenser: om bilen skrenser på veien nå
    oppdater(b, skrenser) {
      // Litt treghet, så sporet ikke blinker av og på rundt grensen
      aktiv = skrenser ? true : aktiv && b.skrens > 0.1 && Math.abs(b.s) > 0.2;
      const sin = Math.sin(b.retning), cos = Math.cos(b.retning);
      const styrke = aktiv ? Math.min(0.55, 0.2 + (b.skrens - 0.1) * 1.2) : 0;
      let endret = false;
      for (const h of hjul) {
        const lx = h.side * 0.82, lz = -1.22;   // bakhjulene
        const x = b.x + lx * cos + lz * sin, z = b.z - lx * sin + lz * cos;
        if (!aktiv) {
          // Sporet tones ut på det siste stykket før det slutter
          if (h.sist) { leggStykke(h, x, z, 0); endret = true; }
          h.sist = null;
          continue;
        }
        if (!h.sist) {
          h.sist = { x, z, vx: x, vz: z, hx: x, hz: z, styrke: 0 };
          continue;
        }
        if (Math.hypot(x - h.sist.x, z - h.sist.z) >= STEG) { leggStykke(h, x, z, styrke); endret = true; }
      }
      if (endret) {
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      }
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
  dekkspor.oppdater(bil, bil.skrens > 0.14 && Math.abs(naer.avvik) < VEI_BREDDE / 2 && Math.abs(bil.s) > 0.25);

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

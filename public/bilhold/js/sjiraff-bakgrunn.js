// Sjiraffhodet som bakgrunn på innloggingssiden. Samme sjiraff og samme kameravinkel som
// forsiden ender på når man trykker «Logg inn», så overgangen blir sømløs.
// Tegnes bare mens innloggingsskjemaet vises.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lagSjiraff, sjiraffKamera } from './tilhenger.js';

const canvas = document.getElementById('sjiraff-bakgrunn');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0b0d');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, 0.6));
const sol = new THREE.DirectionalLight(0xffffff, 2.2);
sol.position.set(6, 10, 4);                 // samme retning som sola på forsiden
scene.add(sol);

const sjiraff = lagSjiraff();
scene.add(sjiraff.gruppe);

const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
const hodePos = new THREE.Vector3();
const pos = new THREE.Vector3();
const mal = new THREE.Vector3();
let fov = 40;

function tilpass() {
  const b = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(b, h, false);
  fov = b / h < 1 ? 50 : 38;                // samme som forsiden
  kamera.fov = fov;
  kamera.aspect = b / h;
  kamera.updateProjectionMatrix();
}
tilpass();
window.addEventListener('resize', tilpass);

const laster = document.getElementById('laster');
const innlogging = document.getElementById('innlogging');
const klokke = new THREE.Clock();

function tegn() {
  const synlig = !laster.hidden || !innlogging.hidden;
  document.documentElement.classList.toggle('uten-sjiraff', !synlig);
  if (synlig) {
    sjiraff.oppdater(klokke.getElapsedTime());
    sjiraff.hode.getWorldPosition(hodePos);
    sjiraffKamera(hodePos, window.innerWidth / window.innerHeight, fov, pos, mal);
    kamera.position.copy(pos);
    kamera.lookAt(mal);
    renderer.render(scene, kamera);
  }
  requestAnimationFrame(tegn);
}
requestAnimationFrame(tegn);

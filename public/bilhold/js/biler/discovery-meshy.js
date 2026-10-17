// Discovery 3 fra Meshy: en ferdig 3D-modell (ett nett med tekstur) i stedet for et karosseri bygget i kode.
// Filen (/bilhold/modeller/discovery3-meshy.json) har geometrien som base64-tabeller (pos, nrm, uv, idx)
// og to JPEG-teksturer (map = farge, mr = metall/ruhet). Den lastes først når modellen velges.
// Hjulene i modellen tas bort, og de vanlige hjulene med bremser settes inn, så hjulene snurrer og
// bremser og dekk kan lyse i statusfarge. Panseret kan ikke åpnes, og lakkfargen følger ikke registreringen.

import * as THREE from 'three';

const FIL = '/bilhold/modeller/discovery3-meshy.json';

// Samme aksler som Discovery 3 i kode, så hengerfestet havner på samme sted
const FORAKSEL = 1.53;
const BAKAKSEL = -1.355;

// Målt i Meshy-modellen (dens enheter): fronten peker mot -x, bredden ligger langs z
const M_FORAKSEL = -0.608;
const M_BAKAKSEL = 0.547;
const M_HJULSENTER_Y = -0.258;
const M_HJULRADIUS = 0.175;  // litt større enn dekket (0,163), så hele dekket forsvinner
const M_HJUL_INNSIDE = 0.24;     // |z| større enn dette er hjulet (resten er hjulbrønn og undervogn)

const SKALA = (FORAKSEL - BAKAKSEL) / (M_BAKAKSEL - M_FORAKSEL);
const SMAL = 0.95;               // Meshy-bilen er litt for bred
const HJULRADIUS = 0.39;

const fraBase64 = (tekst) => Uint8Array.from(atob(tekst), (c) => c.charCodeAt(0));

function tekstur(base64, farge) {
  return new Promise((ok, feil) => {
    const bilde = new Image();
    bilde.onload = () => {
      const t = new THREE.Texture(bilde);
      t.flipY = false;
      if (farge) t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      ok(t);
    };
    bilde.onerror = () => feil(new Error('teksturen kunne ikke leses'));
    bilde.src = 'data:image/jpeg;base64,' + base64;
  });
}

// Fjerner trekantene som tilhører hjulene (alle tre hjørnene inne i et hjul)
function utenHjul(pos, idx) {
  const iHjul = (i) => {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (Math.abs(z) < M_HJUL_INNSIDE) return false;
    return [M_FORAKSEL, M_BAKAKSEL].some((ax) => Math.hypot(x - ax, y - M_HJULSENTER_Y) < M_HJULRADIUS);
  };
  const behold = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (!(iHjul(idx[t]) && iHjul(idx[t + 1]) && iHjul(idx[t + 2]))) behold.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return new Uint32Array(behold);
}

async function lastNett() {
  const svar = await fetch(FIL);
  if (!svar.ok) throw new Error('modellfilen svarte ' + svar.status);
  const d = await svar.json();
  const pos = new Float32Array(fraBase64(d.pos).buffer);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(fraBase64(d.nrm).buffer), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(fraBase64(d.uv).buffer), 2));
  geo.setIndex(new THREE.BufferAttribute(utenHjul(pos, new Uint32Array(fraBase64(d.idx).buffer)), 1));
  let map = null, mr = null;
  try { [map, mr] = await Promise.all([tekstur(d.map, true), tekstur(d.mr, false)]); }
  catch (e) { console.warn('Meshy-bilen vises uten tekstur', e); }
  const mat = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : 0xc9bfa8, map, metalnessMap: mr, roughnessMap: mr,
    roughness: 1, metalness: mr ? 1 : 0.1, side: THREE.DoubleSide, envMapIntensity: 0.7,
  });
  const nett = new THREE.Mesh(geo, mat);
  nett.castShadow = true;
  nett.receiveShadow = true;
  // Fronten (-x) skal peke mot +z og bredden (z) ligge langs x: snu 90° om y
  nett.rotation.y = Math.PI / 2;
  nett.scale.set(SKALA, SKALA, SKALA * SMAL);
  nett.position.set(0, HJULRADIUS - M_HJULSENTER_Y * SKALA, FORAKSEL + M_FORAKSEL * SKALA);
  return nett;
}

export const discovery3Meshy = {
  navn: 'Discovery 3 (Meshy)',
  hjulradius: HJULRADIUS,
  hjulbredde: 0.24,
  foraksel: FORAKSEL,
  bakaksel: BAKAKSEL,
  sporvidde: 0.83,
  bredde: 1.92,
  front: 2.3,
  bak: -2.35,
  felg: { radius: 0.25, eiker: 7, eikebredde: 0.05 },
  bremse: { skala: 1.08, kaliper: 'flytende' },
  kupe: { bredde: 1.72, forskyv: [0, 0, 0.33] },
  karosseri({ karosseri, gruppe }) {
    // Panseret finnes ikke som egen del. Motorpunktet ligger midt på panseret.
    const panser = new THREE.Object3D();
    const oljelokk = new THREE.Object3D();
    oljelokk.position.set(0, 1.25, 1.75);
    karosseri.add(panser, oljelokk);
    const klar = lastNett()
      .then((nett) => {
        if (gruppe.parent) { karosseri.add(nett); return; }
        // Modellen ble byttet før filen var lastet
        nett.geometry.dispose();
        nett.material.map?.dispose();
        nett.material.metalnessMap?.dispose();
        nett.material.dispose();
      })
      .catch((e) => console.error('Kunne ikke laste Meshy-bilen', e));
    return { panser, oljelokk, klar };
  },
};

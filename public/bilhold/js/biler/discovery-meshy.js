// Discovery 3 fra Meshy: en ferdig 3D-modell (ett nett med tekstur) i stedet for et karosseri bygget i kode.
// Filen (/bilhold/modeller/discovery3-meshy.json) har geometrien som base64-tabeller (pos, nrm, uv, idx)
// og to JPEG-teksturer (map = farge, mr = metall/ruhet). Den lastes først når modellen velges.
// Modellen tilpasses resten av 3D-scenen:
// - Hjulene i nettet tas bort og byttes med de vanlige, så hjulene snurrer og bremser og dekk lyser i statusfarge.
// - Panseret skjæres ut som egen del som kan åpnes, og under det bygges et motorrom med oljelokk og oljefilter.
// - Lakken (lyse, gråaktige punkter i teksturen) får bilens farge, og ruter (mørke, blanke punkter) blir
//   gjennomsiktige når bilen skannes.

import * as THREE from 'three';
import { discovery3 as discovery3Kode } from './discovery.js';

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

// Panseret i scenens mål: flatene som vender opp mellom frontruta og fronten, innenfor skjermene
const PANSER = { fraZ: 1.12, tilZ: 2.32, halvB: 0.8, overY: 1.0 };
const HENGSEL = { y: 1.3, z: 1.12 };

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

// Hjørne i i scenens mål (samme plassering som nettet får under)
const tilScene = (pos, i) => [
  pos[i * 3 + 2] * SKALA * SMAL,
  pos[i * 3 + 1] * SKALA + HJULRADIUS - M_HJULSENTER_Y * SKALA,
  -pos[i * 3] * SKALA + FORAKSEL + M_FORAKSEL * SKALA,
];

// Deler trekantene i karosseri og panser
function delPanser(pos, idx) {
  const kropp = [], panser = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => tilScene(pos, i));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const opp = Math.abs(n[1]) / (Math.hypot(...n) || 1);
    const inne = [a, b, c].every(([x, y, z]) => z > PANSER.fraZ && z < PANSER.tilZ && Math.abs(x) < PANSER.halvB && y > PANSER.overY);
    (inne && opp > 0.5 ? panser : kropp).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return { kropp: new Uint32Array(kropp), panser: new Uint32Array(panser) };
}

// Lakk og ruter gjenkjennes på fargen i teksturen (og ruhet for rutene)
function tilpassMateriale(m, mat) {
  m.transparent = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uLakk = { value: mat.solv.color };
    shader.uniforms.uGlod = { value: mat.solv.emissive };
    shader.uniforms.uGlass = { get value() { return mat.glass.opacity; } };
    shader.fragmentShader = 'uniform vec3 uLakk; uniform vec3 uGlod; uniform float uGlass;\nfloat lakkMaske = 0.0;\n' +
      shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec3 s = pow(sampledDiffuseColor.rgb, vec3(1.0 / 2.2));
            float lys = dot(s, vec3(0.333));
            float metning = (max(s.r, max(s.g, s.b)) - min(s.r, min(s.g, s.b))) / (max(s.r, max(s.g, s.b)) + 0.004);
            lakkMaske = smoothstep(0.36, 0.44, lys) * (1.0 - smoothstep(0.2, 0.28, metning));
            lakkMaske *= 1.0 - smoothstep(0.3, 0.45, texture2D(roughnessMap, vRoughnessMapUv).g);   // lakken er blank, lykteglasset matt i teksturen
            // Lakken blir én jevn farge (som resten av Mekkoo), med litt av teksturens skygge igjen
            float skygge = 0.85 * mix(1.0, clamp(lys / 0.62, 0.6, 1.25), 0.3);   // lakken er mindre metallisk her enn på kodebilene
            diffuseColor.rgb = mix(diffuseColor.rgb, uLakk * skygge, lakkMaske);
          }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          {
            vec3 s = pow(sampledDiffuseColor.rgb, vec3(1.0 / 2.2));
            float glassMaske = (1.0 - smoothstep(0.22, 0.3, dot(s, vec3(0.333)))) * (1.0 - smoothstep(0.2, 0.3, texelRoughness.g));
            diffuseColor.a *= mix(1.0, uGlass, glassMaske);
          }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlod * lakkMaske;');
  };
}

async function lastNett(mat) {
  const svar = await fetch(FIL);
  if (!svar.ok) throw new Error('modellfilen svarte ' + svar.status);
  const d = await svar.json();
  const pos = new Float32Array(fraBase64(d.pos).buffer);
  const attributter = {
    position: new THREE.BufferAttribute(pos, 3),
    normal: new THREE.BufferAttribute(new Float32Array(fraBase64(d.nrm).buffer), 3),
    uv: new THREE.BufferAttribute(new Float32Array(fraBase64(d.uv).buffer), 2),
  };
  const deler = delPanser(pos, utenHjul(pos, new Uint32Array(fraBase64(d.idx).buffer)));
  let map = null, mr = null;
  try { [map, mr] = await Promise.all([tekstur(d.map, true), tekstur(d.mr, false)]); }
  catch (e) { console.warn('Meshy-bilen vises uten tekstur', e); }
  const materiale = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : 0xc9bfa8, map, metalnessMap: mr, roughnessMap: mr,
    roughness: 1, metalness: mr ? 1 : 0.1, side: THREE.DoubleSide, envMapIntensity: 0.7,
  });
  if (map && mr) tilpassMateriale(materiale, mat);
  const lagNett = (indekser) => {
    const geo = new THREE.BufferGeometry();
    for (const [navn, a] of Object.entries(attributter)) geo.setAttribute(navn, a);
    geo.setIndex(new THREE.BufferAttribute(indekser, 1));
    const nett = new THREE.Mesh(geo, materiale);
    nett.castShadow = true;
    nett.receiveShadow = true;
    // Fronten (-x) skal peke mot +z og bredden (z) ligge langs x: snu 90° om y
    nett.rotation.y = Math.PI / 2;
    nett.scale.set(SKALA, SKALA, SKALA * SMAL);
    nett.position.set(0, HJULRADIUS - M_HJULSENTER_Y * SKALA, FORAKSEL + M_FORAKSEL * SKALA);
    return nett;
  };
  return { kropp: lagNett(deler.kropp), panser: lagNett(deler.panser) };
}

// Motorrom under panseret: mørkt kar med V6-motor, oljelokk og oljefilter (som lyser i motorstatusen)
function byggMotorrom(karosseri, mat, boks, fboks) {
  const { motorrom, motorMat, oljeMat, plast } = mat;
  const fra = PANSER.fraZ + 0.02, til = 2.08, b = 1.26, bunn = 0.72, topp = 1.06;
  boks(b, 0.02, til - fra, motorrom, 0, bunn, (fra + til) / 2);
  boks(b, topp - bunn, 0.03, motorrom, 0, (topp + bunn) / 2, fra);
  boks(b, topp - bunn - 0.08, 0.03, motorrom, 0, (topp + bunn - 0.08) / 2, til);
  for (const s of [-1, 1]) boks(0.03, topp - bunn, til - fra, motorrom, s * b / 2, (topp + bunn) / 2, (fra + til) / 2);
  const motorZ = 1.65;
  const deksel = new THREE.MeshStandardMaterial({ color: 0x222326, metalness: 0.3, roughness: 0.6 });
  boks(0.6, 0.16, 0.68, motorMat, 0, 0.86, motorZ);
  fboks(0.74, 0.12, 0.7, deksel, 0, 0.98, motorZ, 0.04);
  for (const z of [-0.2, 0, 0.2]) boks(0.56, 0.015, 0.05, deksel, 0, 1.045, motorZ + z);
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 20), oljeMat);
  oljelokk.position.set(0.2, 1.06, motorZ + 0.22);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 20), oljeMat);
  oljefilter.position.set(-0.12, 0.96, motorZ + 0.4);
  karosseri.add(oljefilter);
  fboks(0.2, 0.16, 0.4, plast, -0.45, 0.93, 1.4, 0.03);                              // luftfilterboks
  return oljelokk;
}

export const discovery3Meshy = {
  navn: 'Discovery 3',
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
  karosseri(ctx) {
    const { karosseri, gruppe, mat, boks, fboks } = ctx;
    // Mens filen lastes (eller hvis den ikke kan lastes) vises Discovery 3 bygget i kode
    const reserve = new THREE.Group();
    karosseri.add(reserve);
    discovery3Kode.karosseri({
      ...ctx,
      karosseri: reserve,
      boks: (b, h, l, m, x, y, z, f = reserve) => boks(b, h, l, m, x, y, z, f),
      fboks: (b, h, l, m, x, y, z, fas = 0.02, f = reserve) => fboks(b, h, l, m, x, y, z, fas, f),
      sideplate: (p, t, m, x, hull = [], f = reserve, fas = 0) => ctx.sideplate(p, t, m, x, hull, f, fas),
      rund: (r, t, m, x, y, z, f = reserve, seg = 24) => ctx.rund(r, t, m, x, y, z, f, seg),
    });
    const oljelokk = byggMotorrom(karosseri, mat, boks, fboks);
    // Panseret er hengslet ved frontruta. Delen fra nettet legges i hengselgruppen når filen er lastet.
    const panser = new THREE.Group();
    panser.position.set(0, HENGSEL.y, HENGSEL.z);
    karosseri.add(panser);
    // Mørk innside under panseret, så de ujevne kantene fra nettet ikke synes når det står åpent
    const fall = Math.atan2(0.2, 1.13);
    boks(1.24, 0.02, 0.98, mat.motorrom, 0, -0.08 - 0.09, 0.52, panser).rotation.x = fall;
    const klar = lastNett(mat)
      .then(({ kropp, panser: panserNett }) => {
        if (!gruppe.parent) {
          // Modellen ble byttet før filen var lastet
          kropp.geometry.dispose();
          kropp.material.map?.dispose();
          kropp.material.metalnessMap?.dispose();
          kropp.material.dispose();
          return;
        }
        reserve.removeFromParent();
        reserve.traverse((o) => o.geometry?.dispose());
        karosseri.add(kropp);
        panserNett.position.y -= HENGSEL.y;
        panserNett.position.z -= HENGSEL.z;
        panser.add(panserNett);
      })
      .catch((e) => console.error('Kunne ikke laste Meshy-bilen', e));
    return { panser, oljelokk, klar, panserMaks: 0.95 };
  },
};

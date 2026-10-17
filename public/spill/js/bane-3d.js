// Banen i 3D, i samme stil som veien på forsiden (scene.js): mørk asfalt, hvite kantlinjer,
// stiplet midtstripe, brøytestikker og enkle kjegletrær. I tillegg autovern langs kanten
// og en portal over start/mål. Banens form kommer fra banedata.js.

import * as THREE from 'three';
import { VEI_BREDDE, KANTLINJE, STIKKE, GRENSE, MAAL_S, punktVed, naermeste } from './banedata.js';

const FARGER = {
  bg: 0x0a0b0d,
  gress: 0x1d2a1f,
  vei: 0x2a2c30,
  linje: 0xd9dadc,
  stamme: 0x4a3b2f,
  krone: 0x2f4a33,
};

// Bånd langs banen mellom to sideavstander (positive til venstre), som én geometri
function baand(bane, fra, til, y) {
  const { punkter } = bane;
  const n = punkter.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const p = punkter[i];
    pos.set([p.x + p.nx * fra, y, p.z + p.nz * fra, p.x + p.nx * til, y, p.z + p.nz * til], i * 6);
  }
  const indekser = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    indekser.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(indekser);
  geo.computeVertexNormals();   // fra < til gir flater som peker opp
  return geo;
}

// Stående bånd (autovern) i en gitt sideavstand
function vegg(bane, side, y0, y1) {
  const { punkter } = bane;
  const n = punkter.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const p = punkter[i];
    const x = p.x + p.nx * side, z = p.z + p.nz * side;
    pos.set([x, y0, z, x, y1, z], i * 6);
  }
  const indekser = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    indekser.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(indekser);
  geo.computeVertexNormals();
  return geo;
}

function lagTilfeldig(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function lagBane3d(scene, bane) {
  const { punkter } = bane;
  const linjeMat = new THREE.MeshBasicMaterial({ color: FARGER.linje });

  // Gress under alt
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of punkter) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const gressMat = new THREE.MeshStandardMaterial({ color: FARGER.gress, roughness: 1 });
  const gress = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX + 600, maxZ - minZ + 600), gressMat);
  gress.rotation.x = -Math.PI / 2;
  gress.position.set((minX + maxX) / 2, -0.01, (minZ + maxZ) / 2);
  gress.receiveShadow = true;
  scene.add(gress);

  // Asfalt, kantlinjer og midtstripe
  const veiMat = new THREE.MeshStandardMaterial({ color: FARGER.vei, roughness: 0.92 });
  const vei = new THREE.Mesh(baand(bane, -VEI_BREDDE / 2, VEI_BREDDE / 2, 0), veiMat);
  vei.receiveShadow = true;
  scene.add(vei);
  for (const s of [-1, 1]) {
    scene.add(new THREE.Mesh(baand(bane, s * KANTLINJE - 0.06, s * KANTLINJE + 0.06, 0.002), linjeMat));
  }
  const striper = [];
  for (let s = 0; s < bane.lengde - 3; s += 9) {
    const a = punktVed(bane, s), b = punktVed(bane, s + 3);
    const w = 0.06;
    striper.push(
      a.x + a.tz * w, 0.003, a.z - a.tx * w, b.x + b.tz * w, 0.003, b.z - b.tx * w, a.x - a.tz * w, 0.003, a.z + a.tx * w,
      a.x - a.tz * w, 0.003, a.z + a.tx * w, b.x + b.tz * w, 0.003, b.z - b.tx * w, b.x - b.tz * w, 0.003, b.z + b.tx * w,
    );
  }
  const stripeGeo = new THREE.BufferGeometry();
  stripeGeo.setAttribute('position', new THREE.Float32BufferAttribute(striper, 3));
  const stripeMat = linjeMat.clone();
  stripeMat.side = THREE.DoubleSide;
  scene.add(new THREE.Mesh(stripeGeo, stripeMat));

  // Autovern: skinne på stolper, der bilen ikke kommer lenger
  const vernMat = new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const skinne = new THREE.Mesh(vegg(bane, s * GRENSE, 0.45, 0.75), vernMat);
    skinne.castShadow = true;
    scene.add(skinne);
  }
  const stolpeMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.6 });
  const antallStolper = Math.floor(bane.lengde / 4);
  const stolper = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), stolpeMat, antallStolper * 2);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < antallStolper; i++) {
    for (const s of [-1, 1]) {
      const p = punktVed(bane, i * 4, s * (GRENSE + 0.08));
      m.makeTranslation(p.x, 0.4, p.z);
      stolper.setMatrixAt(k++, m);
    }
  }
  stolper.castShadow = true;
  scene.add(stolper);

  // Brøytestikker på begge sider. De velter hvis man kjører på dem.
  const stikker = [];
  for (let s = 6; s < bane.lengde; s += 25) {
    for (const side of [-1, 1]) {
      const p = punktVed(bane, s + (side > 0 ? 12.5 : 0), side * STIKKE);
      stikker.push({ x: p.x, z: p.z, vinkel: 0, fart: 0, akse: new THREE.Vector3(), dx: 0, dz: 0 });
    }
  }
  const stangGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6).translate(0, 0.9, 0);
  const refleksGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6).translate(0, 1.6, 0);
  const stenger = new THREE.InstancedMesh(stangGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }), stikker.length);
  const reflekser = new THREE.InstancedMesh(refleksGeo, new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0x552200, roughness: 0.4 }), stikker.length);
  stenger.castShadow = true;
  scene.add(stenger, reflekser);
  const q = new THREE.Quaternion();
  const en = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  function tegnStikker() {
    stikker.forEach((st, i) => {
      q.setFromAxisAngle(st.akse, st.vinkel);
      pos.set(st.x + st.dx, 0, st.z + st.dz);
      m.compose(pos, q, en);
      stenger.setMatrixAt(i, m);
      reflekser.setMatrixAt(i, m);
    });
    stenger.instanceMatrix.needsUpdate = true;
    reflekser.instanceMatrix.needsUpdate = true;
  }
  tegnStikker();

  // Trær utenfor autovernet, samme kjegletrær som på forsiden
  const tilfeldig = lagTilfeldig(7);
  const traer = [];
  let forsok = 0;
  while (traer.length < 260 && forsok++ < 6000) {
    const x = minX - 70 + tilfeldig() * (maxX - minX + 140);
    const z = minZ - 70 + tilfeldig() * (maxZ - minZ + 140);
    const { avvik } = naermeste(bane, x, z);
    if (Math.abs(avvik) < GRENSE + 2.5) continue;
    traer.push({ x, z, h: 2.5 + tilfeldig() * 2.5 });
  }
  const stammer = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: FARGER.stamme, roughness: 1 }), traer.length);
  const kroner = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.28, 0.8, 7).translate(0, 0.75, 0),
    new THREE.MeshStandardMaterial({ color: FARGER.krone, roughness: 1, flatShading: true }), traer.length);
  traer.forEach((t, i) => {
    m.makeScale(1, t.h * 0.35, 1).setPosition(t.x, 0, t.z);
    stammer.setMatrixAt(i, m);
    m.makeScale(t.h, t.h, t.h).setPosition(t.x, 0, t.z);
    kroner.setMatrixAt(i, m);
  });
  kroner.castShadow = true;
  scene.add(stammer, kroner);

  // Start og mål: sjakkrutet stripe over veien og en portal med logoen
  const maal = punktVed(bane, MAAL_S);
  const retning = Math.atan2(maal.tx, maal.tz);
  const ruter = document.createElement('canvas');
  ruter.width = 160; ruter.height = 16;
  const g = ruter.getContext('2d');
  for (let i = 0; i < 20; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? '#d9dadc' : '#16171a';
    g.fillRect(i * 8, j * 8, 8, 8);
  }
  const ruteTekstur = new THREE.CanvasTexture(ruter);
  ruteTekstur.colorSpace = THREE.SRGBColorSpace;
  ruteTekstur.magFilter = THREE.NearestFilter;
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(VEI_BREDDE, 0.75).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ruteTekstur }));
  stripe.rotation.y = retning;
  stripe.position.set(maal.x, 0.004, maal.z);
  scene.add(stripe);

  const portal = new THREE.Group();
  portal.position.set(maal.x, 0, maal.z);
  portal.rotation.y = retning;
  const portalMat = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.3, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const stolpe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.4, 0.25), portalMat);
    stolpe.position.set(s * (VEI_BREDDE / 2 + 0.9), 2.7, 0);
    stolpe.castShadow = true;
    portal.add(stolpe);
  }
  const skilt = document.createElement('canvas');
  skilt.width = 1024; skilt.height = 128;
  const sg = skilt.getContext('2d');
  sg.fillStyle = '#0d0e10';
  sg.fillRect(0, 0, 1024, 128);
  sg.fillStyle = '#f2f3f5';
  sg.font = '700 64px -apple-system, "Helvetica Neue", Arial, sans-serif';
  sg.textAlign = 'center';
  sg.textBaseline = 'middle';
  if ('letterSpacing' in sg) sg.letterSpacing = '26px';
  sg.fillText('MEKKOO', 524, 66);
  const skiltTekstur = new THREE.CanvasTexture(skilt);
  skiltTekstur.colorSpace = THREE.SRGBColorSpace;
  skiltTekstur.anisotropy = 4;
  const skiltMat = new THREE.MeshStandardMaterial({ map: skiltTekstur, roughness: 0.5, emissive: 0xffffff, emissiveMap: skiltTekstur, emissiveIntensity: 0.35 });
  const bjelke = new THREE.Mesh(new THREE.BoxGeometry(VEI_BREDDE + 2.05, 1.0, 0.3), [portalMat, portalMat, portalMat, portalMat, portalMat, skiltMat]);
  bjelke.position.set(0, 5.1, 0);
  bjelke.castShadow = true;
  portal.add(bjelke);
  scene.add(portal);

  return {
    gressMat,
    veiMat,
    // Velter brøytestikker bilen kjører på, og lar dem falle ferdig
    oppdater(bilX, bilZ, vx, vz, dt) {
      let endret = false;
      for (const st of stikker) {
        if (st.fart === 0 && st.vinkel === 0) {
          const dx = st.x - bilX, dz = st.z - bilZ;
          if (dx * dx + dz * dz < 1.4 * 1.4 && Math.hypot(vx, vz) > 1) {
            const l = Math.hypot(vx, vz);
            st.akse.set(vz / l, 0, -vx / l);   // velter i fartsretningen
            st.fart = 2 + l * 0.25;
            st.skyv = { x: vx * 0.25, z: vz * 0.25 };
          }
        }
        if (st.fart > 0) {
          st.vinkel = Math.min(Math.PI / 2 - 0.03, st.vinkel + st.fart * dt);
          st.dx += st.skyv.x * dt;
          st.dz += st.skyv.z * dt;
          st.skyv.x *= 1 - Math.min(1, dt * 3);
          st.skyv.z *= 1 - Math.min(1, dt * 3);
          if (st.vinkel >= Math.PI / 2 - 0.03 && Math.hypot(st.skyv.x, st.skyv.z) < 0.05) st.fart = 0;
          endret = true;
        }
      }
      if (endret) tegnStikker();
    },
    // Reiser alle stikkene igjen (ny runde fra start)
    nullstill() {
      for (const st of stikker) Object.assign(st, { vinkel: 0, fart: 0, dx: 0, dz: 0 });
      tegnStikker();
    },
  };
}

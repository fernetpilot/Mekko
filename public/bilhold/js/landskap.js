// Norsk landskap langs veien: gran, bjørk og furu, einerbusker, steiner, skigard,
// en rød låve og åser i det fjerne. Verden flytter seg bakover mens bilen står stille.
// Hvert tre og hver busk er slått sammen til én figur, så det blir få tegnekall.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LENGDE = 140;
// Bilen kjører i høyre felt, så midtstripen ligger på bilens venstre side (+x)
const MIDTSTRIPE_X = 1.9;
const VEI_B = 7.5;

export function lagOmgivelser(scene, farger) {
  const flyttbare = [];
  const leggTil = (obj, z) => {
    flyttbare.push({ obj, start: z });
    scene.add(obj);
  };

  // ---------- Bakke og vei ----------
  // Gresset har litt variasjon i fargen (lyse og mørke flekker), som en slått eng
  const gressGeo = new THREE.PlaneGeometry(200, 200, 60, 60);
  {
    const farge = [];
    const t = lagTilfeldig(3);
    const pos = gressGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const v = 0.86 + 0.14 * Math.sin(x * 0.21 + Math.sin(y * 0.13) * 2) * Math.cos(y * 0.17) + t() * 0.08;
      farge.push(v, v * (0.98 + t() * 0.04), v * 0.95);
    }
    gressGeo.setAttribute('color', new THREE.Float32BufferAttribute(farge, 3));
  }
  const gressMat = new THREE.MeshStandardMaterial({ color: farger.gress, roughness: 1, vertexColors: true });
  const gress = new THREE.Mesh(gressGeo, gressMat);
  gress.rotation.x = -Math.PI / 2;
  gress.position.y = -0.01;
  gress.receiveShadow = true;
  scene.add(gress);

  // Asfalt med fin struktur og litt slitte hjulspor
  const veiTekstur = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 512);
    const t = lagTilfeldig(5);
    for (let i = 0; i < 9000; i++) {
      const v = 222 + Math.floor(t() * 33);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(t() * 256, t() * 512, 1 + t() * 2, 1 + t() * 2);
    }
    // Hjulspor: litt mørkere striper i begge felt
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (const x of [30, 80, 160, 210]) g.fillRect(x, 0, 18, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 20);
    tex.anisotropy = 4;
    return tex;
  })();
  const veiMat = new THREE.MeshStandardMaterial({ color: farger.vei, roughness: 0.92, map: veiTekstur });
  const vei = new THREE.Mesh(new THREE.PlaneGeometry(VEI_B, 200), veiMat);
  vei.rotation.x = -Math.PI / 2;
  vei.position.x = MIDTSTRIPE_X;
  vei.receiveShadow = true;
  scene.add(vei);
  // Grusskulder langs veikanten
  const skulderMat = new THREE.MeshStandardMaterial({ color: 0x6b665c, roughness: 1 });
  for (const s of [-1, 1]) {
    const skulder = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 200), skulderMat);
    skulder.rotation.x = -Math.PI / 2;
    skulder.position.set(MIDTSTRIPE_X + s * (VEI_B / 2 + 0.35), -0.004, 0);
    skulder.receiveShadow = true;
    scene.add(skulder);
  }

  // Hvite kantlinjer og gul, stiplet midtlinje, som på norske veier
  const linjeMat = new THREE.MeshBasicMaterial({ color: 0xd9dadc });
  const gulMat = new THREE.MeshBasicMaterial({ color: 0xe0a91b });
  for (const x of [MIDTSTRIPE_X - 3.6, MIDTSTRIPE_X + 3.6]) {
    const kant = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 200), linjeMat);
    kant.rotation.x = -Math.PI / 2;
    kant.position.set(x, 0.002, 0);
    scene.add(kant);
  }
  const stripeGeo = new THREE.PlaneGeometry(0.12, 3);
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 9) {
    const s = new THREE.Mesh(stripeGeo, gulMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(MIDTSTRIPE_X, 0.003, z);
    leggTil(s, z);
  }

  // Brøytestikker på høyre side av kjøreretningen (-x). På siden nærmest kameraet ble de forstyrrende.
  const stikkeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const refleksMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0x552200, roughness: 0.4 });
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 25) {
    const g = new THREE.Group();
    const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), stikkeMat);
    stang.position.y = 0.9;
    const refleks = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), refleksMat);
    refleks.position.y = 1.6;
    g.add(stang, refleks);
    g.position.set(MIDTSTRIPE_X - 4.4, 0, z);
    leggTil(g, z);
  }

  // ---------- Trær, busker og steiner ----------
  const t = lagTilfeldig(7);
  const naturMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const bjorkMat = new THREE.MeshStandardMaterial({ map: bjorkTekstur(), roughness: 0.9 });
  const figur = (deler) => {
    const m = new THREE.Mesh(mergeGeometries(deler.map(([geo, farge]) => farget(geo, farge))), naturMat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const varier = (hex, v) => new THREE.Color(hex).offsetHSL((t() - 0.5) * 0.02, 0, (t() - 0.5) * v);

  // Gran: tett, mørk og spiss, i flere lag
  const gran = (h) => {
    const deler = [[flytt(new THREE.CylinderGeometry(0.06 * h / 4, 0.1 * h / 4, h * 0.3, 6), 0, h * 0.15, 0), 0x4a3726]];
    const lag = 5;
    for (let i = 0; i < lag; i++) {
      const r = h * (0.3 - i * 0.045);
      const y = h * (0.18 + i * 0.16);
      deler.push([flytt(new THREE.ConeGeometry(r, h * 0.34, 8), 0, y + h * 0.17, 0, t() * Math.PI), varier(0x24402c, 0.05)]);
    }
    return figur(deler);
  };
  // Furu: høy, rødbrun stamme og en flat, uregelmessig krone øverst
  const furu = (h) => {
    const deler = [[flytt(new THREE.CylinderGeometry(0.09, 0.14, h * 0.75, 7), 0, h * 0.375, 0), 0x8a4a2a]];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.IcosahedronGeometry(h * 0.16, 0);
      geo.scale(1.3, 0.55, 1.3);
      deler.push([flytt(geo, (t() - 0.5) * h * 0.3, h * (0.78 + t() * 0.12), (t() - 0.5) * h * 0.3), varier(0x2f4a2a, 0.06)]);
    }
    return figur(deler);
  };
  // Bjørk: hvit stamme med sorte merker og en lys, luftig krone
  const bjork = (h) => {
    const g = new THREE.Group();
    const stamme = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h * 0.7, 8), bjorkMat);
    stamme.position.y = h * 0.35;
    stamme.castShadow = true;
    g.add(stamme);
    const deler = [];
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.IcosahedronGeometry(h * (0.14 + t() * 0.06), 0);
      deler.push([flytt(geo, (t() - 0.5) * h * 0.32, h * (0.62 + t() * 0.3), (t() - 0.5) * h * 0.32), varier(0x6f8f3e, 0.08)]);
    }
    g.add(figur(deler));
    return g;
  };
  // Einer og lyngtuer
  const busk = (s) => {
    const deler = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.IcosahedronGeometry(s * (0.35 + t() * 0.2), 0);
      geo.scale(1, 0.75, 1);
      deler.push([flytt(geo, (t() - 0.5) * s * 0.7, s * 0.25, (t() - 0.5) * s * 0.7), varier(0x35502f, 0.08)]);
    }
    return figur(deler);
  };
  // Grå stein med litt mose
  const stein = (s) => {
    const geo = new THREE.DodecahedronGeometry(s, 0);
    geo.scale(1.3, 0.6, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.9 + t() * 0.2), pos.getY(i), pos.getZ(i) * (0.9 + t() * 0.2));
    geo.computeVertexNormals();
    return figur([[flytt(geo, 0, s * 0.25, 0), varier(0x7d7f7c, 0.1)]]);
  };

  // Mest gran og bjørk, litt furu. Trærne på venstre side (+x) står langt ute, så de ikke
  // sperrer utsikten når kameraet står på siden i kalkulator-modus.
  const antall = 34;
  for (let i = 0; i < antall; i++) {
    const side = i % 2 ? 1 : -1;
    const type = t();
    const h = 3 + t() * 3.5;
    const tre = type < 0.5 ? gran(h + 1) : type < 0.85 ? bjork(h) : furu(h + 1.5);
    const avstand = side > 0 ? 26 + t() * 18 : 20 + t() * 18;   // høyre side: langt nok ute til at trærne ikke ligger over overskriften
    tre.position.set(MIDTSTRIPE_X + side * avstand, 0, -LENGDE / 2 + (i / antall) * LENGDE + t() * 4);
    tre.rotation.y = t() * Math.PI * 2;
    leggTil(tre, tre.position.z);
  }
  // Et lite skogholt tett i tett lenger ute på høyre side
  for (let i = 0; i < 14; i++) {
    const tre = gran(4 + t() * 3);
    tre.position.set(MIDTSTRIPE_X - 32 - t() * 10, 0, -20 + i * 2.6 + t());
    leggTil(tre, tre.position.z);
  }
  for (let i = 0; i < 22; i++) {
    const side = i % 3 === 0 ? 1 : -1;
    const ting = t() < 0.6 ? busk(0.5 + t() * 0.6) : stein(0.25 + t() * 0.45);
    const avstand = side > 0 ? 24 + t() * 10 : 5.2 + t() * 10;
    ting.position.set(MIDTSTRIPE_X + side * avstand, 0, -LENGDE / 2 + (i / 22) * LENGDE + t() * 5);
    ting.rotation.y = t() * Math.PI * 2;
    leggTil(ting, ting.position.z);
  }

  // ---------- Skigard langs jordet på høyre side ----------
  {
    const deler = [];
    const SEG = 2.4;
    for (let z = 0; z < 24; z += SEG) {
      deler.push([flytt(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5), 0.06, 0.65, z), 0x6e6152]);
      deler.push([flytt(new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5), -0.06, 0.65, z), 0x6e6152]);
      for (let k = 0; k < 5; k++) {
        const ski = new THREE.BoxGeometry(0.05, 0.03, 2.2);
        ski.rotateX(-0.55);
        deler.push([flytt(ski, 0, 0.55 + k * 0.05, z + SEG / 2), new THREE.Color(0x7d6e5c).offsetHSL(0, 0, (t() - 0.5) * 0.06)]);
      }
    }
    for (let i = 0; i < 2; i++) {
      const gard = figur(deler);
      gard.position.set(MIDTSTRIPE_X - 9, 0, -LENGDE / 2 + i * 70);
      leggTil(gard, gard.position.z);
    }
  }

  // ---------- Rød låve med hvite hjørner ----------
  {
    const deler = [];
    const B = 8, L = 12, H = 4.2;
    deler.push([flytt(new THREE.BoxGeometry(B, H, L), 0, H / 2, 0), 0x8e2a1e]);
    const tak = new THREE.CylinderGeometry(B * 0.62, B * 0.62, L + 0.6, 3, 1);
    tak.rotateZ(Math.PI / 2);
    tak.rotateX(Math.PI / 2);
    tak.scale(1, 0.55, 1);
    tak.rotateY(Math.PI / 2);
    deler.push([flytt(tak, 0, H + 0.7, 0), 0x2a2a2c]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) deler.push([flytt(new THREE.BoxGeometry(0.2, H, 0.2), sx * B / 2, H / 2, sz * L / 2), 0xe9e6dd]);
    deler.push([flytt(new THREE.BoxGeometry(0.1, 2.6, 3), B / 2 + 0.02, 1.3, 0), 0x6e1f16]);
    deler.push([flytt(new THREE.BoxGeometry(0.12, 2.8, 0.15), B / 2 + 0.03, 1.4, -1.55), 0xe9e6dd]);
    deler.push([flytt(new THREE.BoxGeometry(0.12, 2.8, 0.15), B / 2 + 0.03, 1.4, 1.55), 0xe9e6dd]);
    const lave = figur(deler);
    lave.position.set(MIDTSTRIPE_X - 30, 0, 20);
    lave.rotation.y = 0.15;
    leggTil(lave, 20);
  }

  // ---------- Åser i det fjerne (står stille, som horisonten) ----------
  {
    const deler = [];
    for (let i = 0; i < 9; i++) {
      const r = 18 + t() * 16;
      const geo = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1.6, 0.35 + t() * 0.25, 1);
      deler.push([flytt(geo, -48 - t() * 14, -1, -90 + i * 24 + t() * 8), varier(0x1f3326, 0.05)]);
    }
    for (let i = 0; i < 6; i++) {
      const r = 16 + t() * 12;
      const geo = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(1.6, 0.3 + t() * 0.2, 1);
      deler.push([flytt(geo, 62 + t() * 14, -1, -80 + i * 30 + t() * 8), varier(0x1f3326, 0.05)]);
    }
    const aaser = figur(deler);
    aaser.castShadow = false;
    scene.add(aaser);
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

// Flytter (og eventuelt dreier) en geometri på plass før den slås sammen med andre
function flytt(geo, x, y, z, ry = 0) {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

// Gjør geometrien klar til å slås sammen: uten indeks og uv, med én farge på alle hjørner
function farget(geo, farge) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(farge);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Bjørkenever: hvit med sorte, vannrette merker
function bjorkTekstur() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e6df';
  g.fillRect(0, 0, 64, 256);
  const t = lagTilfeldig(17);
  g.fillStyle = '#26231f';
  for (let i = 0; i < 26; i++) {
    const y = t() * 256, w = 6 + t() * 22, h = 2 + t() * 5;
    g.fillRect(t() * 64 - w / 2, y, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function lagTilfeldig(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

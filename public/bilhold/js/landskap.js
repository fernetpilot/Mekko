// Norsk landskap langs veien: skog med gran, bjørk og furu, et slåtteng med skigard,
// mosegrodde steiner og steinrøyser, en grusvei med bom, og en tursti
// med rød T inn i skogen. Verden flytter seg bakover mens bilen står stille.
//
// Alt som står langs veien er delt i «biter» på 14 meter. Hver bit er slått sammen til
// noen få figurer (én for det nære, én for skogen lenger ut, én for flekker på veien),
// så det blir få tegnekall selv med flere hundre trær.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const LENGDE = 140;                       // verden gjentar seg hver 140. meter
const BITER = 10;
const BIT_L = LENGDE / BITER;
// Bilen kjører i høyre felt, så midtstripen ligger på bilens venstre side (+x)
const MIDTSTRIPE_X = 1.9;
const VEI_B = 7.5;
const VEIKANT_H = MIDTSTRIPE_X - VEI_B / 2;   // veikanten på høyre side (-x), mot skogen
const GARD_X = MIDTSTRIPE_X - 9;               // skigarden langs enga
// Grusveien og turstien går inn i skogen på høyre side, på tvers av veien
const GRUSVEI_Z = -6;
const STI_Z = 38;

export function lagOmgivelser(scene, farger) {
  const t = lagTilfeldig(7);
  const biter = Array.from({ length: BITER }, (_, i) => ({
    midt: -LENGDE / 2 + BIT_L * (i + 0.5),
    naer: [], skog: [], fjern: [], flekker: [], vann: [],
  }));
  // Legger en farget geometri (i verdens koordinater) i biten den hører til
  const bitFor = (z) => biter[Math.min(BITER - 1, Math.max(0, Math.floor((wrap(z) + LENGDE / 2) / BIT_L)))];
  const legg = (liste, geo, farge, z) => {
    const bit = bitFor(z);
    geo.translate(0, 0, wrap(z) - z - bit.midt);
    const g = farge === null ? geo : farget(geo, farge);
    // Skogen blir mørkere og roligere jo lenger inn den står, så teksten foran den er lett å lese
    if (liste === 'fjern' || liste === 'skog') {
      const p = g.attributes.position, c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        const k = 1 - 0.5 * THREE.MathUtils.smoothstep(Math.abs(p.getX(i) - MIDTSTRIPE_X), 18, 44);
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
      }
    }
    bit[liste].push(g);
  };
  const varier = (hex, v) => new THREE.Color(hex).offsetHSL((t() - 0.5) * 0.02, 0, (t() - 0.5) * v);

  // ---------- Bakke ----------
  // Enga er lysere nær veien og mørkere inne i skogen. Detaljene (strå, flekker) ligger i en
  // tekstur som flytter seg med veien, så bakken ikke står stille under bilen.
  const gressGeo = new THREE.PlaneGeometry(200, 200, 100, 4);
  {
    const farge = [];
    const pos = gressGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const skog = THREE.MathUtils.smoothstep(Math.abs(x - MIDTSTRIPE_X), 14, 26);
      const v = 1 - skog * 0.35;
      farge.push(v * (1 - skog * 0.08), v, v * (1 - skog * 0.1));
    }
    gressGeo.setAttribute('color', new THREE.Float32BufferAttribute(farge, 3));
  }
  const gressTekstur = flekkTekstur(11, 256, [[0.82, 1.12], 5000, 1, 3], true);
  gressTekstur.repeat.set(20, 20);
  const gressMat = new THREE.MeshStandardMaterial({ color: farger.gress, roughness: 1, vertexColors: true, map: gressTekstur });
  const gressDetalj = medDetalj(gressMat);
  const gress = new THREE.Mesh(gressGeo, gressMat);
  gress.rotation.x = -Math.PI / 2;
  gress.position.y = -0.01;
  gress.receiveShadow = true;
  scene.add(gress);

  // ---------- Veien ----------
  // Asfalt med fin struktur, sprekker og ujevnheter (bump-kart). Teksturen flytter seg
  // med samme fart som stripene.
  const veiTekstur = asfaltTekstur();
  const VEI_BUMP = 1.6;
  const veiMat = new THREE.MeshStandardMaterial({ color: farger.vei, roughness: 0.92, map: veiTekstur, bumpMap: veiTekstur, bumpScale: VEI_BUMP });
  const veiDetalj = medDetalj(veiMat);
  const vei = new THREE.Mesh(new THREE.PlaneGeometry(VEI_B, 200), veiMat);
  vei.rotation.x = -Math.PI / 2;
  vei.position.x = MIDTSTRIPE_X;
  vei.receiveShadow = true;
  scene.add(vei);

  // Hvite kantlinjer og gul, stiplet midtlinje, som på norske veier
  const linjeMat = new THREE.MeshBasicMaterial({ color: 0xd9dadc });
  const gulMat = new THREE.MeshBasicMaterial({ color: 0xe0a91b });
  for (const x of [MIDTSTRIPE_X - 3.6, MIDTSTRIPE_X + 3.6]) {
    const kant = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 200), linjeMat);
    kant.rotation.x = -Math.PI / 2;
    kant.position.set(x, 0.002, 0);
    scene.add(kant);
  }
  const flyttbare = [];
  const leggTil = (obj, z) => {
    flyttbare.push({ obj, start: z });
    scene.add(obj);
  };
  const stripeGeo = new THREE.PlaneGeometry(0.12, 3);
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 9) {
    const s = new THREE.Mesh(stripeGeo, gulMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(MIDTSTRIPE_X, 0.003, z);
    leggTil(s, z);
  }

  // Lappet asfalt og sølepytter langs veikantene
  for (let i = 0; i < 12; i++) {
    const z = -LENGDE / 2 + (i + t()) * (LENGDE / 12);
    const x = MIDTSTRIPE_X + (t() < 0.5 ? -1 : 1) * (0.6 + t() * 2.4);
    const lapp = new THREE.ShapeGeometry(klump(0.3 + t() * 0.45, 0.2 + t() * 0.25, 9, t), 1);
    lapp.rotateX(-Math.PI / 2);
    lapp.rotateY(t() * Math.PI);
    lapp.translate(x, 0.0015, z);
    legg('flekker', lapp, new THREE.Color().setScalar(t() < 0.75 ? 0.82 + t() * 0.06 : 1.05 + t() * 0.04), z);
  }
  for (let i = 0; i < 9; i++) {
    const z = -LENGDE / 2 + (i + t()) * (LENGDE / 9);
    const side = t() < 0.6 ? -1 : 1;
    const x = MIDTSTRIPE_X + side * (3.1 - t() * 0.5);
    const pytt = new THREE.ShapeGeometry(klump(0.15 + t() * 0.12, 0.35 + t() * 0.35, 12, t), 1);
    pytt.rotateX(-Math.PI / 2);
    pytt.translate(x, 0.004, z);
    legg('vann', pytt, null, z);
  }
  // Pytter i hjulsporene på grusveien
  for (let i = 0; i < 4; i++) {
    const p = new THREE.ShapeGeometry(klump(0.3 + t() * 0.3, 0.18, 10, t), 1);
    p.rotateX(-Math.PI / 2);
    p.translate(VEIKANT_H - 5 - i * 6 - t() * 3, 0.03, GRUSVEI_Z + grusveiSving(VEIKANT_H - 5 - i * 6) + (t() < 0.5 ? -0.55 : 0.55));
    legg('vann', p, null, GRUSVEI_Z);
  }

  // Brøytestikker på høyre side av kjøreretningen (-x). På siden nærmest kameraet ble de forstyrrende.
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 25) {
    if (Math.abs(wrap(z - GRUSVEI_Z)) < 3) continue;
    legg('naer', flytt(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), MIDTSTRIPE_X - 4.4, 0.9, z), 0x1a1a1a, z);
    legg('naer', flytt(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), MIDTSTRIPE_X - 4.4, 1.6, z), 0xff8a00, z);
  }

  // ---------- Trær, busker og steiner ----------
  // Gran: tett, mørk og spiss, med hengende greiner i mange lag
  const gran = (x, z, h, liste = 'fjern') => {
    legg(liste, flytt(new THREE.CylinderGeometry(0.05 * h / 4, 0.12 * h / 4, h * 0.35, 6), x, h * 0.17, z), 0x3d2c1f, z);
    const lag = 7;
    for (let i = 0; i < lag; i++) {
      const andel = i / (lag - 1);
      const r = h * (0.27 - andel * 0.2) * (0.9 + t() * 0.2);
      const hoyde = h * (0.24 - andel * 0.06);
      const geo = ujevn(new THREE.ConeGeometry(r, hoyde, 9, 1), r * 0.12, t);
      legg(liste, flytt(geo, x, h * (0.16 + andel * 0.7) + hoyde / 2, z, t() * Math.PI), varier(0x1e3826, 0.06), z);
    }
  };
  // Furu: høy, rødbrun stamme og en flat, uregelmessig krone øverst
  const furu = (x, z, h, liste = 'fjern') => {
    const stamme = new THREE.CylinderGeometry(0.08, 0.14, h * 0.78, 7);
    stamme.rotateZ((t() - 0.5) * 0.08);
    legg(liste, flytt(stamme, x, h * 0.39, z), 0x8a4a2a, z);
    for (let i = 0; i < 5; i++) {
      const geo = ujevn(new THREE.IcosahedronGeometry(h * (0.12 + t() * 0.06), 1).scale(1.35, 0.5, 1.35), h * 0.03, t);
      legg(liste, flytt(geo, x + (t() - 0.5) * h * 0.36, h * (0.76 + t() * 0.16), z + (t() - 0.5) * h * 0.36), varier(0x2f4a2a, 0.06), z);
    }
  };
  // Bjørk: hvit stamme med sorte merker og en lys, luftig krone
  const bjork = (x, z, h, liste = 'fjern') => {
    const stamme = new THREE.CylinderGeometry(0.06, 0.1, h * 0.72, 7, 8);
    stamme.rotateZ((t() - 0.5) * 0.1);
    flytt(stamme, x, h * 0.36, z);
    const farge = [];
    const ikkeIndeks = stamme.toNonIndexed();
    ikkeIndeks.deleteAttribute('uv');
    const p = ikkeIndeks.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      const merke = t() < 0.22;
      const c = new THREE.Color(merke ? 0x2a2622 : 0xe4e1d8).offsetHSL(0, 0, (t() - 0.5) * 0.05);
      for (let k = 0; k < 3; k++) farge.push(c.r, c.g, c.b);
    }
    ikkeIndeks.setAttribute('color', new THREE.Float32BufferAttribute(farge, 3));
    legg(liste, ikkeIndeks, null, z);
    for (let i = 0; i < 6; i++) {
      const geo = ujevn(new THREE.IcosahedronGeometry(h * (0.12 + t() * 0.06), 1), h * 0.03, t);
      legg(liste, flytt(geo, x + (t() - 0.5) * h * 0.34, h * (0.6 + t() * 0.32), z + (t() - 0.5) * h * 0.34), varier(0x435d2e, 0.08), z);
    }
  };
  // Einer og lyngtuer
  const busk = (x, z, s, liste = 'naer') => {
    for (let i = 0; i < 3; i++) {
      const geo = ujevn(new THREE.IcosahedronGeometry(s * (0.35 + t() * 0.2), 1).scale(1, 0.75, 1), s * 0.06, t);
      legg(liste, flytt(geo, x + (t() - 0.5) * s * 0.7, s * 0.25, z + (t() - 0.5) * s * 0.7), varier(0x35502f, 0.08), z);
    }
  };
  // Stein: grå, med mose på toppen og lav i flekker. Mosen følger flatene som vender opp.
  const stein = (x, z, s, liste = 'naer', y = 0) => {
    const geo = ujevn(new THREE.IcosahedronGeometry(s, 1).scale(1.25 + t() * 0.3, 0.55 + t() * 0.25, 1), s * 0.16, t, 0);
    geo.rotateY(t() * Math.PI);
    flytt(geo, x, y + s * 0.2, z);
    legg(liste, mosegrodd(geo, t), null, z);
  };
  // Steinrøys: noen store og flere små steiner i en klynge
  const roys = (x, z, s, liste = 'naer') => {
    stein(x, z, s, liste);
    const n = 3 + Math.floor(t() * 4);
    for (let i = 0; i < n; i++) {
      const a = t() * Math.PI * 2, d = s * (0.9 + t() * 0.9);
      stein(x + Math.cos(a) * d, z + Math.sin(a) * d, s * (0.25 + t() * 0.4), liste);
    }
  };

  // Hvor det ikke skal stå trær: på grusveien og turstien
  const iVeien = (x, z) => {
    if (x > VEIKANT_H) return false;
    const dg = Math.abs(wrap(z - GRUSVEI_Z - grusveiSving(x)));
    const ds = Math.abs(wrap(z - STI_Z - stiSving(x)));
    return dg < 3 || (x < VEIKANT_H - 6 && ds < 1.6);
  };

  // Skogen: tett blandingsskog på begge sider, lengst unna på venstre side (+x), så den
  // ikke sperrer utsikten når kameraet står på siden i kalkulator-modus. Treet velges etter
  // avstanden: bjørk og furu i skogkanten, mest gran lenger inne.
  const plantSkog = (fra, til, tetthet, side) => {
    for (let z = -LENGDE / 2; z < LENGDE / 2; z += tetthet) {
      for (let d = fra; d < til; d += tetthet) {
        const x = MIDTSTRIPE_X + side * (d + (t() - 0.5) * tetthet * 0.9);
        const zz = z + (t() - 0.5) * tetthet * 0.9;
        if (iVeien(x, zz) || t() < 0.12 || (d < fra + 9 && t() < 0.55)) continue;   // glissent i skogkanten
        const inne = (d - fra) / (til - fra);
        const valg = t();
        const h = 4 + t() * 4 + inne * 3;
        const liste = d > 40 ? 'fjern' : 'skog';            // den ytterste skogen tegnes ikke i lett versjon
        if (valg < 0.35 + inne * 0.45) gran(x, zz, h + 1.5, liste);
        else if (valg < 0.8 + inne * 0.1) bjork(x, zz, h, liste);
        else furu(x, zz, h + 2, liste);
      }
    }
  };
  plantSkog(23, 64, 3.4, -1);
  plantSkog(27, 58, 3.8, 1);

  // Skogkanten og enga: busker, enkelttrær og steiner
  for (let i = 0; i < 46; i++) {
    const z = -LENGDE / 2 + (i / 46) * LENGDE + t() * 2;
    const venstre = i % 4 === 0;
    const x = venstre ? MIDTSTRIPE_X + 22 + t() * 6 : MIDTSTRIPE_X - (11 + t() * 10);
    if (iVeien(x, z)) continue;
    const v = t();
    if (v < 0.45) busk(x, z, 0.5 + t() * 0.7);
    else if (v < 0.7) stein(x, z, 0.25 + t() * 0.5);
    else if (v < 0.85 && !venstre) bjork(x, z, 3.5 + t() * 2, 'naer');
    else busk(x, z, 0.4 + t() * 0.4);
  }
  // Steinrøyser og store, mosegrodde steinblokker
  for (const [d, z, s] of [[13, -48, 0.9], [15, -22, 0.7], [12.5, 8, 0.8], [17, 27, 1.1], [14, 56, 0.75], [19, -62, 1.3]]) {
    roys(MIDTSTRIPE_X - d, z, s);
  }
  for (const [d, z, s] of [[22, -34, 1.9], [24, 18, 2.3], [21, 48, 1.7]]) stein(MIDTSTRIPE_X - d, z, s, 'fjern', -0.3);
  for (const [d, z, s] of [[30, -40, 1.6], [33, 12, 2.0], [29, 52, 1.2]]) roys(MIDTSTRIPE_X + d, z, s, 'fjern');
  // Steiner og lyng helt ute ved veikanten
  for (let i = 0; i < 18; i++) {
    const z = -LENGDE / 2 + (i + t()) * (LENGDE / 18);
    const x = VEIKANT_H - 0.6 - t() * 1.5;
    if (iVeien(x, z)) continue;
    t() < 0.5 ? stein(x, z, 0.12 + t() * 0.18) : busk(x, z, 0.3 + t() * 0.25);
  }

  // ---------- Skigard langs enga, med naturlige stopp ----------
  // Hvert stykke slutter ved noe: grusveien, turstien, en stor stein eller et tre.
  const gardStykker = [[-66, -50], [-46, GRUSVEI_Z - 3.2], [GRUSVEI_Z + 3.2, 20], [24, STI_Z - 1.6], [STI_Z + 1.6, 66]];
  for (const [fra, til] of gardStykker) skigard(fra, til);
  roys(GARD_X - 0.4, -48, 0.85);                                     // der garden slutter mot røysa
  bjork(GARD_X - 0.8, 22, 6, 'naer');                                  // ... og ved et bjørketre
  function skigard(fra, til) {
    const STOLPE = 1.25;
    const n = Math.max(2, Math.round((til - fra) / STOLPE));
    const steg = (til - fra) / n;
    for (let i = 0; i <= n; i++) {
      const z = fra + i * steg;
      const ende = i === 0 || i === n;
      const h = (ende ? 1.25 : 1.4) + (t() - 0.5) * 0.12;
      for (const s of [-1, 1]) {
        const staur = new THREE.CylinderGeometry(0.03, 0.045, h, 6);
        staur.rotateZ(s * 0.06 + (t() - 0.5) * 0.04);
        legg('naer', flytt(staur, GARD_X + s * 0.07, h / 2 - 0.05, z), varier(0x6a5c4c, 0.06), z);
      }
      // Vidjebånd som holder skiene mellom stolpene
      for (const y of [0.45, 0.95]) legg('naer', flytt(new THREE.BoxGeometry(0.2, 0.035, 0.05), GARD_X, y, z), 0x4b4034, z);
      if (i === n) break;
      // Skiene ligger på skrå, flere på midten enn ytterst, så garden «trappes» ned i endene
      const antall = i === 0 || i === n - 1 ? 3 : 5;
      for (let k = 0; k < antall; k++) {
        const lengde = steg * 1.65;
        const ski = new THREE.CylinderGeometry(0.022, 0.028, lengde, 5);
        ski.rotateX(Math.PI / 2 - 0.62);
        const y = 0.42 + k * 0.13 + (t() - 0.5) * 0.04;
        legg('naer', flytt(ski, GARD_X + (t() - 0.5) * 0.04, y, z + steg / 2), varier(0x7d6e5c, 0.08), z);
      }
    }
  }

  // ---------- Grusvei inn i skogen, med bom ----------
  {
    const veiGeo = baand((x) => GRUSVEI_Z + grusveiSving(x), VEIKANT_H + 0.1, VEIKANT_H - 46, 3.0, 40);
    legg('naer', flytt(veiGeo, 0, 0.012, 0), 0x57503f, GRUSVEI_Z);
    // Grasstripe i midten og hjulspor
    legg('naer', flytt(baand((x) => GRUSVEI_Z + grusveiSving(x), VEIKANT_H - 1, VEIKANT_H - 46, 0.45, 40), 0, 0.02, 0), 0x3e5531, GRUSVEI_Z);
    for (const s of [-1, 1]) legg('naer', flytt(baand((x) => GRUSVEI_Z + grusveiSving(x) + s * 0.75, VEIKANT_H - 0.5, VEIKANT_H - 46, 0.32, 40), 0, 0.016, 0), 0x46402f, GRUSVEI_Z);
    // Bom: to stolper og en rød og hvit stang
    const bx = VEIKANT_H - 9;
    const bz = GRUSVEI_Z + grusveiSving(bx);
    for (const s of [-1, 1]) legg('naer', flytt(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 10), bx, 0.55, bz + s * 1.7), 0x8a8d92, GRUSVEI_Z);
    for (let i = 0; i < 6; i++) {
      const del = new THREE.CylinderGeometry(0.04, 0.04, 0.56, 10);
      del.rotateX(Math.PI / 2);
      legg('naer', flytt(del, bx, 0.95, bz - 1.4 + i * 0.56), i % 2 ? 0xe8e6e0 : 0xb5241c, GRUSVEI_Z);
    }
  }

  // ---------- Tursti med rød T ----------
  {
    const fra = VEIKANT_H - 0.3, til = VEIKANT_H - 48;
    legg('naer', flytt(baand((x) => STI_Z + stiSving(x), fra, til, 0.75, 60), 0, 0.014, 0), 0x6b5a45, STI_Z);
    // Røtter og steiner i stien
    for (let i = 0; i < 10; i++) {
      const x = fra - 3 - i * 4.2 - t() * 2;
      const rot = new THREE.CylinderGeometry(0.03, 0.04, 0.9, 5);
      rot.rotateX(Math.PI / 2);
      rot.rotateY((t() - 0.5) * 0.8);
      legg('naer', flytt(rot, x, 0.02, STI_Z + stiSving(x)), 0x4a3828, STI_Z);
    }
    // Skilt ved veien: stolpe og brun tavle med pil
    const sx = VEIKANT_H - 1.2, sz = STI_Z - 1.1;
    legg('naer', flytt(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 8), sx, 0.8, sz), 0x5a4b3a, STI_Z);
    const tavle = new THREE.BoxGeometry(0.04, 0.22, 0.75);
    legg('naer', flytt(tavle, sx + 0.04, 1.4, sz + 0.3), 0x6b4a2b, STI_Z);
    legg('naer', flytt(new THREE.BoxGeometry(0.045, 0.06, 0.5), sx + 0.045, 1.4, sz + 0.28), 0xe8e2d0, STI_Z);
    const pil = new THREE.ConeGeometry(0.07, 0.14, 3);
    pil.rotateX(Math.PI / 2);
    legg('naer', flytt(pil, sx + 0.045, 1.4, sz + 0.6), 0xe8e2d0, STI_Z);
    // DNT-merking: rød T malt på steiner og trær langs stien
    for (const x of [VEIKANT_H - 4, VEIKANT_H - 14, VEIKANT_H - 25]) {
      const z = STI_Z + stiSving(x) + 1.1;
      stein(x, z, 0.45);
      legg('naer', flytt(new THREE.BoxGeometry(0.24, 0.02, 0.07), x, 0.48, z), 0xc01a12, STI_Z);
      legg('naer', flytt(new THREE.BoxGeometry(0.07, 0.021, 0.22), x, 0.48, z - 0.12), 0xc01a12, STI_Z);
    }
    for (const x of [VEIKANT_H - 19, VEIKANT_H - 33]) {
      const z = STI_Z + stiSving(x) - 1.3;
      gran(x, z, 8, 'naer');
      legg('naer', flytt(new THREE.BoxGeometry(0.02, 0.07, 0.26), x, 1.6, z + 0.16), 0xc01a12, STI_Z);
      legg('naer', flytt(new THREE.BoxGeometry(0.02, 0.24, 0.07), x, 1.48, z + 0.16), 0xc01a12, STI_Z);
    }
    // En benk der stien går inn i skogen
    const bx = VEIKANT_H - 12, bz = STI_Z + stiSving(VEIKANT_H - 12) - 1.4;
    legg('naer', flytt(new THREE.BoxGeometry(1.4, 0.06, 0.36), bx, 0.45, bz), 0x7a5a3a, STI_Z);
    for (const dx of [-0.55, 0.55]) legg('naer', flytt(new THREE.BoxGeometry(0.08, 0.45, 0.32), bx + dx, 0.22, bz), 0x5a4b3a, STI_Z);
  }

  // ---------- Bitene blir figurer ----------
  const naturMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const flekkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  flekkMat.color = veiMat.color;                 // samme farge som veien, også når temaet skifter
  const vannMat = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.03, metalness: 0.1, envMapIntensity: 0.45, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const fjerne = [];
  for (const bit of biter) {
    for (const [liste, mat, skygge] of [['naer', naturMat, true], ['skog', naturMat, false], ['fjern', naturMat, false], ['flekker', flekkMat, false], ['vann', vannMat, false]]) {
      if (!bit[liste].length) continue;
      const geo = mergeGeometries(bit[liste].map(utenUv));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = skygge;
      m.receiveShadow = true;
      m.position.z = bit.midt;
      leggTil(m, bit.midt);
      if (liste === 'fjern') fjerne.push(m);
    }
  }

  return {
    gressMat,
    veiMat,
    // Lett versjon: den ytterste skogen tegnes ikke
    settLett() { for (const m of fjerne) m.visible = false; },
    // 1 = full detalj, 0 = ensfarget gress og vei uten lapper og pytter. Brukes når man blar ned i et
    // panel, så det ikke synes at veien stopper opp.
    settDetalj(d) {
      gressDetalj.value = veiDetalj.value = d;
      veiMat.bumpScale = VEI_BUMP * d;
      flekkMat.opacity = d;
      vannMat.opacity = 0.6 * d;
      flekkMat.visible = vannMat.visible = d > 0.01;
    },
    oppdater(strekning) {
      // Verden flytter seg bakover (-z) mens bilen står stille
      for (const f of flyttbare) {
        let z = f.start - strekning;
        z = ((z + LENGDE / 2) % LENGDE + LENGDE) % LENGDE - LENGDE / 2;
        f.obj.position.z = z;
      }
      // Teksturene gjentar seg hver 10. meter, og flytter seg like mye som stripene
      veiTekstur.offset.y = -((strekning / 10) % 1);
      gressTekstur.offset.y = -((strekning / 10) % 1);
    },
  };
}

// Grusveien og stien svinger litt på vei inn i skogen (forskyvning i z ved en gitt x)
function grusveiSving(x) { return Math.sin((x - VEIKANT_H) * 0.09) * 3.2; }
function stiSving(x) { return Math.sin((x - VEIKANT_H) * 0.16) * 2.4 + Math.sin((x - VEIKANT_H) * 0.05) * 3; }

// z innenfor -LENGDE/2 .. LENGDE/2
function wrap(z) { return ((z + LENGDE / 2) % LENGDE + LENGDE) % LENGDE - LENGDE / 2; }

// Flatt bånd på bakken langs en kurve z = kurve(x), fra x = fra til x = til
function baand(kurve, fra, til, bredde, n) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const x = fra + (til - fra) * (i / n);
    const z = kurve(x);
    const dzdx = (kurve(x + 0.01) - z) / 0.01;
    const l = Math.hypot(1, dzdx);
    const nx = -dzdx / l, nz = 1 / l;                 // normal i bakkeplanet
    const b = bredde / 2 * (1 + 0.15 * Math.sin(i * 1.7));
    pos.push(x - nx * b, 0, z - nz * b, x + nx * b, 0, z + nz * b);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  // Vender opp uansett rekkefølge
  geo.computeVertexNormals();
  if (geo.attributes.normal.getY(0) < 0) { idx.reverse(); geo.setIndex(idx); geo.computeVertexNormals(); }
  return geo;
}

// Uregelmessig, avrundet flekk (asfaltlapp, pytt) som 2D-form
function klump(rx, rz, n, t) {
  const f = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.8 + t() * 0.35;
    const x = Math.cos(a) * rx * r, y = Math.sin(a) * rz * r;
    i ? f.lineTo(x, y) : f.moveTo(x, y);
  }
  f.closePath();
  return f;
}

// Flytter hjørnene litt tilfeldig, så former ikke blir helt regelmessige. Hjørnene slås sammen
// først, så flatene henger sammen. Løv (opp > 0) får normaler som peker ut fra midten av formen
// og litt opp, som en myk ball: da blir verken undersiden eller innsiden av greinene svart.
function ujevn(geo, mengde, t, opp = 0.6) {
  geo.deleteAttribute('normal');
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  const g = mergeVertices(geo, 1e-3);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + (t() - 0.5) * mengde, pos.getY(i) + (t() - 0.5) * mengde, pos.getZ(i) + (t() - 0.5) * mengde);
  }
  g.computeVertexNormals();
  if (opp) {
    g.computeBoundingBox();
    const b = g.boundingBox;
    const c = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.2, (b.min.z + b.max.z) / 2);
    const n = g.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < n.count; i++) {
      v.fromBufferAttribute(pos, i).sub(c);
      v.y = Math.max(v.y, 0);
      v.normalize();
      v.y += opp;
      v.normalize();
      n.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return g;
}

// Stein med farge per flate: mose der flaten vender opp, grå med lav ellers
function mosegrodd(geo, t) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  const farge = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const ny = b.clone().sub(a).cross(c.clone().sub(a)).normalize().y;
    let f;
    if (ny > 0.55 - t() * 0.25) f = new THREE.Color(0x3f5a2a).offsetHSL((t() - 0.5) * 0.04, 0, (t() - 0.5) * 0.08);
    else if (t() < 0.12) f = new THREE.Color(0x9a9f84);                    // lav
    else f = new THREE.Color(0x76787a).offsetHSL(0, 0, (t() - 0.5) * 0.1);
    for (let k = 0; k < 3; k++) farge.push(f.r, f.g, f.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(farge, 3));
  return g;
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
  if (g.attributes.uv) g.deleteAttribute('uv');
  const c = new THREE.Color(farge);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Pyttene har ingen farge per hjørne; de andre får samme sett med attributter
// Lar teksturen på et materiale gli over i sin egen snittfarge (uniform detalj: 1 = tekstur, 0 = ensfarget)
function medDetalj(mat) {
  const detalj = { value: 1 };
  const snitt = snittfarge(mat.map);
  mat.onBeforeCompile = (s) => {
    s.uniforms.detalj = detalj;
    s.fragmentShader = 'uniform float detalj;\n' + s.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        diffuseColor *= mix(vec4(${snitt.map((v) => v.toFixed(4)).join(', ')}, 1.0), texture2D(map, vMapUv), detalj);
      #endif`);
  };
  return detalj;
}

// Gjennomsnittsfargen i en lerret-tekstur, lineær (slik shaderen ser den)
function snittfarge(tex) {
  const c = tex.image;
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += srgbTilLineaer(data[i + k] / 255);
  return sum.map((v) => v / (data.length / 4));
}

const srgbTilLineaer = (c) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));

function utenUv(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Asfalt: fin, lys/mørk struktur (blir mørk av materialfargen) og sprekker
function asfaltTekstur() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 512);
  const t = lagTilfeldig(5);
  for (let i = 0; i < 12000; i++) {
    const v = 214 + Math.floor(t() * 41);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(t() * 256, t() * 512, 1 + t() * 2, 1 + t() * 2);
  }
  // Sprekker
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = t() * 256, y = t() * 512;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (t() - 0.5) * 22; y += (t() - 0.3) * 18; g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 20);
  tex.anisotropy = 4;
  return tex;
}

// Gress: lyse og mørke strå og flekker på en hvit flate (fargen kommer fra materialet)
function flekkTekstur(frø, str, [[min, maks], antall, smal, lang]) {
  const c = document.createElement('canvas');
  c.width = c.height = str;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, str, str);
  const t = lagTilfeldig(frø);
  for (let i = 0; i < 40; i++) {
    const v = Math.floor(200 + t() * 55);
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.beginPath();
    g.arc(t() * str, t() * str, 10 + t() * 30, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < antall; i++) {
    const v = Math.min(255, Math.floor(230 * (min + t() * (maks - min))));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(t() * str, t() * str, smal, lang * (0.5 + t()));
  }
  const tex = new THREE.CanvasTexture(g.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function lagTilfeldig(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

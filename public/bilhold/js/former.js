// Felles byggeklosser for bilen og hengeren: avrundede former, så modellene får myke kanter
// og jevne flater (i stedet for skarpe bokser).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Boks med avrundede kanter. Radiusen blir aldri større enn halve den minste siden.
export function rundBoks(b, h, l, r, seg = 4) {
  const rad = Math.min(r, Math.min(b, h, l) / 2 - 0.0005);
  return rad > 0.002 ? new RoundedBoxGeometry(b, h, l, seg, rad) : new THREE.BoxGeometry(b, h, l);
}

// Mangekant (punkter i 2D) med avrundede hjørner
export function rundForm(pkt, r, form = new THREE.Shape()) {
  const n = pkt.length;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...pkt[i]);
    const a = new THREE.Vector2(...pkt[(i + n - 1) % n]);
    const b = new THREE.Vector2(...pkt[(i + 1) % n]);
    const ra = Math.min(r, a.distanceTo(p) / 2), rb = Math.min(r, b.distanceTo(p) / 2);
    const s = p.clone().add(a.clone().sub(p).normalize().multiplyScalar(ra));
    const e = p.clone().add(b.clone().sub(p).normalize().multiplyScalar(rb));
    if (i === 0) form.moveTo(s.x, s.y); else form.lineTo(s.x, s.y);
    form.quadraticCurveTo(p.x, p.y, e.x, e.y);
  }
  form.closePath();
  return form;
}

// Sideprofil (formens x = bilens z, y = høyde) trukket ut på tvers av bilen med runde kanter.
// Geometrien ligger mellom x = midtX - bredde/2 og midtX + bredde/2.
export function profil(form, bredde, avrunding, mat, { midtX = 0, kant = avrunding * 0.6, seg = 8 } = {}) {
  const dybde = Math.max(0.001, bredde - 2 * avrunding);
  const geo = new THREE.ExtrudeGeometry(form, {
    depth: dybde, bevelEnabled: true, bevelThickness: avrunding, bevelSize: kant, bevelSegments: seg, curveSegments: 28,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.y = -Math.PI / 2;             // formens x blir bilens z, uttrekket går mot -x
  m.position.x = midtX + dybde / 2;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Dekk med runde skuldre, dreid rundt x-aksen. halvB er halve bredden.
export function dekkGeo(R, Ri, halvB, skulder = 0.06) {
  const p = [];
  const bue = (cx, cy, a1, a2) => {
    for (let i = 0; i <= 8; i++) {
      const a = a1 + (a2 - a1) * (i / 8);
      p.push(new THREE.Vector2(cx + Math.cos(a) * skulder, cy + Math.sin(a) * skulder));
    }
  };
  p.push(new THREE.Vector2(Ri, -halvB + 0.01));
  bue(R - skulder, -halvB + skulder, -Math.PI / 2, 0);
  bue(R - skulder, halvB - skulder, 0, Math.PI / 2);
  p.push(new THREE.Vector2(Ri, halvB - 0.01));
  const geo = new THREE.LatheGeometry(p, 56);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

// Alufelg med eiker: en skive med hull, trukket ut langs x. Forsiden vender mot +x.
export function felgGeo(R, { eiker = 5, ytre = R * 0.84, indre = R * 0.33, eikeBredde = 0.17, tykk = 0.03 } = {}) {
  const f = new THREE.Shape();
  f.absarc(0, 0, R, 0, Math.PI * 2, false);
  for (let i = 0; i < eiker; i++) {
    const m = ((i + 0.5) / eiker) * Math.PI * 2;
    const span = Math.PI / eiker - eikeBredde;
    const h = new THREE.Path();
    h.absarc(0, 0, ytre, m - span, m + span, false);
    h.absarc(0, 0, indre, m + span * 0.55, m - span * 0.55, true);
    h.closePath();
    f.holes.push(h);
  }
  const geo = new THREE.ExtrudeGeometry(f, { depth: tykk, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 3, curveSegments: 40 });
  geo.translate(0, 0, -tykk / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// Bøyd slange eller rør gjennom punktene
export function slange(punkter, r, mat) {
  const kurve = new THREE.CatmullRomCurve3(punkter.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(kurve, 24, r, 10, false), mat);
  m.castShadow = true;
  return m;
}

// Tekst på et gjennomsiktig lerret, brukt til merker og bokstaver
export function tekstTekstur(tekst, { bredde = 512, hoyde = 64, font = '700 48px Arial, sans-serif', farge = '#d9dbde', sperring = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = bredde; c.height = hoyde;
  const g = c.getContext('2d');
  g.font = font;
  g.fillStyle = farge;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (sperring) g.letterSpacing = `${sperring}px`;
  g.fillText(tekst, bredde / 2, hoyde / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

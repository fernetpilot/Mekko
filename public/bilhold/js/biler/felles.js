// Det alle bilmodellene i 3D-scenen har felles: materialer, hjul med bremser, kupé med sjiraff,
// statusmarkering, skanning og punktene knappene og hotspotene festes til.
// Hver modell (standard.js, discovery.js) bygger bare karosseriet sitt.
// Bilen står i origo og peker mot +z. Bilens venstre side er +x. 1 enhet = 1 meter.

import * as THREE from 'three';
import { lagSjiraff } from '../tilhenger.js';

// Lakk: varm, litt gulaktig grå, som mange Discovery 2. Hengeren bruker samme farge.
export const LAKK = 0xbdb9ac;

function lagMaterialer() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    solv: std({ color: LAKK, metalness: 0.75, roughness: 0.3 }),
    plast: std({ color: 0x17181a, metalness: 0.1, roughness: 0.75 }),
    // Glasset kan bli gjennomsiktig når bilen «skannes», så man ser sjåføren
    glass: std({ color: 0x0b0f14, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 1 }),
    krom: std({ color: 0xe8eaec, metalness: 1, roughness: 0.15 }),
    titan: std({ color: 0x9a9da2, metalness: 0.85, roughness: 0.35 }),
    lykt: std({ color: 0xf4f6f8, emissive: 0xfff4dc, emissiveIntensity: 0.6, roughness: 0.2 }),
    lyktglass: std({ color: 0x2a2e33, metalness: 0.9, roughness: 0.1 }),
    led: std({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 1.2, roughness: 0.2 }),
    blinklys: std({ color: 0xff9a1f, emissive: 0x663300 }),
    baklykt: std({ color: 0x7a0b0b, emissive: 0x5a0000, roughness: 0.3 }),
    bakledd: std({ color: 0xff3a2a, emissive: 0xff1a0a, emissiveIntensity: 0.9, roughness: 0.3 }),
    motorrom: std({ color: 0x1e1f22, roughness: 0.85 }),
    motorMat: std({ color: 0x5b5f66, metalness: 0.6, roughness: 0.45 }),
    oljeMat: std({ color: 0x2a2b2e, metalness: 0.3, roughness: 0.5 }),
    dekkMat: std({ color: 0x141414, roughness: 0.9 }),
    felgMat: std({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 }),
    skiveMat: std({ color: 0x6d7076, metalness: 0.9, roughness: 0.35 }),
    caliperMat: std({ color: 0x2a2b2e, metalness: 0.4, roughness: 0.5 }),
    klossMat: std({ color: 0x3a3b3e, roughness: 0.8 }),
    skinn: std({ color: 0x3b3430, roughness: 0.8 }),
    dashMat: std({ color: 0x1d1e21, roughness: 0.7 }),
  };
}

/**
 * Bygger en bil ut fra en modell. Modellen har mål (aksler, hjul, bredde, front og bak),
 * eventuelt felg, bremse og kupé, og en funksjon `karosseri(ctx)` som bygger resten og
 * svarer med { panser, oljelokk } (og eventuelt panserGrunn/panserMaks for vinkelen).
 * Oljelokk og oljefilter skal bruke `mat.oljeMat`, så de lyser i motorstatusen.
 */
export function lagBil(modell) {
  const gruppe = new THREE.Group();
  const karosseri = new THREE.Group();
  gruppe.add(karosseri);
  const mat = lagMaterialer();
  const { solv, glass } = mat;

  const boks = (b, h, l, materiale, x, y, z, foreldre = karosseri) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, l), materiale);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };
  // Plate i sideprofil (z, y), lagt i planet x = posX. `fas` gir skrå kanter rundt hele platen (lavpoly-stil).
  const sideplate = (punkter, tykkelse, materiale, posX, hull = [], foreldre = karosseri, fas = 0) => {
    const form = new THREE.Shape(punkter.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const h of hull) form.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
    const geo = new THREE.ExtrudeGeometry(form, fas
      ? { depth: tykkelse - 2 * fas, bevelEnabled: true, bevelThickness: fas, bevelSize: fas, bevelOffset: -fas, bevelSegments: 1 }
      : { depth: tykkelse, bevelEnabled: false });
    const m = new THREE.Mesh(geo, materiale);
    m.rotation.y = -Math.PI / 2;            // formens x blir bilens z
    m.position.x = posX + tykkelse / 2 - fas;
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };
  // Boks med skrå kanter (fas) på alle tolv kantene, i stedet for skarpe hjørner
  const fboks = (b, h, l, materiale, x, y, z, fas = 0.02, foreldre = karosseri) => {
    const f = Math.min(fas, b / 2 - 0.001, h / 2 - 0.001, l / 2 - 0.001);
    const hb = b / 2 - f, hh = h / 2 - f;
    // Åttekant i (x, y): rektangelet med hjørnene skåret av, så også kantene på langs blir skrå
    const form = new THREE.Shape([[-hb + f, -hh], [hb - f, -hh], [hb, -hh + f], [hb, hh - f], [hb - f, hh], [-hb + f, hh], [-hb, hh - f], [-hb, -hh + f]]
      .map(([px, py]) => new THREE.Vector2(px, py)));
    const geo = new THREE.ExtrudeGeometry(form, { depth: Math.max(l - 2 * f, 0.001), bevelEnabled: true, bevelThickness: f, bevelSize: f, bevelSegments: 1 });
    geo.translate(0, 0, -(l / 2 - f));
    const m = new THREE.Mesh(geo, materiale);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };
  // Liggende sylinder med enden mot +z (lykter, lokk)
  const rund = (r, tykk, materiale, x, y, z, foreldre = karosseri, segmenter = 24) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, tykk, segmenter), materiale);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    foreldre.add(m);
    return m;
  };

  const { panser, oljelokk, panserGrunn = 0, panserMaks = 1.05 } =
    modell.karosseri({ karosseri, gruppe, mat, boks, fboks, sideplate, rund });

  // Hjul
  const hjul = [];
  const hotspots = { motor: oljelokk };
  for (const s of [-1, 1]) {
    for (const z of [modell.foraksel, modell.bakaksel]) {
      const { spinn, stille, mønsterpunkt } = lagHjul(mat, s, modell);
      spinn.position.set(s * modell.sporvidde, modell.hjulradius, z);
      stille.position.copy(spinn.position);
      gruppe.add(spinn, stille);
      hjul.push(spinn);
      if (s === 1 && z === modell.foraksel) {
        hotspots.bremser = stille.getObjectByName('bremsepunkt');
        hotspots.dekk = mønsterpunkt;
      }
    }
  }

  // Statusmarkering: delene er nøytrale til kameraet zoomer inn
  const markerbare = {
    motor: [mat.oljeMat],            // oljelokk og oljefilter
    bremser: [mat.klossMat, mat.caliperMat],   // hele bremsen: klosser og kaliper
    dekk: [mat.dekkMat],
  };
  const grunnfarge = new Map();
  for (const liste of Object.values(markerbare)) for (const m of liste) grunnfarge.set(m, m.color.clone());

  // kritisk: delen blinker rolig i rødt, i stedet for den svake pulsen
  function marker(navn, styrke, farge, tid, kritisk = false) {
    const puls = kritisk ? 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(tid * 3.4)) : 0.75 + 0.25 * Math.sin(tid * 4);
    for (const m of markerbare[navn]) {
      m.color.copy(grunnfarge.get(m)).lerp(farge, styrke * (navn === 'dekk' ? 0.2 : 0.8));
      m.emissive.copy(farge).multiplyScalar(styrke * puls * (navn === 'dekk' ? (kritisk ? 0.4 : 0.22) : 0.9));
    }
  }

  // ---------- Kupéen: seter, ratt og en sjiraff som kjører (vises når bilen skannes) ----------
  // Målene er fra standardbilen. Andre modeller flytter hele kupéen med `kupe.forskyv`.
  const kupe = { bredde: 1.76, forskyv: [0, 0, 0], ...modell.kupe };
  const interior = new THREE.Group();
  interior.visible = false;
  interior.position.set(...kupe.forskyv);
  karosseri.add(interior);
  const iboks = (b, h, l, materiale, x, y, z, rx = 0) => {
    const m = boks(b, h, l, materiale, x, y, z, interior);
    m.rotation.x = rx;
    m.castShadow = false;
    return m;
  };
  iboks(kupe.bredde - 0.16, 0.2, 0.28, mat.dashMat, 0, 1.08, 0.34);                // dashbord (holder seg bak frontruta)
  for (const sx of [-1, 1]) {
    iboks(0.5, 0.14, 0.5, mat.skinn, sx * 0.42, 0.78, -0.14);                      // forsete
    iboks(0.48, 0.66, 0.12, mat.skinn, sx * 0.42, 1.12, -0.42, -0.12);              // ryggstø
    iboks(0.26, 0.14, 0.1, mat.skinn, sx * 0.42, 1.52, -0.47, -0.12);              // nakkestøtte
  }
  iboks(1.4, 0.14, 0.5, mat.skinn, 0, 0.8, -1.3);                                  // baksete
  iboks(1.4, 0.6, 0.12, mat.skinn, 0, 1.13, -1.58, -0.1);
  // Ratt på venstre side (førersiden i Norge; bilens venstre er +x)
  const ratt = new THREE.Group();
  ratt.position.set(0.42, 1.3, 0.2);
  ratt.rotation.x = -1.05;
  interior.add(ratt);
  const rattring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 28), mat.dashMat);
  rattring.rotation.x = Math.PI / 2;
  ratt.add(rattring);
  for (let i = 0; i < 3; i++) {
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.03), mat.dashMat);
    eike.rotation.y = (i / 3) * Math.PI * 2;
    eike.position.x = Math.cos(eike.rotation.y) * 0.08;
    eike.position.z = -Math.sin(eike.rotation.y) * 0.08;
    ratt.add(eike);
  }
  const ror = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), mat.dashMat);
  ror.position.set(0, -0.15, 0);
  ratt.add(ror);
  // Sjåføren: en mindre sjiraff i førersetet
  const sjafor = lagSjiraff();
  sjafor.gruppe.scale.setScalar(0.48);
  sjafor.gruppe.position.set(0.42, 0.47, -0.14);
  interior.add(sjafor.gruppe);

  // Skanning: en lysende flate som glir over bilen og en tynn ramme rundt
  const { bredde, front, bak } = modell;
  const skannMat = new THREE.MeshBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const skannFlate = new THREE.Mesh(new THREE.BoxGeometry(bredde + 0.12, 2.3, 0.04), skannMat);
  skannFlate.position.y = 1.1;
  skannFlate.visible = false;
  gruppe.add(skannFlate);
  const skannRamme = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(bredde + 0.4, 2.45, front - bak + 0.5)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }),
  );
  skannRamme.position.set(0, 1.12, (front + bak) / 2);
  skannRamme.renderOrder = 10;
  gruppe.add(skannRamme);

  // Punkter for knappene: fem over bilen (i to høyder) og én nederst på siden.
  // main.js dytter knappene fra hverandre hvis de likevel havner oppå hverandre.
  const knappepunkter = {};
  for (const [navn, x, y, z] of [
    ['bil-1', 0.3, 2.5, 1.7], ['bil-2', 0.3, 3.3, 0.6], ['bil-3', 0.3, 2.5, -0.5],
    ['bil-4', 0.3, 3.3, -1.6], ['bil-5', 0.3, 2.5, -2.6],
    ['bil-apne', bredde / 2, 0.42, -0.05],
  ]) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    gruppe.add(o);
    knappepunkter[navn] = o;
  }

  // styrke 0..1: hvor gjennomsiktig glasset er og hvor synlig skanningen er
  const glod = new THREE.Color(0x9cc8ff);
  function skann(styrke, tid, hover = 0) {
    glass.opacity = 1 - styrke * 0.9;
    glass.metalness = 0.9 - styrke * 0.8;              // mindre speiling, så man ser inn
    solv.emissive.copy(glod).multiplyScalar(hover * 0.14 * (0.8 + 0.2 * Math.sin(tid * 3)));
    glass.depthWrite = styrke < 0.05;
    interior.visible = styrke > 0.02;
    if (interior.visible) sjafor.oppdater(tid + 3);
    skannFlate.visible = styrke > 0.02;
    skannMat.opacity = styrke * 0.28;
    const t = (tid * 0.45) % 1;                       // glir fra front til bak og starter på nytt
    skannFlate.position.z = THREE.MathUtils.lerp(front + 0.15, bak - 0.15, t);
    skannRamme.material.opacity = styrke * (0.55 + 0.25 * Math.sin(tid * 3));
  }

  // t 0..1: panseret åpnes (motorrom-seksjonen)
  function apnePanser(t) { panser.rotation.x = panserGrunn - panserMaks * t; }
  apnePanser(0);

  // Rydder bort geometri og materialer når modellen byttes
  function fjern() {
    gruppe.removeFromParent();
    gruppe.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material ?? [])) { m.map?.dispose(); m.dispose(); }
    });
  }

  return { modell, gruppe, karosseri, hjul, hotspots, marker, skann, apnePanser, knappepunkter, lakk: solv, fjern };
}

// Hjul: dekk med mønster, felg med eiker og bremse. Målene kan settes per modell:
// hjulradius, hjulbredde, felg { radius, eiker, eikebredde }, bremse { skala, kaliper: 'fast'|'flytende' }.
function lagHjul(mat, side, modell) {
  const spinn = new THREE.Group();   // roterer
  const stille = new THREE.Group();  // caliper står stille
  const R = modell.hjulradius;
  const B = modell.hjulbredde ?? 0.27;
  const felg = { radius: 0.235, eiker: 5, eikebredde: 0.065, ...modell.felg };
  const bremse = { skala: 1, kaliper: 'fast', ...modell.bremse };

  // Dekk
  const dekk = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, B, 36, 1, true), mat.dekkMat);
  dekk.rotation.z = Math.PI / 2;
  dekk.castShadow = true;
  spinn.add(dekk);
  for (const x of [-1, 1]) {
    const vegg = new THREE.Mesh(new THREE.RingGeometry(felg.radius + 0.015, R - 0.02, 36), mat.dekkMat);
    vegg.rotation.y = x * Math.PI / 2;
    vegg.position.x = x * B / 2;
    spinn.add(vegg);
  }
  // Dekkmønster: klosser rundt hele dekket i to forskjøvne rader. Veidekk ('vei') har lavere og tettere klosser.
  const vei = modell.dekk === 'vei';
  const antall = vei ? 42 : 30;
  const klossGeo = new THREE.BoxGeometry(B * 0.37, vei ? 0.018 : 0.035, vei ? 0.038 : 0.055);
  for (let i = 0; i < antall; i++) {
    for (const rad of [-1, 1]) {
      const a = (i + (rad > 0 ? 0.5 : 0)) / antall * Math.PI * 2;
      const k = new THREE.Mesh(klossGeo, mat.dekkMat);
      const kr = vei ? R - 0.016 : R - 0.01;
      k.position.set(rad * B * 0.25, Math.cos(a) * kr, Math.sin(a) * kr);
      k.rotation.x = a;
      spinn.add(k);
    }
  }

  // Felg med eiker, så bremseskiven synes
  const ytterX = side * (B / 2 - 0.03);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(felg.radius, 0.025, 8, 36), mat.felgMat);
  kant.rotation.y = Math.PI / 2;
  kant.position.x = ytterX;
  spinn.add(kant);
  const nav = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), mat.felgMat);
  nav.rotation.z = Math.PI / 2;
  nav.position.x = ytterX;
  spinn.add(nav);
  const eikeLengde = felg.radius - 0.055;
  for (let i = 0; i < felg.eiker; i++) {
    const a = (i / felg.eiker) * Math.PI * 2;
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.03, eikeLengde, felg.eikebredde), mat.felgMat);
    const r = 0.05 + eikeLengde / 2;
    eike.position.set(ytterX, Math.cos(a) * r, Math.sin(a) * r);
    eike.rotation.x = a;
    spinn.add(eike);
  }

  // Bremsen bygges i standardstørrelse og skaleres i hjulets plan (y, z) til modellens skive
  const skiveGruppe = new THREE.Group();
  skiveGruppe.scale.set(1, bremse.skala, bremse.skala);
  spinn.add(skiveGruppe);
  const kaliperGruppe = new THREE.Group();
  kaliperGruppe.scale.set(1, bremse.skala, bremse.skala);
  stille.add(kaliperGruppe);

  // Ventilert skive. Standard: fast firestempels kaliper som på en Discovery 2 (ca. 1999–2004),
  // en halvdel på hver side av skiva. 'flytende': kaliperen med stemplene sitter på innsiden,
  // og utsiden er bare en tynn bøyle (som på Discovery 3 og 4).
  // To klosser med stålbakplate, holdt av to pinner og en fjærklemme. Klossene stikker opp
  // over kaliperen, så man ser dem gjennom felgen.
  const skiveH = 0.013;                    // halv tykkelse på skiva
  for (const x of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.009, 36), mat.skiveMat);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x * (skiveH - 0.0045);
    skiveGruppe.add(plate);
  }
  const kjoling = new THREE.Mesh(new THREE.CylinderGeometry(0.186, 0.186, skiveH * 2 - 0.006, 36, 1, true), mat.plast);
  kjoling.rotation.z = Math.PI / 2;
  skiveGruppe.add(kjoling);                // mørk spalte mellom platene = ventilert skive
  const hatt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 24), mat.skiveMat);
  hatt.rotation.z = Math.PI / 2;
  hatt.position.x = side * 0.035;
  skiveGruppe.add(hatt);

  // Bue-formet del i hjulets plan (y opp, z fram), sentrert rundt vinkel MIDT fra toppen
  const MIDT = -1.85;                      // bak på skiva, litt under midten: der ser kameraet inn gjennom felgen
  const bue = (r1, r2, spenn, tykk, mt, x, navn = null, midt = MIDT) => {
    const form = new THREE.Shape();
    const a1 = midt - spenn, a2 = midt + spenn, n = 14;
    for (let i = 0; i <= n; i++) {
      const a = a1 + (a2 - a1) * (i / n);
      (i ? form.lineTo : form.moveTo).call(form, Math.sin(a) * r2, Math.cos(a) * r2);
    }
    for (let i = n; i >= 0; i--) {
      const a = a1 + (a2 - a1) * (i / n);
      form.lineTo(Math.sin(a) * r1, Math.cos(a) * r1);
    }
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: tykk, bevelEnabled: false, curveSegments: 1 }), mt);
    m.rotation.y = -Math.PI / 2;           // formens x blir hjulets z, uttrekket går langs x
    m.position.x = x + tykk / 2;
    if (navn) m.name = navn;
    kaliperGruppe.add(m);
    return m;
  };
  // Klossene: friksjonsbelegg mot skiva og bakplate utenpå, på begge sider
  for (const x of [-1, 1]) {
    bue(0.122, 0.188, 0.36, 0.012, mat.klossMat, x * (skiveH + 0.0065));
    bue(0.118, 0.198, 0.4, 0.005, mat.klossMat, x * (skiveH + 0.0155));
  }
  // Kaliperen: en halvdel på hver side (stemplene sitter her) og to broer over skivekanten
  const halv = 0.034;
  const kx = skiveH + 0.018 + halv / 2;
  if (bremse.kaliper === 'flytende') {
    // Innsiden: stort hus med stempler. Utsiden: en lav, tynn bøyle, så klossene synes godt.
    bue(0.1, 0.172, 0.52, halv * 1.4, mat.caliperMat, -side * (kx + halv * 0.2));
    bue(0.13, 0.152, 0.42, halv * 0.55, mat.caliperMat, side * (kx - halv * 0.22));
  } else {
    // Den ytre halvdelen er lav, så klossene synes over den
    for (const x of [-1, 1]) bue(0.105, x === side ? 0.15 : 0.168, 0.5, halv, mat.caliperMat, x * kx);
  }
  // Punktet hotspoten peker på: midt på bremsen, på utsiden
  const bremsepunkt = new THREE.Object3D();
  bremsepunkt.name = 'bremsepunkt';
  bremsepunkt.position.set(side * (kx + halv / 2), Math.cos(MIDT) * 0.16, Math.sin(MIDT) * 0.16);
  kaliperGruppe.add(bremsepunkt);
  for (const a of [-1, 1]) bue(0.196, 0.222, 0.075, kx * 2 + halv, mat.caliperMat, 0, null, MIDT + a * 0.43);
  // Holdepinner og fjærklemme over klossene
  for (const a of [MIDT - 0.17, MIDT + 0.17]) {
    const pinne = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, kx * 2 + halv + 0.02, 8), mat.felgMat);
    pinne.rotation.z = Math.PI / 2;
    pinne.position.set(0, Math.cos(a) * 0.203, Math.sin(a) * 0.203);
    kaliperGruppe.add(pinne);
  }
  const klemme = new THREE.Mesh(new THREE.BoxGeometry(kx * 2 - 0.01, 0.004, 0.07), mat.felgMat);
  klemme.position.set(0, Math.cos(MIDT) * 0.207, Math.sin(MIDT) * 0.207);
  klemme.rotation.x = MIDT;
  kaliperGruppe.add(klemme);
  // Luftenippel på innsiden
  const nippel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.025, 8), mat.felgMat);
  nippel.position.set(-side * (kx + halv / 2 + 0.008), Math.cos(MIDT + 0.3) * 0.16, Math.sin(MIDT + 0.3) * 0.16);
  nippel.rotation.z = Math.PI / 2;
  kaliperGruppe.add(nippel);

  // Punktet på dekkets mønster som hotspoten peker på (fremre del av dekket)
  const mønsterpunkt = new THREE.Object3D();
  mønsterpunkt.position.set(side * 0.06, 0.05, R);
  stille.add(mønsterpunkt);

  return { spinn, stille, mønsterpunkt };
}

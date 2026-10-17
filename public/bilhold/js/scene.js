// 3D-scenen: en stilisert Land Rover som kjører på en vei, med tilhenger og sjiraff.
// Alt er bygget av enkle former i Three.js, så det trengs ingen modellfil.
// Bilen står i origo og peker mot +z. Bilens venstre side er +x.
// Bilmodellene ligger i biler/ (standardbilen og Discovery 3/4), valgt med settModell.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lagTilhenger, sjiraffKamera, veiHump } from './tilhenger.js';
import { lagBil, LAKK } from './biler/felles.js';
import { MODELLER } from './biler/index.js';

const FARTKMT = 60;
const FART = FARTKMT / 3.6;              // meter per sekund

// Bil + tilhenger + sjiraff, brukt til å ramme inn kalkulator-visningen
const VOGNTOG = { midtZ: -1.8, lengde: 10.2, hoyde: 3.4, midtY: 1.5 };
// Bare bilen, brukt når man åpner «bilen din» (innlogget)
const BILRAMME = { midtZ: 0.03, lengde: 5.9, hoyde: 2.4, midtY: 1.15 };
const VEIKANT_NAER_X = 1.9 + 7.5 / 2;    // veikanten nærmest kameraet i kalkulator-modus (se lagOmgivelser)
const KANTLINJE_NAER_X = 1.9 + 3.6;   // hvit kantlinje på samme side
const MIDTLINJE_X = 1.9;
const SIDE_TOPP = 64 + 4;                  // vogntoget står rett under headeren i sidevisningene

// Fargen delen lyser med når kameraet zoomer inn: samme som statusen på kortet
const FARGE_FOR_STATUS = {
  ok: new THREE.Color('#34c759'),
  sjekk: new THREE.Color('#ffcc00'),
  kritisk: new THREE.Color('#ff3b30'),
  tom: new THREE.Color('#9cc8ff'),
};
// Eksempeldataene (utlogget): motor i orden, bremser bør sjekkes, dekk må byttes
// Eksempeldataene har samme status; innlogget kommer den fra kortene
const delStatus = { motor: 'ok', bremser: 'sjekk', dekk: 'kritisk' };
const STATUSFARGER = {
  motor: FARGE_FOR_STATUS.ok.clone(),
  bremser: FARGE_FOR_STATUS.sjekk.clone(),
  dekk: FARGE_FOR_STATUS.kritisk.clone(),
};

const TEMA = {
  dark: { bg: new THREE.Color('#0a0b0d'), gress: new THREE.Color('#1d2a1f'), vei: new THREE.Color('#2a2c30') },
  light: { bg: new THREE.Color('#eef0f2'), gress: new THREE.Color('#9db88a'), vei: new THREE.Color('#8d9096') },
};

// Kameraposisjoner per seksjon: [kamera, punkt kameraet ser på]
// 0 = hero, 1 = motorrom, 2 = bremser, 3 = dekk. Innzoomingen følger forakselen til modellen.
function lagKamerapunkter(aspekt, modell) {
  const { foraksel, sporvidde } = modell;
  // Smal mobilskjerm trenger større avstand for å få med hele bilen og hele tilhengeren
  const k = THREE.MathUtils.clamp(0.75 / aspekt, 1, 1.9);
  const smal = THREE.MathUtils.clamp((0.75 - aspekt) / 0.3, 0, 1);  // 0 på PC, 1 på mobil
  return [
    { pos: new THREE.Vector3(7.4 * k + 3.2 * smal, 3.4 + 0.7 * k, 5.2 * k + 3.6 * smal), mal: new THREE.Vector3(0, 0.9 + 0.3 * k, -2.0 + 1.2 * smal) },
    { pos: new THREE.Vector3(1.5, 3.6, foraksel + 3.28), mal: new THREE.Vector3(0, 0.75, foraksel + 0.03) },
    { pos: new THREE.Vector3(sporvidde + 2.48, 0.95, foraksel + 1.28), mal: new THREE.Vector3(sporvidde, 0.2, foraksel) },
    { pos: new THREE.Vector3(sporvidde + 0.93, 0.55, foraksel + 1.53), mal: new THREE.Vector3(sporvidde, 0.05, foraksel + 0.1) },
  ];
}

export function lagScene(canvas) {
  // Lett versjon for eldre og svake telefoner: lav oppløsning, ingen skygger og 30 bilder i sekundet.
  // Slås på med en gang hvis telefonen sier at den har lite minne eller sparer data, ellers hvis
  // de første sekundene går tregt (se maalYtelse nederst).
  const svakFraStart = (navigator.deviceMemory && navigator.deviceMemory <= 2) || navigator.connection?.saveData === true;
  let lett = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !svakFraStart, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = TEMA.dark.bg.clone();
  scene.fog = new THREE.Fog(scene.background, 18, 60);

  // Refleksjoner til metallet
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const kamera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);

  // Lys
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4a3a, 0.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(6, 10, 2.2);
  sol.target.position.set(0, 0, -1.8);
  scene.add(sol.target);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  sol.shadow.bias = -0.0005;
  sol.shadow.normalBias = 0.02;
  scene.add(sol);

  const omgivelser = lagOmgivelser(scene);
  let bil = lagBil(MODELLER.standard);
  scene.add(bil.gruppe);
  const tilhenger = lagTilhenger();
  scene.add(tilhenger.gruppe);

  // ---------- Tilstand som styres fra scrolling ----------
  let kamerapunkter = lagKamerapunkter(1, bil.modell);
  let fremdrift = 0;                 // 0..3, scroll-posisjon målt i seksjoner
  let temaMal = 'dark';
  const kamPos = kamerapunkter[0].pos.clone();
  const kamMal = kamerapunkter[0].mal.clone();
  const onsketPos = new THREE.Vector3();
  const onsketMal = new THREE.Vector3();
  const aktivitet = { motor: 0, bremser: 0, dekk: 0 };
  let modus = 'scroll';              // 'scroll', 'kalkulator', 'bil' eller 'sjiraff' (på vei til innlogging)
  let sideValg = 'kalkulator';       // hvilken sidevisning kameraet går til: hele vogntoget eller bare bilen
  const sidekamera = {};             // { kalkulator: {...}, bil: {...} }
  let bilSkannMal = 0;
  let bilSkann = 0;
  let bilHover = 0;
  let sjiraffT = 0;                  // 0..1, hvor langt kameraet har zoomet inn på sjiraffen
  const sjiraffPos = new THREE.Vector3();
  const sjiraffMal = new THREE.Vector3();
  const hodePos = new THREE.Vector3();
  let vedSjiraff = null;             // kalles når kameraet er helt inne ved sjiraffen
  let kalkBlend = 0;                 // 0 = scroll-kamera, 1 = kalkulator-kamera
  let hoverMal = 0;
  let hover = 0;
  let baseFov = 40;
  const kalkPos = new THREE.Vector3();
  const kalkMal = new THREE.Vector3();
  let kalkSenterAndel = 0.2;         // hvor høyt på skjermen bilen står i kalkulator-modus
  let kalkBunnPx = 0;
  const redusertBevegelse = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beroring = window.matchMedia('(pointer: coarse)').matches;

  const lakkMal = new THREE.Color(LAKK);   // bilens farge glir over til registrert farge
  let sideForskyv = 0;               // px bildet er flyttet opp når man har blart ned i et panel
  let stillbilde = false;            // helt nede: alt står stille, bare veien og kantlinjen synes
  let bevegelsestid = 0;             // klokke som stopper når stillbilde er på (sjiraffer, skanning)

  function tilpassStorrelse() {
    const b = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(b, h, false);
    const aspekt = b / h;
    baseFov = aspekt < 1 ? 50 : 38;
    kamerapunkter = lagKamerapunkter(aspekt, bil.modell);
    sidekamera.kalkulator = beregnSidekamera(b, h, VOGNTOG, 0.27);
    sidekamera.bil = beregnSidekamera(b, h, BILRAMME, 0.24);
    velgSide(sideValg);
  }
  function velgSide(navn) {
    sideValg = navn;
    const k = sidekamera[navn];
    kalkPos.copy(k.pos);
    kalkMal.copy(k.mal);
    kalkSenterAndel = k.senterAndel;
    kalkBunnPx = k.bunnPx;
  }

  // Kalkulator-modus: kameraet står ute på siden, så bil og henger kjører fra høyre mot venstre,
  // og hele vogntoget skal få plass som en stripe øverst på skjermen.
  function beregnSidekamera(b, h, ramme, maksAndel) {
    const tan = Math.tan(THREE.MathUtils.degToRad(baseFov) / 2);
    const forBredde = ramme.lengde / 2 / (tan * (b / h));
    const forHoyde = ramme.hoyde / (2 * tan * maksAndel); // høyst maksAndel av skjermhøyden
    const avstand = Math.max(forBredde, forHoyde);
    // Lav vinkel: veien blir et smalt bånd, så teksten under får rolig bakgrunn
    const pos = new THREE.Vector3(avstand, ramme.midtY + avstand * 0.035, ramme.midtZ);
    const mal = new THREE.Vector3(0, ramme.midtY, ramme.midtZ);
    const synlig = 2 * avstand * tan;                     // meter som får plass i høyden
    const halvPx = (ramme.hoyde / 2 / synlig) * h;
    const senterAndel = (SIDE_TOPP + halvPx) / h;
    // Hvor et punkt på bakken (x, avstand fra midten av veien) havner på skjermen, i px fra toppen
    const fx = -avstand, fy = ramme.midtY - pos.y, fl = Math.hypot(fx, fy);
    const bakkePx = (x) => {
      const vx = x - avstand, vy = -pos.y;
      const dybde = (vx * fx + vy * fy) / fl;
      const opp = (vx * fy - vy * fx) / fl;               // høyde over midten av bildet, i meter
      return senterAndel * h - (opp / (dybde * tan)) * (h / 2);
    };
    return {
      pos, mal, senterAndel,
      // Panelet starter under veikanten nærmest kameraet, så teksten aldri ligger oppå veien
      bunnPx: Math.max(SIDE_TOPP + halvPx * 2, bakkePx(VEIKANT_NAER_X) + 10),
      kantlinjePx: bakkePx(KANTLINJE_NAER_X),            // den hvite linjen langs veikanten
      midtlinjePx: bakkePx(MIDTLINJE_X),                 // midtstripen: over den skjules alt
    };
  }
  tilpassStorrelse();
  window.addEventListener('resize', tilpassStorrelse);

  // "Snappy" kurve: rolig ut og inn, rask i midten
  const kurve = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function beregnKameramal() {
    const maks = kamerapunkter.length - 1;
    const p = THREE.MathUtils.clamp(fremdrift, 0, maks);
    const i = Math.min(Math.floor(p), maks - 1);
    const t = kurve(p - i);
    onsketPos.lerpVectors(kamerapunkter[i].pos, kamerapunkter[i + 1].pos, t);
    onsketMal.lerpVectors(kamerapunkter[i].mal, kamerapunkter[i + 1].mal, t);
  }

  // Flytter bildet oppover i kalkulator-modus uten å endre størrelsen på det man ser.
  // Kameraet rendrer et utsnitt av en dobbelt så høy ramme.
  function oppdaterProjeksjon(t) {
    const b = window.innerWidth;
    const h = window.innerHeight;
    const ekstra = h;                                    // plass til å flytte bildet både opp og ned
    const helH = h + 2 * ekstra;
    kamera.aspect = b / helH;
    kamera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * (helH / h)));
    const y = ekstra + t * (h / 2 - kalkSenterAndel * h + sideForskyv);
    kamera.setViewOffset(b, helH, 0, y, b, h);
  }

  const klokke = new THREE.Clock();
  let veistrekning = 0;
  // Hjulene snurrer saktere enn farten tilsier. Ekte fart (ca. 7 omdreininger i sekundet) gir
  // samme effekt som i film: eikene og dekkmønsteret ser ut til å hakke og stå stille.
  let hjulvinkel = 0;
  const HJUL_OMDR_PER_SEK = 0.7;

  function tegn() {
    const dt = Math.min(klokke.getDelta(), 0.05);
    const demp = 1 - Math.exp(-dt * 7);

    // Kamera: blander scroll-kameraet med kalkulator-kameraet
    beregnKameramal();
    const side = modus === 'kalkulator' || modus === 'bil' ? 1 : 0;
    kalkBlend = THREE.MathUtils.damp(kalkBlend, side, 3.2, dt);
    if (Math.abs(kalkBlend - side) < 0.001) kalkBlend = side;
    const b = kurve(kalkBlend);
    onsketPos.lerp(kalkPos, b);
    onsketPos.y += Math.sin(Math.PI * b) * 2.5;           // løftes litt på veien ut til siden
    onsketMal.lerp(kalkMal, b);
    // Innlogging: kameraet flyr inn til sjiraffhodet, som ser rett på deg
    sjiraffT = THREE.MathUtils.clamp(sjiraffT + (modus === 'sjiraff' ? dt / 1.3 : -dt / 0.8), 0, 1);
    const sj = kurve(sjiraffT);
    if (sjiraffT === 1 && vedSjiraff) { vedSjiraff(); vedSjiraff = null; }
    if (sjiraffT > 0) {
      tilhenger.sjiraffHode.getWorldPosition(hodePos);
      sjiraffKamera(hodePos, window.innerWidth / window.innerHeight, baseFov, sjiraffPos, sjiraffMal);
      onsketPos.lerp(sjiraffPos, sj);
      onsketMal.lerp(sjiraffMal, sj);
    }
    if ((kalkBlend > 0 && kalkBlend < 1) || sjiraffT > 0 || (side && kalkBlend === 1)) {
      kamPos.copy(onsketPos);                             // følger kurven direkte under overgangen
      kamMal.copy(onsketMal);
    } else {
      kamPos.lerp(onsketPos, demp);
      kamMal.lerp(onsketMal, demp);
    }
    kamera.position.copy(kamPos);
    kamera.lookAt(kamMal);
    oppdaterProjeksjon(THREE.MathUtils.smoothstep(kalkBlend, 0.35, 1));

    // Tåken trekkes bakover når kameraet står langt unna
    scene.fog.near = 18 + kalkBlend * 22;
    scene.fog.far = 60 + kalkBlend * 50;
    // ... og trekkes helt inn rundt sjiraffen, så bare hodet står igjen mot mørk bakgrunn
    scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, 1.2, sj);
    scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, 6, sj);

    if (!bil.lakk.color.equals(lakkMal)) {
      bil.lakk.color.lerp(lakkMal, 1 - Math.exp(-dt * 4));
      if (Math.abs(bil.lakk.color.r - lakkMal.r) + Math.abs(bil.lakk.color.g - lakkMal.g) + Math.abs(bil.lakk.color.b - lakkMal.b) < 0.002) bil.lakk.color.copy(lakkMal);
    }

    // Kjøring
    const fart = redusertBevegelse ? FART * 0.15 : FART;
    const dtB = stillbilde ? 0 : dt;                   // helt nede i et panel står alt stille
    bevegelsestid += dtB;
    veistrekning += fart * dtB;
    omgivelser.oppdater(veistrekning);
    hjulvinkel += dtB * Math.PI * 2 * HJUL_OMDR_PER_SEK * (redusertBevegelse ? 0.3 : 1);
    for (const hjul of bil.hjul) hjul.rotation.x = hjulvinkel;
    hover = THREE.MathUtils.damp(hover, modus === 'scroll' ? hoverMal : 0, 10, dt);
    // På mobil blinker en tynn kant rundt hengeren sakte, så man skjønner at den kan trykkes på
    const blink = beroring && modus === 'scroll' ? THREE.MathUtils.clamp(1 - fremdrift * 2, 0, 1) : 0;
    // Bilen skannes når man peker på den (innlogget), og står gjennomsiktig i bil-visningen
    // Samme tempo som når man peker på tilhengeren
    bilSkann = THREE.MathUtils.damp(bilSkann, modus === 'bil' ? 1 : modus === 'scroll' ? bilSkannMal : 0, 10, dt);
    if (bilSkann < 0.005) bilSkann = 0;
    bilHover = THREE.MathUtils.damp(bilHover, modus === 'scroll' ? bilSkannMal : 0, 10, dt);
    bil.skann(bilSkann, bevegelsestid, bilHover);
    tilhenger.oppdater({ strekning: veistrekning, hjulvinkel, tid: bevegelsestid, hover, blink });
    // Litt liv i karosseriet
    bil.karosseri.position.y = veiHump(veistrekning);
    bil.karosseri.rotation.z = Math.sin(veistrekning * 0.5) * 0.004;

    // Hvor aktiv hver seksjon er (1 når den er midt på skjermen)
    const naer = (k) => THREE.MathUtils.clamp(1 - Math.abs(fremdrift - k) * 1.6, 0, 1);
    for (const [navn, k] of [['motor', 1], ['bremser', 2], ['dekk', 3]]) {
      aktivitet[navn] = THREE.MathUtils.lerp(aktivitet[navn], naer(k), demp);
      bil.marker(navn, aktivitet[navn], STATUSFARGER[navn], klokke.elapsedTime, delStatus[navn] === 'kritisk');
    }
    // Panseret åpnes i motorrom-seksjonen
    bil.apnePanser(THREE.MathUtils.smoothstep(aktivitet.motor, 0.05, 0.9));

    // Fargetema glir over
    const tema = TEMA[temaMal];
    scene.background.lerp(tema.bg, demp * 0.6);
    scene.fog.color.copy(scene.background);
    omgivelser.gressMat.color.lerp(tema.gress, demp * 0.6);
    omgivelser.veiMat.color.lerp(tema.vei, demp * 0.6);

    maalYtelse(dt);
    hoppOver = lett && !hoppOver;          // lett versjon: tegn annenhver frame (ca. 30 i sekundet)
    if (!hoppOver) renderer.render(scene, kamera);
    requestAnimationFrame(tegn);
  }
  let hoppOver = false;

  function brukLettVersjon() {
    if (lett) return;
    lett = true;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    tilpassStorrelse();
    document.documentElement.classList.add('lett-3d');
  }
  // Måler hvor fort de første sekundene tegnes (etter oppstart). Går det tregt, byttes det til lett versjon.
  const maaling = { tid: 0, tider: [] };
  function maalYtelse(dt) {
    if (lett || maaling.tider === null) return;
    maaling.tid += dt;
    if (maaling.tid < 1.5) return;                       // oppstarten teller ikke
    maaling.tider.push(dt);
    if (maaling.tider.length < 90) return;
    const sortert = maaling.tider.sort((a, b) => a - b);
    const median = sortert[Math.floor(sortert.length / 2)];
    maaling.tider = null;
    if (median > 1 / 30) brukLettVersjon();
  }
  if (svakFraStart || new URLSearchParams(location.search).has('lett')) brukLettVersjon();
  requestAnimationFrame(tegn);

  const tmp = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const peker = new THREE.Vector2();
  return {
    settFremdrift(p) { fremdrift = p; },
    settModus(m) {
      modus = ['kalkulator', 'bil', 'sjiraff'].includes(m) ? m : 'scroll';
      if (modus === 'kalkulator' || modus === 'bil') velgSide(modus);
    },
    settBilSkann(on) { bilSkannMal = on ? 1 : 0; },
    // Hva ligger under et punkt på skjermen (px): 'bil', 'tilhenger' eller null
    treff(x, y) {
      peker.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(peker, kamera);
      const t = raycaster.intersectObjects([bil.gruppe, tilhenger.gruppe], true).find((t) => t.object.type === 'Mesh' && t.object.visible);
      if (!t) return null;
      let o = t.object;
      while (o && o !== bil.gruppe && o !== tilhenger.gruppe) o = o.parent;
      return o === bil.gruppe ? 'bil' : 'tilhenger';
    },
    // Hvor langt sjiraffen er kommet i bevegelsen sin (sekunder), så innloggingssiden kan fortsette der
    sjiraffTid() { return klokke.elapsedTime; },
    // Zoomer inn på sjiraffhodet og svarer når kameraet er framme
    zoomTilSjiraff() {
      modus = 'sjiraff';
      return new Promise((ferdig) => { vedSjiraff = ferdig; });
    },
    settHover(on) { hoverMal = on ? 1 : 0; },
    // Treffer et punkt på skjermen (px) hengeren eller sjiraffen?
    treffTilhenger(x, y) {
      peker.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(peker, kamera);
      return raycaster.intersectObject(tilhenger.gruppe, true).some((t) => t.object.type === 'Mesh');
    },
    // Hvor på skjermen (px) vogntoget slutter i kalkulator-modus, så panelet kan starte under
    kalkulatorBunn() { return kalkBunnPx; },
    // Status per del ({ motor, bremser, dekk }: ok|sjekk|kritisk|tom), styrer fargen ved innzoom
    settDelStatus(status) {
      for (const del of Object.keys(STATUSFARGER)) {
        const f = FARGE_FOR_STATUS[status?.[del]];
        if (f) { STATUSFARGER[del].copy(f); delStatus[del] = status[del]; }
      }
    },
    // Lakkfarge på bilen (0xRRGGBB), null = standardfargen
    settLakk(farge) { lakkMal.setHex(farge ?? LAKK); },
    // Bilmodell ('discovery3', 'discovery4' …), null = standardbilen. Fargen og statusen beholdes.
    settModell(navn) {
      const modell = MODELLER[navn] ?? MODELLER.standard;
      if (modell === bil.modell) return;
      const farge = bil.lakk.color.clone();
      bil.fjern();
      bil = lagBil(modell);
      bil.lakk.color.copy(farge);
      scene.add(bil.gruppe);
      tilpassStorrelse();
    },
    // Sidevisningene: hvor veien slutter, hvor den hvite kantlinjen og midtstripen ligger (px, uten forskyvning)
    sideLinjer() { const k = sidekamera[sideValg]; return { bunn: k.bunnPx, kantlinje: k.kantlinjePx, midtlinje: k.midtlinjePx }; },
    // Flytter bildet opp (px) når man blar ned i et panel. stille = alt stopper opp (som et stillbilde).
    settSideForskyvning(px, stille = false) { sideForskyv = Math.max(0, px); stillbilde = stille; },
    settTema(t) { temaMal = t === 'light' ? 'light' : 'dark'; },
    // Skjermposisjon (px) for en bildel, brukt til hotspot og styrelinje
    skjermpunkt(navn) {
      const objekt = navn === 'tilhenger' ? tilhenger.skiltpunkt : bil.knappepunkter[navn] ?? bil.hotspots[navn];
      if (!objekt) return null;
      objekt.getWorldPosition(tmp);
      tmp.project(kamera);
      if (tmp.z > 1) return null;
      return {
        x: (tmp.x * 0.5 + 0.5) * window.innerWidth,
        y: (-tmp.y * 0.5 + 0.5) * window.innerHeight,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Vei, gress og ting som passerer
// ---------------------------------------------------------------------------
function lagOmgivelser(scene) {
  const LENGDE = 140;
  // Bilen kjører i høyre felt, så midtstripen ligger på bilens venstre side (+x)
  const MIDTSTRIPE_X = 1.9;
  const gressMat = new THREE.MeshStandardMaterial({ color: TEMA.dark.gress, roughness: 1 });
  const gress = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gressMat);
  gress.rotation.x = -Math.PI / 2;
  gress.position.y = -0.01;
  gress.receiveShadow = true;
  scene.add(gress);

  const veiMat = new THREE.MeshStandardMaterial({ color: TEMA.dark.vei, roughness: 0.92 });
  const vei = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 200), veiMat);
  vei.rotation.x = -Math.PI / 2;
  vei.position.x = MIDTSTRIPE_X;
  vei.receiveShadow = true;
  scene.add(vei);

  const linjeMat = new THREE.MeshBasicMaterial({ color: 0xd9dadc });
  for (const x of [MIDTSTRIPE_X - 3.6, MIDTSTRIPE_X + 3.6]) {
    const kant = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 200), linjeMat);
    kant.rotation.x = -Math.PI / 2;
    kant.position.set(x, 0.002, 0);
    scene.add(kant);
  }

  // Ting som beveger seg forbi: midtstriper, brøytestikker og noen få trær
  const flyttbare = [];
  const stripeGeo = new THREE.PlaneGeometry(0.12, 3);
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 9) {
    const s = new THREE.Mesh(stripeGeo, linjeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(MIDTSTRIPE_X, 0.003, z);
    flyttbare.push({ obj: s, start: z });
    scene.add(s);
  }

  const stikkeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const refleksMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0x552200, roughness: 0.4 });
  // Bare på høyre side av kjøreretningen (-x). På siden nærmest kameraet ble de forstyrrende.
  for (let z = -LENGDE / 2; z < LENGDE / 2; z += 25) {
    for (const x of [MIDTSTRIPE_X - 4.4]) {
      const g = new THREE.Group();
      const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6), stikkeMat);
      stang.position.y = 0.9;
      const refleks = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 6), refleksMat);
      refleks.position.y = 1.6;
      g.add(stang, refleks);
      g.position.set(x, 0, z + (x > MIDTSTRIPE_X ? 12 : 0));
      flyttbare.push({ obj: g, start: g.position.z });
      scene.add(g);
    }
  }

  const stammeMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 1 });
  const kroneMat = new THREE.MeshStandardMaterial({ color: 0x2f4a33, roughness: 1, flatShading: true });
  const tilfeldig = lagTilfeldig(7);
  for (let i = 0; i < 14; i++) {
    const tre = new THREE.Group();
    const h = 2.5 + tilfeldig() * 2.5;
    const stamme = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h * 0.35, 6), stammeMat);
    stamme.position.y = h * 0.175;
    const krone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.28, h * 0.8, 7), kroneMat);
    krone.position.y = h * 0.35 + h * 0.4;
    krone.castShadow = true;
    tre.add(stamme, krone);
    // Trærne på venstre side (+x) står langt ute, så de ikke sperrer utsikten
    // når kameraet står på siden i kalkulator-modus
    const side = i % 2 ? 1 : -1;
    const avstand = side > 0 ? 26 + tilfeldig() * 14 : 8 + tilfeldig() * 14;
    tre.position.set(MIDTSTRIPE_X + side * avstand, 0, -LENGDE / 2 + (i / 14) * LENGDE + tilfeldig() * 6);
    flyttbare.push({ obj: tre, start: tre.position.z });
    scene.add(tre);
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

function lagTilfeldig(frø) {
  let s = frø;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

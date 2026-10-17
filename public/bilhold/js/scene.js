// 3D-scenen: en stilisert sølvgrå Land Rover (Discovery 2-aktig) som kjører på en vei.
// Alt er bygget av enkle former i Three.js, så det trengs ingen modellfil.
// Bilen står i origo og peker mot +z. Bilens venstre side er +x.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { lagTilhenger, lagSjiraff, sjiraffKamera, veiHump } from './tilhenger.js';
import { startKamera } from '/spill/js/kamera.js';

const FARTKMT = 60;
const FART = FARTKMT / 3.6;              // meter per sekund
const HJULRADIUS = 0.39;
// Lakk: varm, litt gulaktig grå, som mange Discovery 2. Hengeren bruker samme farge.
const LAKK = 0xbdb9ac;
const FORAKSEL_Z = 1.32;
const BAKAKSEL_Z = -1.22;
const SPORVIDDE = 0.82;                  // avstand fra midten til hjulsenter

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
// 0 = hero, 1 = motorrom, 2 = bremser, 3 = dekk
function lagKamerapunkter(aspekt) {
  // Smal mobilskjerm trenger større avstand for å få med hele bilen og hele tilhengeren
  const k = THREE.MathUtils.clamp(0.75 / aspekt, 1, 1.9);
  const smal = THREE.MathUtils.clamp((0.75 - aspekt) / 0.3, 0, 1);  // 0 på PC, 1 på mobil
  return [
    { pos: new THREE.Vector3(7.4 * k + 3.2 * smal, 3.4 + 0.7 * k, 5.2 * k + 3.6 * smal), mal: new THREE.Vector3(0, 0.9 + 0.3 * k, -2.0 + 1.2 * smal) },
    { pos: new THREE.Vector3(1.5, 3.6, 4.6), mal: new THREE.Vector3(0, 0.75, 1.35) },
    { pos: new THREE.Vector3(3.3, 0.95, 2.6), mal: new THREE.Vector3(SPORVIDDE, 0.2, FORAKSEL_Z) },
    { pos: new THREE.Vector3(1.75, 0.55, 2.85), mal: new THREE.Vector3(SPORVIDDE, 0.05, FORAKSEL_Z + 0.1) },
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
  const bil = lagBil();
  scene.add(bil.gruppe);
  const tilhenger = lagTilhenger();
  scene.add(tilhenger.gruppe);

  // ---------- Tilstand som styres fra scrolling ----------
  let kamerapunkter = lagKamerapunkter(1);
  let fremdrift = 0;                 // 0..3, scroll-posisjon målt i seksjoner
  let temaMal = 'dark';
  const kamPos = kamerapunkter[0].pos.clone();
  const kamMal = kamerapunkter[0].mal.clone();
  const onsketPos = new THREE.Vector3();
  const onsketMal = new THREE.Vector3();
  const aktivitet = { motor: 0, bremser: 0, dekk: 0 };
  let modus = 'scroll';              // 'scroll', 'kalkulator', 'bil', 'sjiraff' (på vei til innlogging) eller 'spill'
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
  let spillT = 0;                    // 0..1, hvor langt kameraet har kommet til spillets kameravinkel
  const spillPos = new THREE.Vector3();
  const spillMal = new THREE.Vector3();
  let vedSpill = null;               // kalles med et stillbilde når kameraet står der spillet starter
  const kuleFra = new THREE.Spherical();
  const kuleTil = new THREE.Spherical();
  const spillTmp = new THREE.Vector3();
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
    kamerapunkter = lagKamerapunkter(aspekt);
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
    // Spillet: kameraet legger seg skrått bak og over bilen, der spillet (/spill/) starter
    spillT = THREE.MathUtils.clamp(spillT + (modus === 'spill' ? dt / 1.6 : -dt / 0.8), 0, 1);
    if (spillT > 0) {
      // Bilen står i origo og «kjører» mot +z med veiens fart (verden flytter seg, ikke bilen)
      const s = startKamera(window.innerWidth / window.innerHeight, 0, 0, 0, FART);
      spillPos.set(s.pos.x, s.pos.y, s.pos.z);
      spillMal.set(s.mal.x, s.mal.y, s.mal.z);
      // Kameraet går i en bue rundt bilen (ikke rett linje, som ville gått tett forbi den)
      const sp = kurve(spillT);
      kuleFra.setFromVector3(spillTmp.subVectors(onsketPos, onsketMal));
      kuleTil.setFromVector3(spillTmp.subVectors(spillPos, spillMal));
      let dreiing = kuleTil.theta - kuleFra.theta;
      if (dreiing > Math.PI) dreiing -= Math.PI * 2;
      if (dreiing < -Math.PI) dreiing += Math.PI * 2;
      kuleFra.set(
        THREE.MathUtils.lerp(kuleFra.radius, kuleTil.radius, sp),
        THREE.MathUtils.lerp(kuleFra.phi, kuleTil.phi, sp),
        kuleFra.theta + dreiing * sp,
      );
      onsketMal.lerp(spillMal, sp);
      onsketPos.setFromSpherical(kuleFra).add(onsketMal);
    }
    if ((kalkBlend > 0 && kalkBlend < 1) || sjiraffT > 0 || spillT > 0 || (side && kalkBlend === 1)) {
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
    // På vei til spillet hektes hengeren av: den ruller ut mot veikanten og blir liggende igjen,
    // så kameraet får fri sikt bak bilen. Går man tilbake, kommer den på plass igjen.
    const avhekt = spillT * spillT;
    tilhenger.gruppe.position.set(-3.2 * THREE.MathUtils.smoothstep(spillT, 0, 0.6), 0, -32 * avhekt);
    tilhenger.gruppe.rotation.y = -0.25 * Math.sin(Math.PI * Math.min(1, spillT / 0.6));
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
    bil.panser.rotation.x = -1.05 * THREE.MathUtils.smoothstep(aktivitet.motor, 0.05, 0.9);

    // Fargetema glir over
    const tema = TEMA[temaMal];
    scene.background.lerp(tema.bg, demp * 0.6);
    scene.fog.color.copy(scene.background);
    omgivelser.gressMat.color.lerp(tema.gress, demp * 0.6);
    omgivelser.veiMat.color.lerp(tema.vei, demp * 0.6);

    maalYtelse(dt);
    hoppOver = lett && !hoppOver;          // lett versjon: tegn annenhver frame (ca. 30 i sekundet)
    if (!hoppOver) renderer.render(scene, kamera);
    // Framme ved spillets kameravinkel: ta et stillbilde (samme frame, før lerretet tømmes)
    if (!hoppOver && spillT === 1 && vedSpill) {
      let bilde = null;
      try { bilde = canvas.toDataURL('image/jpeg', 0.82); } catch { /* uten bilde blir overgangen litt mindre sømløs */ }
      vedSpill({
        bilde,
        tid: bevegelsestid,                                // så sjiraffen fortsetter der den var
        stripeFase: ((((-70 - veistrekning) % 9) + 9) % 9), // så midtstripene ligger likt
        lakk: lakkMal.getHex(),
      });
      vedSpill = null;
    }
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
      modus = ['kalkulator', 'bil', 'sjiraff', 'spill'].includes(m) ? m : 'scroll';
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
    // Flyr kameraet til der spillet starter og svarer med et stillbilde og litt tilstand
    tilSpill() {
      modus = 'spill';
      return new Promise((ferdig) => { vedSpill = ferdig; });
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

// ---------------------------------------------------------------------------
// Land Rover – forenklet realisme med skarpe, enkle linjer
// Brukes også i spillet (/spill), så man kjører den samme bilen der.
// ---------------------------------------------------------------------------
export function lagBil() {
  const gruppe = new THREE.Group();
  const karosseri = new THREE.Group();
  gruppe.add(karosseri);

  const solv = new THREE.MeshStandardMaterial({ color: LAKK, metalness: 0.75, roughness: 0.3 });
  const plast = new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.1, roughness: 0.75 });
  // Glasset kan bli gjennomsiktig når bilen «skannes», så man ser sjåføren
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f14, metalness: 0.9, roughness: 0.08, transparent: true, opacity: 1 });
  const krom = new THREE.MeshStandardMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.15 });
  const lykt = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xfff4dc, emissiveIntensity: 0.6, roughness: 0.2 });
  const baklykt = new THREE.MeshStandardMaterial({ color: 0x7a0b0b, emissive: 0x5a0000, roughness: 0.3 });
  const motorrom = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.85 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x5b5f66, metalness: 0.6, roughness: 0.45 });

  const boks = (b, h, l, mat, x, y, z, foreldre = karosseri) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, l), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    foreldre.add(m);
    return m;
  };

  const BREDDE = 1.86;
  const FRONT = 2.28;
  const BAK = -2.22;
  const BELTE = 1.12;      // høyden der panser og vinduer begynner

  // Nedre del av karosseriet. Midtpartiet er smalere enn sporvidden, og sidene har
  // hjulbuer, så hjulene får fri plass og aldri går gjennom karosseriet når bilen rister.
  const MIDT_B = 1.3;                     // innenfor hjulenes innerkant (0.685)
  const BUE_TOPP = 0.9;                   // dekket rekker opp til ca. 0.8
  const BUE_HALV = 0.52;                  // halv lengde på hjulbueåpningen
  boks(MIDT_B, BELTE - 0.48, 0.73 - BAK, solv, 0, (BELTE + 0.48) / 2, (0.73 + BAK) / 2);
  boks(MIDT_B, 0.32, FRONT - 0.73, solv, 0, 0.64, (FRONT + 0.73) / 2);   // under motorrommet
  const sideX = (BREDDE + MIDT_B) / 4;    // midt i sidepanelet
  const sideB = (BREDDE - MIDT_B) / 2;
  const sidepanel = (zFra, zTil, yFra, yTil) => {
    for (const s of [-1, 1]) boks(sideB, yTil - yFra, zTil - zFra, solv, s * sideX, (yFra + yTil) / 2, (zFra + zTil) / 2);
  };
  const fremreBue = [FORAKSEL_Z - BUE_HALV, FORAKSEL_Z + BUE_HALV];
  const bakreBue = [BAKAKSEL_Z - BUE_HALV, BAKAKSEL_Z + BUE_HALV];
  sidepanel(fremreBue[1], FRONT, 0.48, BELTE);
  sidepanel(fremreBue[0], fremreBue[1], BUE_TOPP, BELTE);
  sidepanel(bakreBue[1], fremreBue[0], 0.48, BELTE);
  sidepanel(bakreBue[0], bakreBue[1], BUE_TOPP, BELTE);
  sidepanel(BAK, bakreBue[0], 0.48, BELTE);
  // Mørk innerskjerm i hjulbuene
  for (const s of [-1, 1]) {
    for (const [a, b] of [fremreBue, bakreBue]) {
      // Litt luft til karosseriflatene, ellers flimrer de mot hverandre (z-fighting)
      boks(0.01, BUE_TOPP - 0.5, b - a - 0.01, plast, s * (MIDT_B / 2 + 0.012), (BUE_TOPP + 0.48) / 2, (a + b) / 2);
      boks(sideB - 0.01, 0.01, b - a - 0.01, plast, s * sideX, BUE_TOPP - 0.012, (a + b) / 2);
      // Mørke endevegger foran og bak i hjulbuen. Uten dem synes de lyse endeflatene på
      // sidepanelene, og de lå i samme plan som de svarte bueklossene, så de flimret mot hverandre.
      for (const z of [a + 0.012, b - 0.012]) {
        boks(sideB - 0.01, BUE_TOPP - 0.49, 0.012, plast, s * sideX, (BUE_TOPP + 0.48) / 2, z);
      }
    }
  }
  // Frontpanel med grill
  boks(BREDDE - 0.28, BELTE - 0.8, 0.06, solv, 0, (BELTE + 0.8) / 2, FRONT - 0.03);
  boks(0.9, 0.2, 0.04, plast, 0, 0.94, FRONT + 0.01);
  for (let i = 0; i < 4; i++) boks(0.86, 0.015, 0.02, krom, 0, 0.87 + i * 0.045, FRONT + 0.035);
  // Lykter
  for (const s of [-1, 1]) {
    // Discovery 2: to runde lamper i hver lyktboks
    boks(0.34, 0.2, 0.04, plast, s * 0.7, 0.94, FRONT + 0.01);
    for (const dx of [-0.08, 0.08]) {
      const lampe = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 24), lykt);
      lampe.rotation.x = Math.PI / 2;
      lampe.position.set(s * 0.7 + dx, 0.94, FRONT + 0.035);
      karosseri.add(lampe);
    }
    boks(0.09, 0.06, 0.03, new THREE.MeshStandardMaterial({ color: 0xff9a1f, emissive: 0x663300 }), s * 0.7, 0.8, FRONT + 0.01);
    // Baklys høyt oppe på bakhjørnene, og små lys i støtfangeren
    boks(0.1, 0.5, 0.05, baklykt, s * 0.81, 1.5, BAK - 0.01);
    boks(0.16, 0.06, 0.03, baklykt, s * 0.75, 0.62, BAK - 0.19);
  }
  // Brannvegg og selve motorrommet
  boks(BREDDE - 0.28, 0.32, 0.05, motorrom, 0, 0.96, 0.75);
  boks(BREDDE - 0.3, 0.02, FRONT - 0.82, motorrom, 0, 0.81, (FRONT + 0.77) / 2);

  // Motor med oljelokk og oljefilter (blir grønne i motorrom-seksjonen)
  const motorGruppe = new THREE.Group();
  karosseri.add(motorGruppe);
  boks(0.62, 0.24, 0.72, motorMat, 0, 0.94, 1.45, motorGruppe);                       // motorblokk
  boks(0.66, 0.06, 0.66, motorMat, 0, 1.08, 1.45, motorGruppe);                       // ventildeksel
  boks(0.32, 0.14, 0.4, plast, -0.55, 0.98, 1.65, motorGruppe);                       // luftfilterboks
  const oljeMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.3, roughness: 0.5 });
  const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), oljeMat);
  oljelokk.position.set(0.15, 1.13, 1.32);
  karosseri.add(oljelokk);
  const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20), oljeMat);
  oljefilter.rotation.z = Math.PI / 2;
  oljefilter.position.set(0.42, 0.95, 1.55);
  karosseri.add(oljefilter);

  // Panser (hengslet ved frontruta så det kan åpnes)
  const panser = new THREE.Group();
  panser.position.set(0, BELTE + 0.01, 0.76);
  karosseri.add(panser);
  boks(BREDDE - 0.02, 0.05, FRONT - 0.76, solv, 0, 0, (FRONT - 0.76) / 2, panser);
  boks(BREDDE - 0.5, 0.012, FRONT - 0.9, solv, 0, 0.03, (FRONT - 0.76) / 2, panser); // pregning

  // Kupé med "stepped roof" som på Discovery. Sidene er hele plater formet etter
  // frontruta, og vinduer og stolper ligger utenpå, så det ikke blir glipper.
  const KUPE_B = 1.76;
  const TAK_UNDER = 1.89;
  const RUTE_FOT = { z: 0.6, y: BELTE };   // frontruta møter panseret
  const RUTE_TOPP = { z: 0.24, y: 1.92 };  // frontruta møter taket
  const TRINN_Z = -1.25;                   // der det hevede taket bak begynner
  const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);

  boks(KUPE_B, 0.04, 2.75, solv, 0, BELTE + 0.02, -0.8);                              // overgang
  boks(KUPE_B, 0.08, RUTE_TOPP.z + 0.02 - TRINN_Z, solv, 0, TAK_UNDER + 0.04, (RUTE_TOPP.z + 0.02 + TRINN_Z) / 2); // tak foran
  boks(KUPE_B, 0.16, TRINN_Z - BAK, solv, 0, TAK_UNDER + 0.08, (TRINN_Z + BAK) / 2);  // hevet tak bak
  // Takrails med føtter ned i taket (foran, ved trinnet og bak)
  const RAIL_Y = 2.08;
  const TAK_FORAN = TAK_UNDER + 0.08;      // oversiden av taket foran
  const TAK_BAK = TAK_UNDER + 0.16;        // oversiden av det hevede taket
  for (const s of [-1, 1]) {
    boks(0.04, 0.04, RUTE_TOPP.z - 0.05 - BAK, plast, s * 0.72, RAIL_Y, (RUTE_TOPP.z - 0.05 + BAK) / 2);
    for (const [z, tak] of [[RUTE_TOPP.z - 0.12, TAK_FORAN], [TRINN_Z + 0.12, TAK_FORAN], [BAK + 0.1, TAK_BAK]]) {
      boks(0.05, RAIL_Y - tak, 0.1, plast, s * 0.72, (RAIL_Y + tak) / 2, z);
    }
  }

  // Plate i sideprofil (z, y), lagt i planet x = posX
  const sideplate = (punkter, tykkelse, mat, posX, hull = []) => {
    const form = new THREE.Shape(punkter.map(([z, y]) => new THREE.Vector2(z, y)));
    for (const h of hull) form.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
    const geo = new THREE.ExtrudeGeometry(form, { depth: tykkelse, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = -Math.PI / 2;            // formens x blir bilens z
    m.position.x = posX + tykkelse / 2;
    m.castShadow = true;
    karosseri.add(m);
    return m;
  };
  const VINDU_FOT = 1.22;
  const VINDU_TOPP = 1.84;
  for (const s of [-1, 1]) {
    const ytre = s * (KUPE_B / 2 - 0.01);
    // Vindusåpningene (z, y): fordør (følger frontruta), bakdør og bakre sidevindu
    const vinduer = [
      [[0.0, VINDU_FOT], [aStolpeZ(VINDU_FOT) - 0.06, VINDU_FOT], [aStolpeZ(VINDU_TOPP) - 0.06, VINDU_TOPP], [0.0, VINDU_TOPP]],
      [[-1.0, VINDU_FOT], [-0.1, VINDU_FOT], [-0.1, VINDU_TOPP], [-1.0, VINDU_TOPP]],
      [[BAK + 0.12, VINDU_FOT], [-1.1, VINDU_FOT], [-1.1, VINDU_TOPP], [BAK + 0.12, VINDU_TOPP]],
    ];
    // Sidevegg fra beltelinjen helt opp til taket, med hull der vinduene er (så man ser inn når glasset blir klart)
    sideplate([[BAK, BELTE], [RUTE_FOT.z, BELTE], [RUTE_TOPP.z, TAK_UNDER + 0.01], [BAK, TAK_UNDER + 0.01]], 0.03, solv, ytre, vinduer);
    // Hevet tak bak: veggen fortsetter opp
    sideplate([[BAK, TAK_UNDER], [TRINN_Z, TAK_UNDER], [TRINN_Z, TAK_UNDER + 0.15], [BAK, TAK_UNDER + 0.15]], 0.03, solv, ytre);
    const glassX = ytre + s * 0.02;
    for (const v of vinduer) sideplate(v, 0.01, glass, glassX);
    // Alpine-vinduer i det hevede taket
    sideplate([[BAK + 0.2, TAK_UNDER + 0.03], [TRINN_Z - 0.12, TAK_UNDER + 0.03], [TRINN_Z - 0.12, TAK_UNDER + 0.12], [BAK + 0.2, TAK_UNDER + 0.12]], 0.01, glass, glassX);
    // Speil
    boks(0.2, 0.14, 0.08, plast, s * 1.02, 1.3, 0.45);
  }
  // Frontrute (skrå) med A-stolper
  const ruteVinkel = Math.atan2(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
  const ruteLengde = Math.hypot(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
  const ruteMidt = [(RUTE_FOT.y + RUTE_TOPP.y) / 2, (RUTE_FOT.z + RUTE_TOPP.z) / 2];
  const rute = boks(KUPE_B - 0.06, ruteLengde, 0.02, glass, 0, ruteMidt[0], ruteMidt[1]);
  rute.rotation.x = -ruteVinkel;
  for (const s of [-1, 1]) {
    const a = boks(0.06, ruteLengde + 0.04, 0.07, solv, s * (KUPE_B / 2 - 0.02), ruteMidt[0], ruteMidt[1]);
    a.rotation.x = -ruteVinkel;
  }
  // Bakrute og reservehjul på bakdøra
  boks(KUPE_B - 0.2, 0.58, 0.02, glass, 0, 1.55, BAK - 0.005);
  boks(KUPE_B, 0.76, 0.04, solv, 0, 0.8, BAK - 0.01);

  // Støtfangere og hjulbuer i sort plast
  boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, FRONT + 0.08);
  boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, BAK - 0.08);
  for (const s of [-1, 1]) {
    boks(0.04, 0.08, fremreBue[0] - bakreBue[1], plast, s * (BREDDE / 2 + 0.01), 0.52, (fremreBue[0] + bakreBue[1]) / 2); // sidelist
    boks(0.03, 0.06, fremreBue[0] - bakreBue[1] - 0.1, plast, s * (BREDDE / 2 + 0.01), 0.84, (fremreBue[0] + bakreBue[1]) / 2); // støtlist på dørene
    for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
      boks(0.1, 0.07, BUE_HALV * 2 + 0.14, plast, s * (BREDDE / 2 + 0.03), BUE_TOPP + 0.035, z);
      // Loddrette bueklosser: litt inn i buen, så ingen flate ligger i samme plan som sidepanelet
      for (const zz of [-1, 1]) boks(0.1, BUE_TOPP - 0.6, 0.07, plast, s * (BREDDE / 2 + 0.03), (BUE_TOPP + 0.6) / 2, z + zz * (BUE_HALV + 0.022));
    }
  }

  // Hjul
  const dekkMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const felgMat = new THREE.MeshStandardMaterial({ color: 0xa9adb3, metalness: 0.9, roughness: 0.3 });
  const skiveMat = new THREE.MeshStandardMaterial({ color: 0x6d7076, metalness: 0.9, roughness: 0.35 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.4, roughness: 0.5 });
  const klossMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.8 });

  const hjul = [];
  const hjulStille = [];             // bremsene, som ikke snurrer (men svinger med i spillet)
  const hotspots = {};
  for (const s of [-1, 1]) {
    for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
      const { spinn, stille, mønsterpunkt } = lagHjul({ dekkMat, felgMat, skiveMat, caliperMat, klossMat, plast }, s);
      spinn.position.set(s * SPORVIDDE, HJULRADIUS, z);
      stille.position.copy(spinn.position);
      gruppe.add(spinn, stille);
      hjul.push(spinn);
      hjulStille.push(stille);
      if (s === 1 && z === FORAKSEL_Z) {
        hotspots.bremser = stille.getObjectByName('bremsepunkt');
        hotspots.dekk = mønsterpunkt;
      }
    }
  }
  // Reservehjul på bakdøra
  const reserve = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 28), dekkMat);
  reserve.rotation.x = Math.PI / 2;
  reserve.position.set(0, 1.08, BAK - 0.16);
  reserve.castShadow = true;
  karosseri.add(reserve);
  const deksel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 28), solv);
  deksel.rotation.x = Math.PI / 2;
  deksel.position.set(0, 1.08, BAK - 0.29);
  karosseri.add(deksel);

  hotspots.motor = oljelokk;

  // Statusmarkering: delene er nøytrale til kameraet zoomer inn
  const markerbare = {
    motor: [oljeMat],
    bremser: [klossMat, caliperMat],   // hele bremsen: klosser og kaliper
    dekk: [dekkMat],
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
  const interior = new THREE.Group();
  interior.visible = false;
  karosseri.add(interior);
  const skinn = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.8 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.7 });
  const iboks = (b, h, l, mat, x, y, z, rx = 0) => {
    const m = boks(b, h, l, mat, x, y, z, interior);
    m.rotation.x = rx;
    m.castShadow = false;
    return m;
  };
  iboks(KUPE_B - 0.16, 0.2, 0.28, dashMat, 0, 1.08, 0.34);                  // dashbord (holder seg bak frontruta)
  for (const sx of [-1, 1]) {
    iboks(0.5, 0.14, 0.5, skinn, sx * 0.42, 0.78, -0.14);                  // forsete
    iboks(0.48, 0.66, 0.12, skinn, sx * 0.42, 1.12, -0.42, -0.12);          // ryggstø
    iboks(0.26, 0.14, 0.1, skinn, sx * 0.42, 1.52, -0.47, -0.12);          // nakkestøtte
  }
  iboks(1.4, 0.14, 0.5, skinn, 0, 0.8, -1.3);                              // baksete
  iboks(1.4, 0.6, 0.12, skinn, 0, 1.13, -1.58, -0.1);
  // Ratt på venstre side (førersiden i Norge; bilens venstre er +x)
  const ratt = new THREE.Group();
  ratt.position.set(0.42, 1.3, 0.2);
  ratt.rotation.x = -1.05;
  interior.add(ratt);
  const rattring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 28), dashMat);
  rattring.rotation.x = Math.PI / 2;
  ratt.add(rattring);
  for (let i = 0; i < 3; i++) {
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.03), dashMat);
    eike.position.y = 0;
    eike.rotation.y = (i / 3) * Math.PI * 2;
    eike.position.x = Math.cos(eike.rotation.y) * 0.08;
    eike.position.z = -Math.sin(eike.rotation.y) * 0.08;
    ratt.add(eike);
  }
  const ror = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), dashMat);
  ror.position.set(0, -0.15, 0);
  ratt.add(ror);
  // Sjåføren: en mindre sjiraff i førersetet
  const sjafor = lagSjiraff();
  sjafor.gruppe.scale.setScalar(0.48);
  sjafor.gruppe.position.set(0.42, 0.47, -0.14);
  interior.add(sjafor.gruppe);

  // Skanning: en lysende flate som glir over bilen og en tynn ramme rundt
  const skannMat = new THREE.MeshBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const skannFlate = new THREE.Mesh(new THREE.BoxGeometry(BREDDE + 0.12, 2.3, 0.04), skannMat);
  skannFlate.position.y = 1.1;
  skannFlate.visible = false;
  gruppe.add(skannFlate);
  const skannRamme = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BREDDE + 0.4, 2.45, FRONT - BAK + 0.5)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }),
  );
  skannRamme.position.set(0, 1.12, (FRONT + BAK) / 2);
  skannRamme.renderOrder = 10;
  gruppe.add(skannRamme);

  // Punkter for knappene: fem over bilen (i to høyder) og én nederst på siden.
  // main.js dytter knappene fra hverandre hvis de likevel havner oppå hverandre.
  const knappepunkter = {};
  for (const [navn, x, y, z] of [
    ['bil-1', 0.3, 2.5, 1.7], ['bil-2', 0.3, 3.3, 0.6], ['bil-3', 0.3, 2.5, -0.5],
    ['bil-4', 0.3, 3.3, -1.6], ['bil-5', 0.3, 2.5, -2.6],
    ['bil-apne', BREDDE / 2, 0.42, -0.05],
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
    skannFlate.position.z = THREE.MathUtils.lerp(FRONT + 0.15, BAK - 0.15, t);
    skannRamme.material.opacity = styrke * (0.55 + 0.25 * Math.sin(tid * 3));
  }

  return { gruppe, karosseri, panser, hjul, hjulStille, hotspots, marker, skann, knappepunkter, lakk: solv };
}

function lagHjul(mat, side) {
  const spinn = new THREE.Group();   // roterer
  const stille = new THREE.Group();  // caliper står stille
  const B = 0.27;

  // Dekk
  const dekk = new THREE.Mesh(new THREE.CylinderGeometry(HJULRADIUS - 0.02, HJULRADIUS - 0.02, B, 36, 1, true), mat.dekkMat);
  dekk.rotation.z = Math.PI / 2;
  dekk.castShadow = true;
  spinn.add(dekk);
  for (const x of [-1, 1]) {
    const vegg = new THREE.Mesh(new THREE.RingGeometry(0.25, HJULRADIUS - 0.02, 36), mat.dekkMat);
    vegg.rotation.y = x * Math.PI / 2;
    vegg.position.x = x * B / 2;
    spinn.add(vegg);
  }
  // Dekkmønster: klosser rundt hele dekket i to forskjøvne rader
  const antall = 30;
  const klossGeo = new THREE.BoxGeometry(0.1, 0.035, 0.055);
  for (let i = 0; i < antall; i++) {
    for (const rad of [-1, 1]) {
      const a = (i + (rad > 0 ? 0.5 : 0)) / antall * Math.PI * 2;
      const k = new THREE.Mesh(klossGeo, mat.dekkMat);
      k.position.set(rad * 0.068, Math.cos(a) * (HJULRADIUS - 0.01), Math.sin(a) * (HJULRADIUS - 0.01));
      k.rotation.x = a;
      spinn.add(k);
    }
  }

  // Felg med eiker, så bremseskiven synes
  const ytterX = side * (B / 2 - 0.03);
  const kant = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 8, 36), mat.felgMat);
  kant.rotation.y = Math.PI / 2;
  kant.position.x = ytterX;
  spinn.add(kant);
  const nav = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), mat.felgMat);
  nav.rotation.z = Math.PI / 2;
  nav.position.x = ytterX;
  spinn.add(nav);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const eike = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.065), mat.felgMat);
    eike.position.set(ytterX, Math.cos(a) * 0.14, Math.sin(a) * 0.14);
    eike.rotation.x = a;
    spinn.add(eike);
  }
  // Bremser som på en Discovery 2 (ca. 1999–2004): ventilert skive, fast firestempels kaliper
  // (en halvdel på hver side av skiva) og to klosser med stålbakplate, holdt av to pinner og en
  // fjærklemme. Klossene stikker opp over kaliperen, så man ser dem gjennom felgen.
  const skiveH = 0.013;                    // halv tykkelse på skiva
  for (const x of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.009, 36), mat.skiveMat);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x * (skiveH - 0.0045);
    spinn.add(plate);
  }
  const kjoling = new THREE.Mesh(new THREE.CylinderGeometry(0.186, 0.186, skiveH * 2 - 0.006, 36, 1, true), mat.plast);
  kjoling.rotation.z = Math.PI / 2;
  spinn.add(kjoling);                      // mørk spalte mellom platene = ventilert skive
  const hatt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 24), mat.skiveMat);
  hatt.rotation.z = Math.PI / 2;
  hatt.position.x = side * 0.035;
  spinn.add(hatt);

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
    stille.add(m);
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
  // Den ytre halvdelen er lav, så klossene synes over den
  for (const x of [-1, 1]) bue(0.105, x === side ? 0.15 : 0.168, 0.5, halv, mat.caliperMat, x * kx);
  // Punktet hotspoten peker på: midt på bremsen, på utsiden
  const bremsepunkt = new THREE.Object3D();
  bremsepunkt.name = 'bremsepunkt';
  bremsepunkt.position.set(side * (kx + halv / 2), Math.cos(MIDT) * 0.16, Math.sin(MIDT) * 0.16);
  stille.add(bremsepunkt);
  for (const a of [-1, 1]) bue(0.196, 0.222, 0.075, kx * 2 + halv, mat.caliperMat, 0, null, MIDT + a * 0.43);
  // Holdepinner og fjærklemme over klossene
  for (const a of [MIDT - 0.17, MIDT + 0.17]) {
    const pinne = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, kx * 2 + halv + 0.02, 8), mat.felgMat);
    pinne.rotation.z = Math.PI / 2;
    pinne.position.set(0, Math.cos(a) * 0.203, Math.sin(a) * 0.203);
    stille.add(pinne);
  }
  const klemme = new THREE.Mesh(new THREE.BoxGeometry(kx * 2 - 0.01, 0.004, 0.07), mat.felgMat);
  klemme.position.set(0, Math.cos(MIDT) * 0.207, Math.sin(MIDT) * 0.207);
  klemme.rotation.x = MIDT;
  stille.add(klemme);
  // Luftenippel på innsiden
  const nippel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.025, 8), mat.felgMat);
  nippel.position.set(-side * (kx + halv / 2 + 0.008), Math.cos(MIDT + 0.3) * 0.16, Math.sin(MIDT + 0.3) * 0.16);
  nippel.rotation.z = Math.PI / 2;
  stille.add(nippel);

  // Punktet på dekkets mønster som hotspoten peker på (fremre del av dekket)
  const mønsterpunkt = new THREE.Object3D();
  mønsterpunkt.position.set(side * 0.06, 0.05, HJULRADIUS);
  stille.add(mønsterpunkt);

  return { spinn, stille, mønsterpunkt };
}

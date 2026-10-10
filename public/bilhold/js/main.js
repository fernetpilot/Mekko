// Kobler scrolling på siden til 3D-scenen: kamera, fargetema, header, hotspot og styrelinjer.

const rot = document.documentElement;
const seksjoner = [...document.querySelectorAll('.seksjon')];
const header = document.getElementById('topp');
const hotspot = document.getElementById('hotspot');
const styrelinje = document.getElementById('styrelinje');
const temaMeta = document.querySelector('meta[name="theme-color"]');

let scene = null;
try {
  const { lagScene } = await import('./scene.js');
  scene = lagScene(document.getElementById('scene'));
} catch (feil) {
  // Ingen WebGL (eller CDN nede): siden fungerer fortsatt, bare uten 3D
  console.warn('3D-scenen kunne ikke startes:', feil);
  rot.classList.add('ingen-webgl');
}

// ---------- Scroll ----------
let forrigeY = window.scrollY;
let aktivIndeks = -1;

function vedScroll() {
  const y = window.scrollY;
  const fremdrift = y / window.innerHeight;
  scene?.settFremdrift(fremdrift);

  const indeks = Math.max(0, Math.min(seksjoner.length - 1, Math.round(fremdrift)));
  if (indeks !== aktivIndeks) {
    aktivIndeks = indeks;
    seksjoner.forEach((s, i) => s.classList.toggle('aktiv', i === indeks));
    const tema = seksjoner[indeks].dataset.theme;
    rot.dataset.theme = tema;
    scene?.settTema(tema);
    temaMeta.content = tema === 'light' ? '#eef0f2' : '#0a0b0d';
  }

  // Headeren følger med i toppen, glir bort når man går dypere og kommer tilbake ved scroll opp
  const nedover = y > forrigeY + 2;
  const oppover = y < forrigeY - 2;
  if (y < window.innerHeight * 0.5 || oppover) header.classList.remove('skjult');
  else if (nedover) header.classList.add('skjult');
  forrigeY = y;
}
window.addEventListener('scroll', vedScroll, { passive: true });
window.addEventListener('resize', vedScroll);
vedScroll();

// ---------- Hotspot og styrelinje følger bildelen hver frame ----------
function oppdaterStyrelinje() {
  const seksjon = seksjoner[aktivIndeks];
  const del = seksjon?.dataset.del;
  const kort = seksjon?.querySelector('.glasskort');
  const naer = Math.abs(window.scrollY / window.innerHeight - aktivIndeks) < 0.12;
  const punkt = scene && kort && naer ? scene.skjermpunkt(del) : null;

  if (punkt) {
    const r = kort.getBoundingClientRect();
    const knekk = r.top - 24;
    styrelinje.setAttribute('d',
      `M ${punkt.x} ${punkt.y} L ${punkt.x} ${knekk} L ${r.left + 28} ${knekk} L ${r.left + 28} ${r.top}`);
    styrelinje.style.opacity = 1;
    hotspot.style.transform = `translate(${punkt.x}px, ${punkt.y}px)`;
    hotspot.style.setProperty('--status', getComputedStyle(kort).getPropertyValue('--status'));
    hotspot.href = kort.getAttribute('href');
    hotspot.classList.add('synlig');
  } else {
    styrelinje.style.opacity = 0;
    hotspot.classList.remove('synlig');
  }
  requestAnimationFrame(oppdaterStyrelinje);
}
requestAnimationFrame(oppdaterStyrelinje);

// ---------- Sømløs overgang til underside ----------
// Nettlesere med "cross-document view transitions" tar seg av dette selv (se CSS).
// Andre får en kort zoom/fade før vi bytter side.
const harViewTransitions = 'onpagereveal' in window;
for (const lenke of document.querySelectorAll('a.glasskort, .hotspot')) {
  lenke.addEventListener('click', (e) => {
    if (harViewTransitions || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    document.body.classList.add('forlater');
    setTimeout(() => { window.location.href = lenke.href; }, 320);
  });
}
// Når man kommer tilbake med "tilbake"-knappen skal siden ikke stå uskarp
window.addEventListener('pageshow', () => document.body.classList.remove('forlater'));

// ---------- Tilhengeren: hover/berøring og kalkulator-modus ----------
const canvas = document.getElementById('scene');
const skilt = document.getElementById('tilhenger-skilt');
const panel = document.getElementById('kalk-panel');
let iKalkulator = false;
let skiltVises = false;

function kanPekePaTilhenger() {
  return scene && !iKalkulator && window.scrollY < window.innerHeight * 0.4;
}

function visSkilt(vis) {
  skiltVises = vis;
  skilt.classList.toggle('synlig', vis);
  canvas.classList.toggle('peker', vis);
  scene?.settHover(vis);
}

// Skiltet følger hengeren på skjermen
function plasserSkilt() {
  if (skiltVises) {
    const p = scene.skjermpunkt('tilhenger');
    if (p) {
      // Hold skiltet innenfor skjermen
      const halv = skilt.offsetWidth / 2 + 12;
      skilt.style.left = `${Math.min(Math.max(p.x, halv), window.innerWidth - halv)}px`;
      skilt.style.top = `${Math.max(p.y, skilt.offsetHeight + 80)}px`;
    }
  }
  requestAnimationFrame(plasserSkilt);
}
if (scene) requestAnimationFrame(plasserSkilt);

// Seksjonene slipper gjennom pekeren, så vi lytter på hele vinduet
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !kanPekePaTilhenger()) return;
  if (e.target.closest('a, button, .kalk-panel')) return;
  visSkilt(scene.treffTilhenger(e.clientX, e.clientY));
});

let trykkStart = null;
window.addEventListener('pointerdown', (e) => {
  trykkStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', (e) => {
  if (!trykkStart || !kanPekePaTilhenger() || e.target.closest('a, button, .kalk-panel')) return;
  const flyttet = Math.hypot(e.clientX - trykkStart.x, e.clientY - trykkStart.y) > 10;
  trykkStart = null;
  if (flyttet) return;                       // det var et sveip, ikke et trykk
  const traff = scene.treffTilhenger(e.clientX, e.clientY);
  if (!traff) {
    if (e.pointerType !== 'mouse') visSkilt(false);
    return;
  }
  // På mobil viser første trykk skiltet, andre trykk åpner. Med mus åpner klikket direkte.
  if (e.pointerType === 'mouse' || skiltVises) apneKalkulator();
  else visSkilt(true);
});
window.addEventListener('scroll', () => { if (skiltVises && window.scrollY > 40) visSkilt(false); }, { passive: true });
skilt.addEventListener('click', () => apneKalkulator());

function apneKalkulator({ historikk = true } = {}) {
  if (iKalkulator) return;
  iKalkulator = true;
  visSkilt(false);
  window.scrollTo({ top: 0, behavior: 'instant' });
  rot.dataset.theme = 'dark';
  scene?.settTema('dark');
  scene?.settModus('kalkulator');
  panel.style.setProperty('--kalk-topp', `${scene ? scene.kalkulatorBunn() : 72}px`);
  panel.hidden = false;
  // Én frame senere, så overgangen fra skjult til synlig blir animert
  requestAnimationFrame(() => rot.classList.add('kalkulator-modus'));
  header.classList.remove('skjult');
  if (historikk) history.pushState({ kalkulator: true }, '', '#kalkulator');
  setTimeout(() => document.getElementById('kalk-bil').focus({ preventScroll: true }), 1100);
}

function lukkKalkulator({ historikk = true } = {}) {
  if (!iKalkulator) return;
  iKalkulator = false;
  rot.classList.remove('kalkulator-modus');
  scene?.settModus('scroll');
  aktivIndeks = -1;
  vedScroll();
  setTimeout(() => { if (!iKalkulator) panel.hidden = true; }, 900);
  if (historikk && location.hash === '#kalkulator') history.back();
}

document.getElementById('kalk-lukk').addEventListener('click', () => lukkKalkulator());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') lukkKalkulator(); });
window.addEventListener('popstate', () => {
  if (location.hash === '#kalkulator') apneKalkulator({ historikk: false });
  else lukkKalkulator({ historikk: false });
});
window.addEventListener('resize', () => {
  if (iKalkulator && scene) panel.style.setProperty('--kalk-topp', `${scene.kalkulatorBunn()}px`);
});

// Knappen i headeren åpner kalkulatoren her på siden (lenken til /kalkulator virker uten JS)
const toppKnapp = document.querySelector('.topp-knapp[href="/kalkulator"]');
toppKnapp?.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (iKalkulator) lukkKalkulator(); else apneKalkulator();
});
if (location.hash === '#kalkulator') apneKalkulator({ historikk: false });

// ---------- Selve kalkulatoren: samme førerkortregler som /kalkulator ----------
const { sjekkForerkort } = await import('/js/beregning.js');
const feltBil = document.getElementById('kalk-bil');
const feltHenger = document.getElementById('kalk-henger');
const rader = [...document.querySelectorAll('#kalk-resultat [data-klasse]')];

function oppdaterKalkulator() {
  const bil = Number(feltBil.value);
  const henger = Number(feltHenger.value);
  const utfylt = feltBil.value !== '' && feltHenger.value !== '' && bil > 0 && henger > 0;
  for (const rad of rader) {
    const tekst = rad.querySelector('.kort-tekst');
    rad.classList.remove('status-tom', 'status-ok', 'status-kritisk');
    if (!utfylt) {
      rad.classList.add('status-tom');
      tekst.textContent = 'Fyll inn vektene over.';
      continue;
    }
    const svar = sjekkForerkort(bil, henger, rad.dataset.klasse);
    rad.classList.add(svar.ok ? 'status-ok' : 'status-kritisk');
    const dom = document.createElement('span');
    dom.className = 'kort-dom';
    dom.textContent = svar.ok ? 'Lov å kjøre. ' : 'Ikke lov. ';
    tekst.replaceChildren(dom, svar.forklaring);
  }
}
feltBil.addEventListener('input', oppdaterKalkulator);
feltHenger.addEventListener('input', oppdaterKalkulator);
document.getElementById('kalk-skjema').addEventListener('submit', (e) => e.preventDefault());

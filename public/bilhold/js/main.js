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
for (const lenke of document.querySelectorAll('.glasskort, .hotspot')) {
  lenke.addEventListener('click', (e) => {
    if (harViewTransitions || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    document.body.classList.add('forlater');
    setTimeout(() => { window.location.href = lenke.href; }, 320);
  });
}
// Når man kommer tilbake med "tilbake"-knappen skal siden ikke stå uskarp
window.addEventListener('pageshow', () => document.body.classList.remove('forlater'));

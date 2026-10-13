// Kobler scrolling på siden til 3D-scenen: kamera, fargetema, header, hotspot og styrelinjer.

const rot = document.documentElement;
const seksjoner = [...document.querySelectorAll('.seksjon')];
const header = document.getElementById('topp');
const hotspot = document.getElementById('hotspot');
const styrelinje = document.getElementById('styrelinje');
const temaMeta = document.querySelector('meta[name="theme-color"]');

let scene = null;
// Bilen får fargen den er registrert med, og delene lyser i samme farge som statusen på kortene
// (forside-kort.js). Lyttes på før scenen er lastet, så ingenting går tapt mens Three.js hentes.
const bilVisning = { lakk: null, status: null };
document.addEventListener('mekko:lakk', (e) => { bilVisning.lakk = e.detail.farge; scene?.settLakk(bilVisning.lakk); });
document.addEventListener('mekko:delstatus', (e) => { bilVisning.status = e.detail.status; scene?.settDelStatus(bilVisning.status); });
try {
  const { lagScene } = await import('./scene.js');
  scene = lagScene(document.getElementById('scene'));
  scene.settLakk(bilVisning.lakk);
  scene.settDelStatus(bilVisning.status);
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
    if (lenke.getAttribute('href').includes('#bilen-din')) return; // innlogget: åpner panelet (se under)
    e.preventDefault();
    document.body.classList.add('forlater');
    setTimeout(() => { window.location.href = lenke.href; }, 320);
  });
}
// Når man kommer tilbake med "tilbake"-knappen skal siden ikke stå uskarp
window.addEventListener('pageshow', () => {
  document.body.classList.remove('forlater');
  visBil(false);
  if (rot.classList.contains('til-innlogging')) {
    rot.classList.remove('til-innlogging');
    scene?.settModus(aapen ?? 'scroll');
    aktivIndeks = -1;
    vedScroll();
  }
});

// ---------- Innlogging: kameraet zoomer inn på sjiraffen før vi bytter side ----------
// Mens kameraet flyr, henter nettleseren innloggingssiden og skriptene den trenger,
// så den er klar i det vi bytter og ikke hakker.
let forhandslastet = false;
function forhandslastInnlogging(href) {
  if (forhandslastet) return;
  forhandslastet = true;
  const lenker = [
    ['prefetch', href],
    ['modulepreload', '/bilhold/js/sjiraff-bakgrunn.js'],
    ['modulepreload', '/js/min-side.js'],
    ['modulepreload', '/js/supabase.js'],
  ];
  for (const [rel, url] of lenker) {
    const l = document.createElement('link');
    l.rel = rel;
    l.href = url;
    document.head.append(l);
  }
}
// Start hentingen allerede når fingeren eller musa kommer på en innloggingsknapp
for (const hendelse of ['pointerenter', 'touchstart']) {
  document.addEventListener(hendelse, (e) => {
    if (e.target.closest?.('a[data-logg-inn]')) forhandslastInnlogging(e.target.closest('a[data-logg-inn]').href);
  }, { capture: true, passive: true });
}

// Innloggingssiden har det samme sjiraffhodet som bakgrunn, så overgangen blir sømløs.
const redusertBevegelse = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('click', (e) => {
  const lenke = e.target.closest('a[data-logg-inn]');
  if (!lenke || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (!scene || redusertBevegelse) return;          // vanlig lenke
  e.preventDefault();
  forhandslastInnlogging(lenke.href);
  visSkilt(false);
  rot.classList.add('til-innlogging');
  rot.dataset.theme = 'dark';
  scene.settTema('dark');
  // Bytt side når kameraet er framme (eller etter litt, hvis telefonen er treg)
  let gatt = false;
  const videre = () => {
    if (gatt || !rot.classList.contains('til-innlogging')) return;
    gatt = true;
    try {
      sessionStorage.setItem('sjiraff-tid', JSON.stringify({ tid: scene.sjiraffTid(), naa: Date.now() }));
    } catch { /* uten lagring starter sjiraffen bare fra begynnelsen */ }
    window.location.href = lenke.href;
  };
  scene.zoomTilSjiraff().then(videre);
  setTimeout(videre, 2500);
});

// ---------- Tilhengeren og bilen: peke/trykke og sidevisning ----------
// Hengeren åpner tilhengerkalkulatoren. Bilen (bare når man er innlogget) skannes når man
// peker på den: man ser sjiraffen som kjører, fem knapper svever over bilen, og et skilt
// nederst på bilen åpner «Bilen din».
const canvas = document.getElementById('scene');
const skilt = document.getElementById('tilhenger-skilt');
const bilSkilt = document.getElementById('bil-skilt');
const bilKnapper = [...document.querySelectorAll('.bil-svev')];
const PANELER = { kalkulator: document.getElementById('kalk-panel'), bil: document.getElementById('bil-panel') };
const panel = PANELER.kalkulator;
// «Bilen din»: alt om bilen, tegnes av bilen-din.js (hentes først når panelet åpnes)
let bilenDinModul = null;
const bilenDin = () => (bilenDinModul ??= import('./bilen-din.js'));
let aapen = null;                 // 'kalkulator', 'bil' eller null
let iKalkulator = false;          // true når en sidevisning er åpen (navnet er beholdt fra før)
let skiltVises = false;
let bilVises = false;
let bilSkjulTimer = null;
const innlogget = () => rot.classList.contains('innlogget');

function kanPeke() {
  return scene && !aapen && !rot.classList.contains('til-innlogging') && window.scrollY < window.innerHeight * 0.4;
}

function visSkilt(vis) {
  skiltVises = vis;
  skilt.classList.toggle('synlig', vis);
  oppdaterPeker();
  scene?.settHover(vis);
}
function visBil(vis) {
  clearTimeout(bilSkjulTimer);
  bilSkjulTimer = null;
  if (vis && !innlogget()) vis = false;
  bilVises = vis;
  rot.classList.toggle('bil-skannes', vis);
  oppdaterPeker();
  scene?.settBilSkann(vis);
}
// Skanningen slukker med en gang, som på tilhengeren. Knappene blir et øyeblikk til,
// så man rekker å flytte musa fra bilen til en knapp.
function skjulBilSnart() {
  if (bilSkjulTimer) return;
  scene?.settBilSkann(false);
  bilSkjulTimer = setTimeout(() => visBil(false), 250);
}
function oppdaterPeker() { canvas.classList.toggle('peker', skiltVises || bilVises); }

// Skilt og knapper følger kjøretøyene på skjermen
function plasser(el, punkt, { minTopp = 80 } = {}) {
  const p = scene.skjermpunkt(punkt);
  if (!p) return;
  const halv = el.offsetWidth / 2 + 12;
  el.style.left = `${Math.min(Math.max(p.x, halv), window.innerWidth - halv)}px`;
  el.style.top = `${Math.min(Math.max(p.y, el.offsetHeight / 2 + minTopp), window.innerHeight - el.offsetHeight / 2 - 12)}px`;
}
// De svevende knappene over bilen: hver følger sitt punkt, men dyttes ned (eller opp, hvis
// det ikke er plass under) til det er god avstand til de andre, så det er lett å treffe riktig.
const KNAPP_LUFT = 16;            // minste avstand mellom knappene (de svever ±7 px)
// På smale skjermer står knappene i et ryddig rutenett (to og to) rett over bilen i stedet.
function plasserBilKnapperRutenett() {
  const punkter = bilKnapper.map((_, i) => scene.skjermpunkt(`bil-${i + 1}`)).filter(Boolean);
  if (!punkter.length) return;
  const h = bilKnapper[0].offsetHeight;
  const rader = Math.ceil(bilKnapper.length / 2);
  const hoyde = rader * h + (rader - 1) * KNAPP_LUFT;
  const topp = Math.max(80, Math.min(...punkter.map((p) => p.y)) - hoyde + h);
  const midt = window.innerWidth / 2;
  bilKnapper.forEach((k, i) => {
    const b = k.offsetWidth;
    const rad = Math.floor(i / 2);
    const alene = i === bilKnapper.length - 1 && i % 2 === 0;
    const x = alene ? midt : i % 2 === 0 ? midt - KNAPP_LUFT / 2 - b / 2 : midt + KNAPP_LUFT / 2 + b / 2;
    k.style.left = `${x}px`;
    k.style.top = `${topp + rad * (h + KNAPP_LUFT) + h / 2}px`;
  });
}
function plasserBilKnapper() {
  if (window.innerWidth < 700) return plasserBilKnapperRutenett();
  const opptatt = [bilSkilt.getBoundingClientRect()];
  const knapper = bilKnapper.map((k, i) => {
    const p = scene.skjermpunkt(`bil-${i + 1}`);
    return p && { k, b: k.offsetWidth, h: k.offsetHeight, x: p.x, y: p.y };
  }).filter(Boolean).sort((a, b) => a.y - b.y);
  const kolliderer = (x, y, b, h) => opptatt.find((r) =>
    x - b / 2 < r.right + KNAPP_LUFT && x + b / 2 > r.left - KNAPP_LUFT
    && y - h / 2 < r.bottom + KNAPP_LUFT && y + h / 2 > r.top - KNAPP_LUFT);
  for (const { k, b, h, x: x0, y: y0 } of knapper) {
    const x = Math.min(Math.max(x0, b / 2 + 12), window.innerWidth - b / 2 - 12);
    const minY = h / 2 + 80;
    const maxY = window.innerHeight - h / 2 - 12;
    let y = Math.min(Math.max(y0, minY), maxY);
    for (let r, n = 0; (r = kolliderer(x, y, b, h)) && n < 10; n++) y = r.bottom + KNAPP_LUFT + h / 2;
    if (y > maxY) {             // ikke plass under: prøv over i stedet
      y = Math.min(Math.max(y0, minY), maxY);
      for (let r, n = 0; (r = kolliderer(x, y, b, h)) && n < 10; n++) y = r.top - KNAPP_LUFT - h / 2;
      y = Math.max(y, minY);
    }
    k.style.left = `${x}px`;
    k.style.top = `${y}px`;
    opptatt.push({ left: x - b / 2, right: x + b / 2, top: y - h / 2, bottom: y + h / 2 });
  }
}
function plasserSkilt() {
  if (skiltVises) plasser(skilt, 'tilhenger');
  if (bilVises) {
    plasser(bilSkilt, 'bil-apne');
    plasserBilKnapper();
  }
  requestAnimationFrame(plasserSkilt);
}
if (scene) requestAnimationFrame(plasserSkilt);

// Seksjonene slipper gjennom pekeren, så vi lytter på hele vinduet
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !kanPeke()) return;
  if (e.target.closest('.bil-svev, #bil-skilt')) { if (bilVises) visBil(true); return; }
  if (e.target.closest('a, button, .kalk-panel')) return;
  const hva = scene.treff(e.clientX, e.clientY);
  visSkilt(hva === 'tilhenger');
  if (hva === 'bil' && innlogget()) { if (!bilVises || bilSkjulTimer) visBil(true); }
  else if (bilVises) skjulBilSnart();
});

let trykkStart = null;
window.addEventListener('pointerdown', (e) => {
  trykkStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointerup', (e) => {
  if (!trykkStart || !kanPeke() || e.target.closest('a, button, .kalk-panel')) return;
  const flyttet = Math.hypot(e.clientX - trykkStart.x, e.clientY - trykkStart.y) > 10;
  trykkStart = null;
  if (flyttet) return;                       // det var et sveip, ikke et trykk
  const hva = scene.treff(e.clientX, e.clientY);
  const mus = e.pointerType === 'mouse';
  if (hva === 'tilhenger') {
    visBil(false);
    // På mobil viser første trykk skiltet, andre trykk åpner. Med mus åpner klikket direkte.
    if (mus || skiltVises) apneSide('kalkulator');
    else visSkilt(true);
  } else if (hva === 'bil' && innlogget()) {
    visSkilt(false);
    if (mus || bilVises) apneSide('bil');
    else visBil(true);
  } else if (!mus) {
    visSkilt(false);
    visBil(false);
  }
});
window.addEventListener('scroll', () => {
  if (window.scrollY > 40) {
    if (skiltVises) visSkilt(false);
    if (bilVises) visBil(false);
  }
}, { passive: true });
skilt.addEventListener('click', () => apneSide('kalkulator'));
bilSkilt.addEventListener('click', () => apneSide('bil'));
for (const k of bilKnapper) {
  k.addEventListener('pointerenter', () => { if (bilVises) visBil(true); });
  k.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') skjulBilSnart(); });
}
bilSkilt.addEventListener('pointerenter', () => { if (bilVises) visBil(true); });
bilSkilt.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') skjulBilSnart(); });

let pushet = false;               // true når apneSide la til en historikk-oppføring
function apneSide(navn, { historikk = true, fane, bilId } = {}) {
  if (navn === 'bil' && !innlogget()) {
    location.href = `/min-side?neste=${encodeURIComponent('/#bilen-din')}`;
    return;
  }
  if (aapen === navn) {
    if (navn === 'bil') bilenDin().then((m) => m.visBilenDin({ fane, bilId }));
    return;
  }
  if (aapen) lukkSide({ historikk: false, umiddelbart: true });
  aapen = navn;
  iKalkulator = true;
  const p = PANELER[navn];
  visSkilt(false);
  visBil(false);
  window.scrollTo({ top: 0, behavior: 'instant' });
  rot.dataset.theme = 'dark';
  scene?.settTema('dark');
  scene?.settSideBunn(null);
  scene?.settModus(navn);
  plasserPanel(p);
  p.hidden = false;
  p.scrollTop = 0;
  // Én frame senere, så overgangen fra skjult til synlig blir animert
  requestAnimationFrame(() => {
    rot.classList.add('kalkulator-modus');
    p.classList.add('apen');
  });
  header.classList.remove('skjult');
  if (historikk) history.pushState({ side: navn }, '', `${navn === 'bil' ? location.search : ''}#${navn === 'bil' ? 'bilen-din' : 'kalkulator'}`);
  pushet = historikk;
  if (navn === 'bil') bilenDin().then((m) => m.visBilenDin({ fane, bilId }));
  // Tastaturet på mobil ville dekket vogntoget, så bare fokuser med mus/tastatur
  if (navn === 'kalkulator' && !window.matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => document.getElementById('last-bil').focus({ preventScroll: true }), 1100);
  }
}
const apneKalkulator = (o) => apneSide('kalkulator', o);

function lukkSide({ historikk = true, umiddelbart = false } = {}) {
  if (!aapen) return;
  const p = PANELER[aapen];
  aapen = null;
  iKalkulator = false;
  p.classList.remove('apen');
  if (!umiddelbart) {
    rot.classList.remove('kalkulator-modus');
    scene?.settModus('scroll');
    aktivIndeks = -1;
    vedScroll();
  }
  setTimeout(() => { if (!p.classList.contains('apen')) p.hidden = true; }, 900);
  if (!historikk || !/^#(kalkulator|bilen-din)$/.test(location.hash)) return;
  // Åpnet vi panelet her, går vi tilbake. Kom man rett inn på adressen, blir forsiden stående.
  if (pushet) history.back();
  else history.replaceState(null, '', '/');
  pushet = false;
}
const lukkKalkulator = (o) => lukkSide(o);


// Begge panelene går helt opp til headeren, med luft øverst der vogntoget vises. Når man blar ned,
// zoomer kameraet ut så veien hele tiden slutter der teksten begynner, til vogntoget bare er en smal
// stripe under logoen og tilbakeknappen. Fanene i «Bilen din» stopper rett under veien.
function plasserPanel(p) {
  const topp = Math.round(header.getBoundingClientRect().bottom);
  const { full, mini } = scene ? scene.sideBunn() : { full: 72, mini: 72 };
  p.style.setProperty('--kalk-topp', `${topp}px`);
  p.style.setProperty('--bil-luft', `${Math.max(0, full - topp)}px`);
  p.style.setProperty('--vei-bunn', `${Math.max(0, mini - topp)}px`);
  zoomEtterScroll(p);
}
function zoomEtterScroll(p) {
  if (!scene || PANELER[aapen] !== p) return;
  const { full, mini } = scene.sideBunn();
  scene.settSideBunn(p.scrollTop > 0 ? Math.max(mini, full - p.scrollTop) : null);
}
for (const p of Object.values(PANELER)) {
  p.addEventListener('scroll', () => zoomEtterScroll(p), { passive: true });
}

window.addEventListener('keydown', (e) => { if (e.key === 'Escape') lukkSide(); });

// Lett å komme tilbake: trykk utenfor teksten (på vogntoget, veien eller sidene) ...
let kalkTrykk = null;
window.addEventListener('pointerdown', (e) => {
  kalkTrykk = aapen ? { x: e.clientX, y: e.clientY } : null;
});
window.addEventListener('pointerup', (e) => {
  if (!kalkTrykk || !aapen) return;
  const flyttet = Math.hypot(e.clientX - kalkTrykk.x, e.clientY - kalkTrykk.y) > 10;
  kalkTrykk = null;
  if (flyttet || e.target.closest('.kalk-innhold, .topp, a, button, input, label, select')) return;
  lukkSide();
});
// ... eller dra/scroll oppover når man allerede står øverst
let oppover = 0;
window.addEventListener('wheel', (e) => {
  if (!aapen || PANELER[aapen].scrollTop > 0 || e.deltaY >= 0) { oppover = 0; return; }
  oppover += -e.deltaY;
  if (oppover > 80) { oppover = 0; lukkSide(); }
}, { passive: true });
let draStart = null;
window.addEventListener('touchstart', (e) => {
  draStart = aapen && PANELER[aapen].scrollTop <= 0 ? e.touches[0].clientY : null;
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (draStart === null || !aapen) return;
  if (PANELER[aapen].scrollTop > 0) { draStart = null; return; }
  if (e.touches[0].clientY - draStart > 90) { draStart = null; lukkSide(); }
}, { passive: true });

window.addEventListener('popstate', () => {
  if (location.hash === '#kalkulator') apneSide('kalkulator', { historikk: false });
  else if (location.hash === '#bilen-din') apneSide('bil', { historikk: false });
  else lukkSide({ historikk: false });
});
window.addEventListener('resize', () => {
  if (aapen) plasserPanel(PANELER[aapen]);
});

// Knappen i headeren åpner kalkulatoren her på siden (lenken til /kalkulator virker uten JS),
// og blir «Tilbake» når en sidevisning er åpen
const toppKnapp = document.querySelector('.topp-knapp[href="/kalkulator"]');
toppKnapp?.addEventListener('click', (e) => {
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  if (aapen) lukkSide(); else apneSide('kalkulator');
});
if (location.hash === '#kalkulator') apneSide('kalkulator', { historikk: false });
if (location.hash === '#bilen-din') apneSide('bil', { historikk: false });

// Lenker til «Bilen din» (profilmenyen, varslene, de svevende knappene) åpner panelet her,
// på riktig bil og fane (/?bil=…&fane=…#bilen-din). Uten JavaScript er de vanlige lenker.
document.addEventListener('click', (e) => {
  const lenke = e.target.closest('a[href*="#bilen-din"]');
  if (!lenke || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const url = new URL(lenke.href);
  if (url.pathname !== '/') return;
  e.preventDefault();
  for (const [meny, knapp] of [['profil-meny', 'profil-knapp'], ['varsel-panel', 'varsel-knapp']]) {
    document.getElementById(meny).hidden = true;
    document.getElementById(knapp).setAttribute('aria-expanded', 'false');
  }
  apneSide('bil', { fane: url.searchParams.get('fane') ?? 'oversikt', bilId: url.searchParams.get('bil') });
});

// ---------- Selve kalkulatoren: oppslag på skilt (lastkalkulator.js) ----------
import('./lastkalkulator.js');

// ---------- Rask førerkort-sjekk med vekter fra vognkortet ----------
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

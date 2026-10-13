// Kortene på forsiden (Motorrom, Bremseanlegg, Dekk og hjul).
// Utlogget: eksempelkortene i index.html. Innlogget: status for valgt bil fra servicehistorikken,
// og kortene lenker til riktig fane i «Bilen din». Innholdet regnes ut i /js/forside.js (ren, testet).
import { bilNavn, velgBil } from '/js/dashboard.js';
import { bilLenke } from '/js/bilstatus.js';
import { forsideKort } from '/js/forside.js';
import { lakkFor, registrertFarge } from '/js/bilfarge.js';
import { hentBiler, lagretBil } from './bil-data.js';

const merknad = document.querySelector('.eksempeldata');
let visesFraPanel = false; // «Bilen din» har allerede sagt hvilken bil som vises

function tegnKort(del, k, href) {
  const a = document.querySelector(`a.glasskort[data-del="${del}"]`);
  if (!a) return;
  a.classList.remove('status-ok', 'status-sjekk', 'status-kritisk', 'status-tom');
  a.classList.add(`status-${k.status}`);
  a.href = href;
  const prikk = a.querySelector('.status-prikk');
  prikk.classList.toggle('varsel', k.status === 'kritisk');
  prikk.textContent = k.status === 'kritisk' ? '⚠️' : '';
  a.querySelector('.kort-status').textContent = k.statusTekst;
  a.querySelector('.kort-tittel').textContent = k.tittel;
  a.querySelector('.kort-tekst').textContent = k.tekst;
}

// Bilen i 3D får fargen den er registrert med hos Vegvesenet. Fargen huskes i nettleseren,
// så vi ikke slår opp skiltet hver gang siden lastes.
const FARGE_NOKKEL = 'mekko-farge-';
let fargeFor = null;
async function visFarge(bil) {
  const skilt = bil?.kjennemerke;
  fargeFor = skilt;
  if (!skilt) return sendFarge(null);
  let navn;
  try { navn = localStorage.getItem(FARGE_NOKKEL + skilt); } catch { /* ingen lagring */ }
  if (navn == null) {
    try {
      const res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(skilt)}`);
      if (!res.ok) return;
      navn = registrertFarge(await res.json()) ?? '';
      try { localStorage.setItem(FARGE_NOKKEL + skilt, navn); } catch { /* bare en snarvei */ }
    } catch { return; }
  }
  if (fargeFor === skilt) sendFarge(lakkFor(navn));
}
function sendFarge(farge) {
  document.dispatchEvent(new CustomEvent('mekko:lakk', { detail: { farge } }));
}

function visBil(bil) {
  visFarge(bil);
  const kort = forsideKort(bil, new Date());
  for (const del of ['motor', 'bremser', 'dekk']) tegnKort(del, kort[del], bilLenke(bil, kort[del].fane));
  // Delene på 3D-bilen lyser i samme farge som kortet når kameraet zoomer inn
  sendStatus({ motor: kort.motor.status, bremser: kort.bremser.status, dekk: kort.dekk.status });
  if (merknad) merknad.textContent = `Viser ${bilNavn(bil)}${bil.kjennemerke ? ` (${bil.kjennemerke})` : ''}`;
}

function sendStatus(status) {
  document.dispatchEvent(new CustomEvent('mekko:delstatus', { detail: { status } }));
}

function ingenBil() {
  sendStatus({ motor: 'tom', bremser: 'tom', dekk: 'tom' });
  const k = { status: 'tom', statusTekst: 'Ingen bil ennå', tekst: 'Legg til bilen din, så ser du status her.' };
  for (const [del, tittel] of [['motor', 'Motorolje & filter'], ['bremser', 'Bremseklosser'], ['dekk', 'Dekk']]) {
    tegnKort(del, { ...k, tittel }, '/min-side#ny-bil-skjema');
  }
  merknad?.remove();
}

async function start() {
  try {
    const { biler } = await hentBiler();
    if (visesFraPanel) return;
    if (!biler.length) { ingenBil(); return; }
    const param = new URLSearchParams(location.search).get('bil');
    visBil(velgBil(biler, param ?? lagretBil()));
  } catch (feil) {
    // Får vi ikke hentet bilene, blir eksempelkortene stående
    console.warn('Kunne ikke hente bilene til forsiden:', feil);
  }
}

if (document.documentElement.classList.contains('innlogget')) {
  // Bytter man bil (eller lagrer noe) i «Bilen din», følger kortene etter
  document.addEventListener('mekko:bil', (e) => { visesFraPanel = true; visBil(e.detail.bil); });
  // Vent til siden er tegnet, så 3D-bilen ikke må vente på dataene
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

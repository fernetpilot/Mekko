// «Bilen din»: den samlede bilvisningen under 3D-bilen (innlogget).
// Bytt bil øverst, nøkkeltall, og faner for Oversikt, Service, Vedlikehold, Dekk, Økonomi og Bildata.
// All beregning ligger i de rene modulene (dashboard.js, dekk.js, bilstatus.js). Her tegnes bare panelet.
import { euStatus, formaterDato, formaterKm } from '/js/bilstatus.js';
import { normaliserSkilt } from '/js/kjoretoy.js';
import { alleFrister, aarshjul, bilNavn, velgBil } from '/js/dashboard.js';
import { hentBiler, lagreBil, lagretBil } from './bil-data.js';
import { el, fristListe, lenkekort, liten } from './bil-visning.js';
import { dekkFane } from './fane-dekk.js';
import { serviceFane, serviceFliser } from './fane-service.js';
import { vedlikeholdFane } from './fane-vedlikehold.js';
import { okonomiFane } from './fane-okonomi.js';

export const FANER = [
  { id: 'oversikt', navn: 'Oversikt' },
  { id: 'service', navn: 'Service og EU' },
  { id: 'vedlikehold', navn: 'Vedlikehold' },
  { id: 'dekk', navn: 'Dekk' },
  { id: 'okonomi', navn: 'Økonomi' },
  { id: 'bildata', navn: 'Bildata' },
];

const $ = (id) => document.getElementById(id);

let biler = null;        // hentet én gang per sidevisning
let henter = null;
let bil = null;
let fane = 'oversikt';
let dekksettOk = true;
let slippHoyde = null;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function hentBilerOgDekk() {
  const svar = await hentBiler();
  dekksettOk = svar.dekksettOk;
  return svar.biler;
}

/** Valgt bil og fane står i adressen (?bil=…&fane=…#bilen-din), så lenker og «tilbake» virker. */
function oppdaterAdresse() {
  const url = new URL(location.href);
  if (bil) url.searchParams.set('bil', bil.id);
  if (fane === 'oversikt') url.searchParams.delete('fane'); else url.searchParams.set('fane', fane);
  url.hash = 'bilen-din';
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}

/**
 * Åpner (eller oppdaterer) panelet.
 * @param {{ bilId?: string|null, fane?: string|null }} valg  Uten bilId: bilen i adressen, sist valgte eller den første.
 */
export async function visBilenDin(valg = {}) {
  const param = new URLSearchParams(location.search);
  const onsketFane = valg.fane ?? param.get('fane');
  if (FANER.some((f) => f.id === onsketFane)) fane = onsketFane;
  else if (valg.fane !== undefined || !bil) fane = 'oversikt';

  if (!biler) {
    try {
      henter ??= hentBilerOgDekk();
      biler = await henter;
    } catch (feil) {
      console.warn('Kunne ikke hente bilene:', feil);
      henter = null;
      $('bil-navn').textContent = 'Kunne ikke hente bilen';
      $('bil-kjennemerke').textContent = 'Prøv igjen litt senere.';
      return;
    }
  }
  if (!biler.length) {
    $('bil-navn').textContent = 'Ingen bil registrert ennå';
    $('bil-kjennemerke').textContent = 'Legg til bilen din, så samler vi alt om den her.';
    $('bil-bytte').replaceChildren(leggTilKnapp());
    $('bil-bytte').hidden = false;
    return;
  }
  bil = velgBil(biler, valg.bilId ?? param.get('bil') ?? bil?.id ?? lagretBil());
  lagreBil(bil.id);
  tegn();
}

// ---------------------------------------------------------------------------
// Toppen: bilbytte, navn og nøkkeltall
// ---------------------------------------------------------------------------
// «+ Legg til bil» blir til en tekstboks rett ved siden av, så man slipper å gå til en annen side.
function leggTilKnapp() {
  const knapp = el('button', 'bil-chip legg-til', '+ Legg til bil');
  knapp.type = 'button';
  knapp.addEventListener('click', () => {
    const skjema = leggTilSkjema(() => skjema.replaceWith(knapp));
    knapp.replaceWith(skjema);
    skjema.querySelector('input').focus();
    skjema.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'smooth' });
  });
  return knapp;
}

function leggTilSkjema(avbryt) {
  const skjema = el('form', 'bil-ny');
  const felt = el('input');
  Object.assign(felt, { type: 'text', name: 'skilt', placeholder: 'Skiltnummer', autocomplete: 'off', spellcheck: false });
  felt.setAttribute('aria-label', 'Skiltnummer på bilen du vil legge til');
  felt.setAttribute('autocapitalize', 'characters');
  const ok = el('button', 'bil-ny-ok', 'Legg til');
  ok.type = 'submit';
  const lukk = el('button', 'bil-ny-lukk', '✕');
  lukk.type = 'button';
  lukk.setAttribute('aria-label', 'Avbryt');
  lukk.addEventListener('click', () => { melding(''); avbryt(); });
  skjema.append(felt, ok, lukk);

  skjema.addEventListener('submit', async (e) => {
    e.preventDefault();
    const skilt = normaliserSkilt(felt.value);
    if (!skilt) { melding('Skriv et gyldig skiltnummer, f.eks. AB 12345.', 'feil'); felt.focus(); return; }
    ok.disabled = felt.disabled = true;
    melding(`Henter ${skilt} fra Statens vegvesen …`);
    try {
      const { slaOppBil, lagreNyBil } = await import('/js/ny-bil.js');
      const k = await slaOppBil(skilt);
      const id = await lagreNyBil(skilt, k);
      melding(`${[k.merke, k.modell].filter(Boolean).join(' ') || skilt} er lagt til.`, 'ok');
      biler = null;
      henter = null;
      await visBilenDin({ bilId: id });
    } catch (feil) {
      melding(feil.message, 'feil');
      ok.disabled = felt.disabled = false;
      felt.focus();
    }
  });
  return skjema;
}

function melding(tekst, type = '') {
  const m = $('bil-ny-melding');
  m.textContent = tekst;
  m.className = `bil-ny-melding ${type}`;
  m.hidden = !tekst;
}

function tegn() {
  const bytte = $('bil-bytte');
  bytte.replaceChildren(...biler.map((b) => {
    const k = el('button', 'bil-chip', b.kjennemerke);
    k.type = 'button';
    k.title = bilNavn(b);
    k.setAttribute('aria-pressed', String(b.id === bil.id));
    k.addEventListener('click', () => {
      if (b.id === bil.id) return;
      bil = b;
      lagreBil(b.id);
      tegn();
      $('bil-panel').scrollTo({ top: 0, behavior: 'smooth' });
    });
    return k;
  }), leggTilKnapp());
  bytte.hidden = false;

  $('bil-navn').textContent = bilNavn(bil);
  $('bil-kjennemerke').textContent = bil.kjennemerke ?? '';
  const eu = euStatus(bil.eu_kontrollfrist);
  $('bil-eu').textContent = eu.tekst;
  $('bil-eu').className = `fakta-verdi ${eu.status}`;
  $('bil-km').textContent = bil.kilometerstand != null ? formaterKm(bil.kilometerstand) : '–';

  // Lenker videre (registrer vedlikehold osv.) tar med valgt bil
  for (const a of document.querySelectorAll('#bil-panel [data-bil-lenke]')) {
    const url = new URL(a.getAttribute('href'), location.origin);
    url.searchParams.set('bil', bil.id);
    a.href = url.pathname + url.search;
  }
  tegnFaner();
  oppdaterAdresse();
  // Kortene på forsiden følger valgt bil (forside-kort.js)
  document.dispatchEvent(new CustomEvent('mekko:bil', { detail: { bil } }));
}

function tegnFaner() {
  const nav = $('bil-faner');
  nav.replaceChildren(...FANER.map((f) => {
    const k = el('button', 'bil-fane', f.navn);
    k.type = 'button';
    k.setAttribute('role', 'tab');
    k.id = `bil-fane-${f.id}`;
    k.setAttribute('aria-controls', 'bil-fane-innhold');
    k.setAttribute('aria-selected', String(f.id === fane));
    k.tabIndex = f.id === fane ? 0 : -1;
    k.addEventListener('click', () => velgFane(f.id));
    return k;
  }));
  // Valgt fane inn i synsfeltet sideveis (bare vannrett, så siden ikke flytter seg)
  const valgt = nav.querySelector('[aria-selected="true"]');
  if (valgt) {
    const venstre = valgt.offsetLeft - nav.offsetLeft;
    if (venstre < nav.scrollLeft) nav.scrollLeft = venstre - 8;
    else if (venstre + valgt.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = venstre + valgt.offsetWidth - nav.clientWidth + 8;
  }

  const innhold = $('bil-fane-innhold');
  innhold.setAttribute('aria-labelledby', `bil-fane-${fane}`);
  innhold.replaceChildren(...TEGNERE[fane](bil, new Date(), { oppdater: lastPaNytt, dekksettOk }));
}

/** Henter bilene på nytt etter en endring (dekkskift, kjøpsopplysninger …) og tegner valgt fane igjen. */
async function lastPaNytt() {
  const panel = $('bil-panel');
  const scroll = panel.scrollTop;
  biler = null;
  henter = null;
  await visBilenDin({ bilId: bil.id, fane });
  panel.scrollTop = scroll;
}

export function velgFane(id) {
  if (!FANER.some((f) => f.id === id) || !bil) return;
  fane = id;
  // Bli stående der man er: hold på høyden så en kortere fane ikke drar siden opp
  const panel = $('bil-panel');
  const innhold = $('bil-fane-innhold');
  const scroll = panel.scrollTop;
  innhold.style.minHeight = `${innhold.offsetHeight}px`;
  tegnFaner();
  oppdaterAdresse();
  panel.scrollTop = scroll;
  // Slipp høyden når man blar opp igjen
  if (slippHoyde) panel.removeEventListener('scroll', slippHoyde);
  const slipp = slippHoyde = () => {
    if (panel.scrollTop > scroll - 40) return;
    innhold.style.minHeight = '';
    panel.removeEventListener('scroll', slipp);
  };
  panel.addEventListener('scroll', slipp, { passive: true });
}

// Piltaster mellom fanene
document.addEventListener('keydown', (e) => {
  if (!e.target.closest?.('#bil-faner') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const i = FANER.findIndex((f) => f.id === fane);
  const ny = FANER[(i + (e.key === 'ArrowRight' ? 1 : FANER.length - 1)) % FANER.length].id;
  velgFane(ny);
  $(`bil-fane-${ny}`).focus();
});

// ---------------------------------------------------------------------------
// Fanene
// ---------------------------------------------------------------------------
function oversikt(b, idag) {
  const frister = alleFrister(b, idag);
  const hjul = aarshjul(frister, idag);
  const ut = [serviceFliser(frister)];
  if (hjul.forfalt.length) ut.push(fristListe('Bør gjøres nå', hjul.forfalt, 'forfalt-kort'));
  const snart = hjul.maaneder.flatMap((m) => m.frister).slice(0, 3);
  if (snart.length) ut.push(fristListe('Kommer snart', snart));
  if (!hjul.forfalt.length && !snart.length) {
    ut.push(liten('Ingen kjente frister de neste 12 månedene. Registrer vedlikehold, så fyller oversikten seg.'));
  }
  return ut;
}

function bildataFane(b) {
  const dl = el('dl', 'bil-data');
  const rader = [
    ['Kjennemerke', b.kjennemerke],
    ['Merke', b.merke],
    ['Modell', b.modell],
    ['Første gang registrert', b.forstegangsregistrert && formaterDato(b.forstegangsregistrert)],
    ['EU-kontrollfrist', b.eu_kontrollfrist && formaterDato(b.eu_kontrollfrist)],
    ['Kilometerstand', b.kilometerstand != null
      && `${formaterKm(b.kilometerstand)}${b.kilometerstand_dato ? ` (${formaterDato(b.kilometerstand_dato)})` : ''}`],
  ];
  for (const [n, v] of rader) {
    if (!v) continue;
    const d = el('div');
    d.append(el('dt', null, n), el('dd', null, v));
    dl.append(d);
  }
  const s = el('section', 'bil-kort');
  s.append(dl);
  return [
    s,
    lenkekort(b, 'Alle kjøretøydata fra Statens vegvesen', 'Vekter, motor, dimensjoner og mer. Her endrer eller fjerner du også bilen.', '/min-side'),
  ];
}

const TEGNERE = {
  oversikt,
  service: serviceFane,
  vedlikehold: vedlikeholdFane,
  dekk: dekkFane,
  okonomi: okonomiFane,
  bildata: bildataFane,
};

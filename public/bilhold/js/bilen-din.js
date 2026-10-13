// «Bilen din»: den samlede bilvisningen under 3D-bilen (innlogget).
// Bytt bil øverst, nøkkeltall, og faner for Oversikt, Service, Vedlikehold, Dekk, Økonomi og Bildata.
// All beregning ligger i de rene modulene (dashboard.js, dekk.js, bilstatus.js). Her tegnes bare panelet.
import { supabase } from '/js/supabase.js';
import { euStatus, formaterDato, formaterKm } from '/js/bilstatus.js';
import { alleFrister, aarshjul, bilNavn, normaliserStatus, velgBil } from '/js/dashboard.js';
import { leggPaDekksett } from '/js/dekk-data.js';
import { dekkPaBilen, dekkskift, settNavn, settType, vurderSett } from '/js/dekk.js';
import { el, flis, fliser, fristListe, lenkekort, liten } from './bil-visning.js';
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
const LAGRET_BIL = 'mekko-valgt-bil';

const $ = (id) => document.getElementById(id);

let biler = null;        // hentet én gang per sidevisning
let henter = null;
let bil = null;
let fane = 'oversikt';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function hentBiler() {
  const { data, error } = await supabase
    .from('biler')
    .select('*, vedlikehold(*, dokumenter(*)), utsettelser(*)')
    .order('opprettet')
    .order('dato', { referencedTable: 'vedlikehold', ascending: false });
  if (error) throw error;
  await leggPaDekksett(supabase, data);
  return data;
}

function lagretBil() {
  try { return localStorage.getItem(LAGRET_BIL); } catch { return null; }
}
function lagreBil(id) {
  try { localStorage.setItem(LAGRET_BIL, id); } catch { /* bare en snarvei */ }
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
      henter ??= hentBiler();
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
function leggTilKnapp() {
  const a = el('a', 'bil-chip legg-til', '+ Legg til bil');
  a.href = '/min-side#ny-bil-skjema';
  return a;
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
  nav.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  const innhold = $('bil-fane-innhold');
  innhold.setAttribute('aria-labelledby', `bil-fane-${fane}`);
  innhold.replaceChildren(...TEGNERE[fane](bil, new Date()));
}

export function velgFane(id) {
  if (!FANER.some((f) => f.id === id) || !bil) return;
  fane = id;
  tegnFaner();
  oppdaterAdresse();
  // Hopp til fanene hvis man har scrollet langt ned
  const panel = $('bil-panel');
  const topp = $('bil-faner').offsetTop - 24;
  if (panel.scrollTop > topp) panel.scrollTo({ top: topp, behavior: 'smooth' });
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

function dagTekst(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dekkFane(b, idag) {
  const iDag = dagTekst(idag);
  const sett = b.dekksett ?? [];
  const pa = dekkPaBilen(sett);
  const tilstand = pa ? vurderSett(pa, iDag) : null;
  const skift = dekkskift({ type: pa?.type ?? null, pigg: pa?.pigg, region: b.dekk_region ?? 'sor', idag: iDag });
  const ut = [fliser(
    flis('Neste dekkskift', skift.bytteTil === 'vinter' ? 'Vinterdekk' : skift.bytteTil === 'sommer' ? 'Sommerdekk' : 'Ukjent',
      skift.tekst, skift.status),
    pa
      ? flis('På bilen nå', settType(pa),
        tilstand.tekst || [pa.dimensjon, pa.montert && `Montert ${formaterDato(pa.montert)}`].filter(Boolean).join(' · ') || 'Mønster og alder ser bra ut',
        normaliserStatus(tilstand.status))
      : flis('På bilen nå', 'Ikke valgt', 'Legg til dekksett og kryss av for det som står på', 'ukjent'),
  )];

  if (sett.length) {
    const k = el('section', 'bil-kort');
    k.append(el('h3', null, 'Dekksettene dine'));
    const ul = el('ul', 'bil-liste');
    // På bilen først, så sommer før vinter
    for (const s of [...sett].sort((x, y) => Number(y.pa_bilen) - Number(x.pa_bilen) || x.type.localeCompare(y.type))) {
      const v = vurderSett(s, iDag);
      const status = normaliserStatus(v.status);
      const li = el('li', `frist ${status}`);
      li.append(el('span', 'prikk'));
      const t = el('div', 'liste-tekst');
      t.append(el('strong', null, settNavn(s)), el('span', 'liste-under', v.tekst || [
        s.monsterdybde_mm != null && `${String(s.monsterdybde_mm).replace('.', ',')} mm`,
        s.produksjonsaar && `fra ${s.produksjonsaar}`,
        !s.pa_bilen && s.lagring,
      ].filter(Boolean).join(' · ')));
      li.append(t, el('span', 'merke', s.pa_bilen ? 'På bilen' : 'Lagret'));
      ul.append(li);
    }
    k.append(ul);
    ut.push(k);
  } else {
    ut.push(liten('Ingen dekksett ennå. Legg inn sommer- og vinterdekkene, så sier vi fra når det er tid for å bytte.'));
  }
  ut.push(lenkekort(b, sett.some((s) => !s.pa_bilen) ? 'Registrer dekkskift og endre dekk' : 'Legg til dekksett',
    'Sommer- og vinterdekk, mønster, alder og hvor du kjører.', '/dekk'));
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

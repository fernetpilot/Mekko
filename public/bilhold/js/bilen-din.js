// «Bilen din»: den samlede bilvisningen under 3D-bilen (innlogget).
// Bytt bil øverst, nøkkeltall, og faner for Oversikt, Service, Vedlikehold, Dekk, Økonomi og Bildata.
// All beregning ligger i de rene modulene (dashboard.js, dekk.js, bilstatus.js). Her tegnes bare panelet.
import { supabase } from '/js/supabase.js';
import { euStatus, formaterDato, formaterKm } from '/js/bilstatus.js';
import {
  alleFrister, aarshjul, bilNavn, formaterKr, hendelseTittel, nesteService,
  slitasjeOppsummering, sorterFrister, velgBil, vedlikeholdOversikt,
} from '/js/dashboard.js';
import { leggPaDekksett } from '/js/dekk-data.js';
import { dekkPaBilen, settNavn } from '/js/dekk.js';

export const FANER = [
  { id: 'oversikt', navn: 'Oversikt' },
  { id: 'service', navn: 'Service og EU' },
  { id: 'vedlikehold', navn: 'Vedlikehold' },
  { id: 'dekk', navn: 'Dekk' },
  { id: 'okonomi', navn: 'Økonomi' },
  { id: 'bildata', navn: 'Bildata' },
];
const STATUS_TEKST = { ok: 'OK', snart: 'Snart', forfalt: 'Bør gjøres', utsatt: 'Utsatt', ukjent: 'Ukjent' };
const LAGRET_BIL = 'mekko-valgt-bil';

const $ = (id) => document.getElementById(id);
function el(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
}

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
    .select('*, vedlikehold(*, dokumenter(id)), utsettelser(*)')
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
// Byggeklosser
// ---------------------------------------------------------------------------
function flis(etikett, verdi, under, status = 'noytral') {
  const d = el('div', `bil-flis ${status}`);
  d.append(el('p', 'flis-etikett', etikett), el('p', 'flis-verdi', verdi));
  if (under) d.append(el('p', 'flis-under', under));
  return d;
}

function fliser(...barn) {
  const d = el('div', 'bil-fliser');
  d.append(...barn);
  return d;
}

function kmIgjen(k) {
  if (k == null) return '';
  return k > 0 ? `${formaterKm(k)} igjen` : `${formaterKm(-k)} over`;
}

function fristLinje(f) {
  if (f.id === 'dekk' || f.id === 'dekkskift') return f.tekst ?? '';
  return [f.dato && formaterDato(f.dato), f.km != null && `ved ${formaterKm(f.km)}`, kmIgjen(f.kmIgjen)]
    .filter(Boolean).join(' · ');
}

function fristListe(tittel, frister, klasse = '') {
  const s = el('section', `bil-kort ${klasse}`);
  s.append(el('h3', null, tittel));
  const ul = el('ul', 'bil-liste');
  for (const f of frister) {
    const li = el('li', `frist ${f.status}`);
    li.append(el('span', 'prikk'));
    const t = el('div', 'liste-tekst');
    t.append(el('strong', null, f.navn), el('span', 'liste-under', fristLinje(f)));
    li.append(t, el('span', 'merke', STATUS_TEKST[f.status]));
    ul.append(li);
  }
  s.append(ul);
  return s;
}

/** Lenke til en underside, med valgt bil. */
function lenkekort(tittel, tekst, href) {
  const a = el('a', 'glasskort bil-lenkekort');
  const url = new URL(href, location.origin);
  url.searchParams.set('bil', bil.id);
  a.href = url.pathname + url.search;
  const inn = el('span', 'kort-innhold');
  inn.append(el('span', 'kort-tittel', tittel), el('span', 'kort-tekst', tekst));
  const pil = el('span', 'kort-pil', '›');
  pil.setAttribute('aria-hidden', 'true');
  a.append(inn, pil);
  return a;
}

function liten(tekst) { return el('p', 'bil-liten', tekst); }

// ---------------------------------------------------------------------------
// Fanene
// ---------------------------------------------------------------------------
function oversikt(b, idag) {
  const frister = alleFrister(b, idag);
  const hjul = aarshjul(frister, idag);
  const service = nesteService(frister);
  const slitasje = slitasjeOppsummering(frister);
  const ut = [fliser(
    service
      ? flis('Neste service', service.navn,
        [service.dato && formaterDato(service.dato), kmIgjen(service.kmIgjen)].filter(Boolean).join(' · '), service.status)
      : flis('Neste service', 'Ingen plan ennå', 'Registrer siste service', 'ukjent'),
    flis('Dekk og slitasje',
      slitasje.status === 'ukjent' ? 'Ikke registrert'
        : slitasje.deler.length ? slitasje.deler.map((d) => d.navn).join(', ') : 'Alt ser bra ut',
      slitasje.status === 'ukjent' ? 'Legg inn dekk og bremser' : STATUS_TEKST[slitasje.status],
      slitasje.status),
  )];
  if (hjul.forfalt.length) ut.push(fristListe('Bør gjøres nå', hjul.forfalt, 'forfalt-kort'));
  const snart = hjul.maaneder.flatMap((m) => m.frister).slice(0, 3);
  if (snart.length) ut.push(fristListe('Kommer snart', snart));
  if (!hjul.forfalt.length && !snart.length) {
    ut.push(liten('Ingen kjente frister de neste 12 månedene. Registrer vedlikehold, så fyller oversikten seg.'));
  }
  return ut;
}

function serviceFane(b, idag) {
  const frister = alleFrister(b, idag);
  const kjente = sorterFrister(frister.filter((f) => f.status !== 'ukjent'));
  const ut = [];
  if (kjente.length) ut.push(fristListe('Neste frister', kjente.slice(0, 6)));
  else ut.push(liten('Ingen frister ennå. Registrer siste service, så regner vi ut neste.'));
  const ukjente = frister.filter((f) => f.status === 'ukjent');
  if (ukjente.length) ut.push(liten(`Mangler registrering: ${ukjente.map((f) => f.navn).join(' · ')}`));
  ut.push(lenkekort('Hele årshjulet', 'EU-kontroll, service og slitasje måned for måned.', '/service-og-eu'));
  ut.push(el('p', 'bil-ansvar', 'Fristene er veiledende og bygger på det du har registrert. Sjekk servicehefte og vognkort, og vegvesen.no for EU-kontroll.'));
  return ut;
}

function vedlikeholdFane(b) {
  const o = vedlikeholdOversikt(b.vedlikehold ?? []);
  const ut = [fliser(
    flis('Jobber registrert', String(o.antall), o.aar.length ? `Fra ${o.aar.at(-1).aar} til ${o.aar[0].aar}` : 'Ingen ennå'),
    flis('Totalt brukt', formaterKr(o.totalKostnad), o.medKostnad < o.antall ? `${o.antall - o.medKostnad} uten beløp` : null),
  )];
  const siste = o.aar.flatMap((a) => a.hendelser).slice(0, 5);
  if (siste.length) {
    const s = el('section', 'bil-kort');
    s.append(el('h3', null, 'Sist gjort'));
    const ul = el('ul', 'bil-liste');
    for (const h of siste) {
      const li = el('li', 'jobb');
      const t = el('div', 'liste-tekst');
      t.append(el('strong', null, hendelseTittel(h)),
        el('span', 'liste-under', [formaterDato(h.dato), h.kilometerstand != null && formaterKm(h.kilometerstand)].filter(Boolean).join(' · ')));
      li.append(t);
      if (h.kostnad != null) li.append(el('span', 'liste-belop', formaterKr(h.kostnad)));
      ul.append(li);
    }
    s.append(ul);
    ut.push(s);
  }
  ut.push(
    lenkekort('Alt vedlikehold', 'Hele historikken per år, med kvitteringer.', '/vedlikehold'),
    lenkekort('Servicehefte', 'Historikk med vedlegg, og last ned som PDF.', '/servicehefte'),
    lenkekort('Importer historikk', 'Fra regneark eller PDF, mange hendelser på én gang.', '/importer-historikk'),
  );
  return ut;
}

function dekkFane(b, idag) {
  const pa = dekkPaBilen(b.dekksett);
  const skift = alleFrister(b, idag).find((f) => f.id === 'dekkskift');
  const ut = [fliser(
    flis('På bilen nå', pa ? settNavn(pa) : 'Ikke valgt', b.dekksett?.length ? `${b.dekksett.length} dekksett registrert` : 'Ingen dekksett ennå'),
    flis('Dekkskift', skift ? STATUS_TEKST[skift.status] : 'Ukjent', skift?.tekst ?? null, skift?.status ?? 'ukjent'),
  )];
  ut.push(lenkekort('Dekk og dekkskift', 'Sommer- og vinterdekk, mønster, alder og registrer dekkskift.', '/dekk'));
  return ut;
}

function okonomiFane(b, idag) {
  const o = vedlikeholdOversikt(b.vedlikehold ?? []);
  const iAar = o.aar.find((a) => a.aar === String(idag.getFullYear()));
  const ut = [fliser(
    flis('Vedlikehold totalt', formaterKr(o.totalKostnad), o.antall ? `${o.antall} jobber` : 'Ingen ennå'),
    flis(`Brukt i ${idag.getFullYear()}`, formaterKr(iAar?.sum ?? 0)),
  )];
  if (b.kjopspris != null) {
    ut.push(fliser(flis('Kjøpspris', formaterKr(b.kjopspris), b.kjopsdato ? `Kjøpt ${formaterDato(b.kjopsdato)}` : null)));
  } else {
    ut.push(liten('Legg inn kjøpspris og kjøpsdato, så får du totalkostnad og et grovt verdianslag.'));
  }
  ut.push(lenkekort('Biløkonomi', 'Utgifter per post og per år, totalkostnad og verdianslag.', '/bilokonomi'));
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
    lenkekort('Alle kjøretøydata fra Statens vegvesen', 'Vekter, motor, dimensjoner og mer. Her endrer eller fjerner du også bilen.', '/min-side'),
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

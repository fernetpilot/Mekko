// Byggeklosser for fanene i «Bilen din»: fliser, fristlister og lenkekort.
// Bare DOM-hjelpere. All beregning ligger i de rene modulene i /js/.
import { formaterDato, formaterKm } from '/js/bilstatus.js';

export const STATUS_TEKST = { ok: 'OK', snart: 'Snart', forfalt: 'Bør gjøres', utsatt: 'Utsatt', ukjent: 'Sjekk' };
export const KILDE_TEKST = { eu: 'EU-kontroll', service: 'Service', slitasje: 'Slitasje' };

export function el(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
}

export function flis(etikett, verdi, under, status = 'noytral') {
  const d = el('div', `bil-flis ${status}`);
  d.append(el('p', 'flis-etikett', etikett), el('p', 'flis-verdi', verdi));
  if (under) d.append(el('p', 'flis-under', under));
  return d;
}

export function fliser(...barn) {
  const d = el('div', 'bil-fliser');
  d.append(...barn.filter(Boolean));
  return d;
}

export function kmIgjen(k) {
  if (k == null) return '';
  return k > 0 ? `${formaterKm(k)} igjen` : `${formaterKm(-k)} over`;
}

export function dagerTekst(d) {
  if (d == null) return '';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d > 0) return `om ${d} dager`;
  return d === -1 ? 'i går' : `${-d} dager siden`;
}

/** Linje under navnet: dato, km og hvor lenge det er igjen. */
export function fristLinje(f) {
  if (f.kilde === 'eu') return [f.dato && formaterDato(f.dato), dagerTekst(f.dagerIgjen)].filter(Boolean).join(' · ');
  if (f.id === 'dekk') return f.tekst || 'Dekkene ser fine ut';
  if (f.id === 'dekkskift') return f.tekst ?? '';
  if (f.status === 'ukjent') return 'Ikke registrert ennå';
  // Dato med nedtelling, som på EU-kontrollen, og km hvis punktet også har km-grense
  return [f.dato && formaterDato(f.dato), dagerTekst(f.dagerIgjen), f.km != null && `ved ${formaterKm(f.km)}`, kmIgjen(f.kmIgjen)]
    .filter(Boolean).join(' · ');
}

/** Lenke til et ferdig filtrert finn.no-søk etter delen (åpnes i ny fane). */
export function finnKnapp(href, tekst = 'Søk på finn.no ↗') {
  const a = el('a', 'bil-knapp bil-finn', tekst);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

export function fristRad(f, { utsett } = {}) {
  const li = el('li', `frist ${f.status}`);
  li.dataset.punkt = f.id;
  li.append(el('span', 'prikk'));
  const t = el('div', 'liste-tekst');
  t.append(el('strong', null, f.navn), el('span', 'liste-under', fristLinje(f)));
  li.append(t, el('span', 'merke', f.status === 'ok' ? KILDE_TEKST[f.kilde] : STATUS_TEKST[f.status]));
  // Slitasjedeler som snart bør byttes kan utsettes («snooze»)
  if (utsett && f.kanUtsette && f.utsettTekst) {
    const k = el('button', 'knapp sekundaer bil-utsett', f.utsettTekst);
    k.type = 'button';
    k.addEventListener('click', () => utsett(f, k));
    const rad = el('div', 'bil-utsett-rad');
    rad.append(k);
    li.append(rad);
  }
  return li;
}

/** Kort med overskrift og en liste med frister. */
export function fristListe(tittel, frister, klasse = '', valg = {}) {
  const s = el('section', `bil-kort ${klasse}`);
  if (tittel) s.append(el('h3', null, tittel));
  if (valg.ingress) s.append(liten(valg.ingress));
  const ul = el('ul', 'bil-liste');
  ul.append(...frister.map((f) => fristRad(f, valg)));
  s.append(ul);
  return s;
}

/** Lenke til en underside, med valgt bil. */
export function lenkekort(bil, tittel, tekst, href) {
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

/** Små knapper på rad (lenker videre), med valgt bil. */
export function knapperad(bil, lenker) {
  const d = el('div', 'bil-knapperad');
  for (const [tekst, href] of lenker) {
    const a = el('a', 'bil-knapp', tekst);
    const url = new URL(href, location.origin);
    url.searchParams.set('bil', bil.id);
    a.href = url.pathname + url.search;
    d.append(a);
  }
  return d;
}

export function liten(tekst) { return el('p', 'bil-liten', tekst); }
export function ansvar(tekst) { return el('p', 'bil-ansvar', tekst); }

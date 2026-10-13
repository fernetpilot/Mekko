// Fanen «Vedlikehold» i «Bilen din»: alt som er gjort med bilen, per år, med vedlegg.
// Gruppering og summer ligger i dashboard.js (ren og testet).
import { supabase } from '/js/supabase.js';
import { formaterDato, formaterKm } from '/js/bilstatus.js';
import { signerteLenker } from '/js/dokumenter.js';
import { formaterKr, hendelseTittel, vedlikeholdOversikt } from '/js/dashboard.js';
import { kategoriListe } from '/js/kategori-visning.js';
import { el, flis, fliser, knapperad, liten } from './bil-visning.js';

function hendelse(h) {
  const li = el('li', 'bil-jobb');
  const hode = el('div', 'jobb-hode');
  hode.append(el('time', null, formaterDato(h.dato)));
  if (h.kostnad != null) hode.append(el('span', 'jobb-kost', formaterKr(h.kostnad)));
  // Endre eller slette registreringen (på registreringssiden)
  const endre = el('a', 'jobb-endre', 'Endre');
  endre.href = `/registrer-vedlikehold?endre=${encodeURIComponent(h.id)}`;
  endre.setAttribute('aria-label', `Endre ${hendelseTittel(h)} ${formaterDato(h.dato)}`);
  hode.append(endre);
  li.append(hode, el('strong', 'jobb-tittel', hendelseTittel(h)), kategoriListe(h));

  const info = [h.kilometerstand != null && formaterKm(h.kilometerstand), h.utfort_av].filter(Boolean).join(' · ');
  if (info) li.append(el('p', 'jobb-info', info));
  if (h.notat) li.append(el('p', 'jobb-notat', h.notat));

  const dok = h.dokumenter ?? [];
  if (dok.length) {
    const liste = el('div', 'jobb-vedlegg');
    for (const d of dok) {
      const a = el('a', 'vedlegg-chip');
      a.dataset.filsti = d.filsti;
      a.setAttribute('aria-disabled', 'true');   // lenken kommer når den er hentet
      a.append(el('span', 'chip-ikon', d.mimetype === 'application/pdf' ? 'PDF' : 'Bilde'), el('span', 'chip-navn', d.filnavn));
      liste.append(a);
    }
    li.append(liste);
  }
  return li;
}

/** Vedleggene er private: hent midlertidige lenker og sett dem på når de kommer. */
async function hentVedlegg(container) {
  const chips = [...container.querySelectorAll('.vedlegg-chip[data-filsti]')];
  if (!chips.length) return;
  try {
    const lenker = await signerteLenker(supabase, chips.map((c) => c.dataset.filsti));
    for (const c of chips) {
      const url = lenker[c.dataset.filsti];
      if (!url) continue;
      c.href = url;
      c.target = '_blank';
      c.rel = 'noopener';
      c.removeAttribute('aria-disabled');
    }
  } catch {
    container.querySelector('.jobb-melding')?.replaceChildren('Kunne ikke hente vedleggene akkurat nå.');
  }
}

export function vedlikeholdFane(bil) {
  const o = vedlikeholdOversikt(bil.vedlikehold ?? []);
  const ut = [fliser(
    flis('Jobber registrert', String(o.antall), o.aar.length ? `Fra ${o.aar.at(-1).aar} til ${o.aar[0].aar}` : 'Ingen ennå'),
    flis('Totalt brukt', formaterKr(o.totalKostnad),
      !o.antall ? 'Ingen beløp ennå' : o.medKostnad < o.antall ? `${o.medKostnad} av ${o.antall} har beløp` : 'Alle jobbene'),
  )];
  ut.push(knapperad(bil, [['Servicehefte (PDF)', '/servicehefte'], ['Importer historikk', '/importer-historikk']]));

  if (!o.antall) {
    const k = el('section', 'bil-kort');
    k.append(el('h3', null, 'Ingen vedlikehold ennå'),
      liten('Registrer service, dekkskift og reparasjoner etter hvert, eller importer historikken du har fra før.'));
    ut.push(k);
    return ut;
  }

  const aar = el('div', 'bil-aar');
  aar.append(el('p', 'jobb-melding bil-liten'));
  o.aar.forEach((a, i) => {
    const d = el('details', 'bil-aar-gruppe');
    d.open = i === 0;    // nyeste år åpent, resten lukket
    const sum = el('summary');
    sum.append(el('span', 'aar-tall', a.aar),
      el('span', 'aar-sum', `${a.hendelser.length} ${a.hendelser.length === 1 ? 'jobb' : 'jobber'} · ${a.hendelser.some((h) => h.kostnad != null) ? formaterKr(a.sum) : 'ingen beløp'}`));
    const ol = el('ol', 'bil-jobber');
    ol.append(...a.hendelser.map(hendelse));
    d.append(sum, ol);
    aar.append(d);
  });
  ut.push(aar);
  hentVedlegg(aar);
  return ut;
}

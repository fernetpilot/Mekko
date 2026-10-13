// Fanen «Service og EU» i «Bilen din»: alt som kommer de neste 12 månedene.
// Beregningen ligger i dashboard.js (ren og testet).
import { supabase } from '/js/supabase.js';
import { formaterDato, formaterKm } from '/js/bilstatus.js';
import { utsettelseFor } from '/js/slitasje.js';
import { alleFrister, aarshjul, nesteService, slitasjeOppsummering } from '/js/dashboard.js';
import {
  STATUS_TEKST, ansvar, dagerTekst, el, flis, fliser, fristListe, fristRad, kmIgjen, liten,
} from './bil-visning.js';

const stor = (t) => t && t[0].toUpperCase() + t.slice(1);

/** De to flisene øverst: neste service og dekk/slitasje. Brukes også på Oversikt. */
export function serviceFliser(frister) {
  const service = nesteService(frister);
  const slitasje = slitasjeOppsummering(frister);
  const serviceFlis = service
    ? flis('Neste service', service.navn,
      service.status === 'forfalt'
        ? `Burde vært gjort ${[service.dato && formaterDato(service.dato), service.km != null && `ved ${formaterKm(service.km)}`].filter(Boolean).join(' eller ')}`
        : [service.dato && formaterDato(service.dato), kmIgjen(service.kmIgjen)].filter(Boolean).join(' · '),
      service.status)
    : flis('Neste service', 'Ingen plan ennå',
      frister.some((f) => f.kilde === 'service')
        ? 'Registrer siste service, så regner vi ut neste'
        : 'Serviceplan finnes foreløpig bare for Discovery 3',
      'ukjent');
  const slitasjeFlis = flis('Dekk og slitasje',
    slitasje.status === 'ukjent' ? 'Ikke registrert'
      : slitasje.deler.length ? slitasje.deler.map((d) => d.navn).join(', ') : 'Alt ser bra ut',
    slitasje.status === 'ukjent' ? 'Registrer dekk og bremser'
      : slitasje.deler.length
        ? STATUS_TEKST[slitasje.status] + (slitasje.deler[0].kmIgjen != null ? ` · ${kmIgjen(slitasje.deler[0].kmIgjen)}` : '')
        : 'Bremser, filter og dekk',
    slitasje.status);
  return fliser(serviceFlis, slitasjeFlis);
}

/** «Utsett»: lagrer en utsettelse for slitasjedelen og tegner fanen på nytt. */
function utsetter(bil, ctx) {
  return async (f, knapp) => {
    const kmNaa = bil.kilometerstand ?? null;
    if (f.id === 'bremseklosser' && kmNaa == null) {
      return alert('Legg inn kilometerstanden på bilen først, så vi vet når vi skal minne deg på igjen.');
    }
    const rad = utsettelseFor(f.id, { kmNaa, idag: new Date().toISOString().slice(0, 10) });
    if (!rad) return;
    knapp.disabled = true;
    const { error } = await supabase.from('utsettelser').insert({ ...rad, bil_id: bil.id });
    if (error) {
      knapp.disabled = false;
      return alert('Kunne ikke utsette. Prøv igjen.');
    }
    ctx?.oppdater?.();
  };
}

export function serviceFane(bil, idag, ctx) {
  const frister = alleFrister(bil, idag);
  const valg = { utsett: utsetter(bil, ctx) };
  const hjul = aarshjul(frister, idag);
  const eu = frister.find((f) => f.id === 'eu');
  const ut = [serviceFliser(frister)];

  if (eu?.dato && eu.dagerIgjen != null) {
    ut.push(liten(eu.dagerIgjen < 0
      ? `EU-kontrollen gikk ut for ${-eu.dagerIgjen} dager siden.`
      : `EU-kontroll ${dagerTekst(eu.dagerIgjen)} (${formaterDato(eu.dato)}).`));
  }

  if (hjul.forfalt.length) ut.push(fristListe('Bør gjøres nå', hjul.forfalt, 'forfalt-kort', valg));

  // Årshjulet: måneder med noe i får eget kort, tomme måneder samles på én linje
  const s = el('section', 'bil-aarshjul');
  s.append(el('h3', 'bil-overskrift', 'De neste 12 månedene'));
  const ol = el('ol', 'bil-maaneder');
  let tomme = [];
  const tommeLinje = () => {
    if (!tomme.length) return;
    const li = el('li', 'maaned tom');
    li.append(el('p', 'bil-liten', `${tomme.length === 1 ? stor(tomme[0]) : `${stor(tomme[0])} – ${tomme.at(-1)}`}: ingenting`));
    ol.append(li);
    tomme = [];
  };
  hjul.maaneder.forEach((m, i) => {
    if (!m.frister.length) { tomme.push(m.navn); return; }
    tommeLinje();
    const li = el('li', `maaned${i === 0 ? ' denne' : ''}`);
    const hode = el('div', 'maaned-hode');
    hode.append(el('h4', null, stor(m.navn)));
    if (i === 0) hode.append(el('span', 'maaned-naa', 'Nå'));
    const ul = el('ul', 'bil-liste');
    ul.append(...m.frister.map((f) => fristRad(f, valg)));
    li.append(hode, ul);
    ol.append(li);
  });
  tommeLinje();
  if (hjul.maaneder.every((m) => !m.frister.length)) {
    ol.replaceChildren(el('li', 'maaned tom', 'Ingen kjente frister de neste 12 månedene. Registrer vedlikehold, så fyller oversikten seg.'));
  }
  s.append(ol);
  ut.push(s);

  if (hjul.utenDato.length) ut.push(fristListe('Etter kilometerstand og slitasje', hjul.utenDato, '', valg));
  if (hjul.senere.length) ut.push(fristListe('Senere', hjul.senere));
  if (hjul.ukjent.length) {
    const k = el('section', 'bil-kort');
    k.append(el('h3', null, 'Mangler registrering'),
      liten('Vi vet ikke når disse sist ble gjort. Registrer dem, så kommer de med i oversikten.'),
      el('p', 'bil-ukjente', hjul.ukjent.map((f) => f.navn).join(' · ')));
    ut.push(k);
  }
  ut.push(ansvar('Fristene er veiledende og bygger på det du har registrert. Sjekk servicehefte og vognkort, og se vegvesen.no for EU-kontroll.'));
  return ut;
}

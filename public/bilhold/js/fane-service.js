// Fanen «Service og EU» i «Bilen din»: alt som kommer de neste 12 månedene.
// Beregningen ligger i dashboard.js (ren og testet).
import { supabase } from '/js/supabase.js';
import { formaterDato, formaterKm } from '/js/bilstatus.js';
import { utsettelseFor } from '/js/slitasje.js';
import { alleFrister, aarshjul, nesteService, slitasjeOppsummering } from '/js/dashboard.js';
import { etterBoka } from '/js/etter-boka.js';
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

const intervallTekst = (h) => [h.kmIntervall != null && `${formaterKm(h.kmIntervall)}`,
  h.manederIntervall != null && `${h.manederIntervall} mnd`].filter(Boolean).join(' eller ');
const mnd = (m) => `${String(m).replace('.', ',')} mnd`;
const aar = (iso) => iso.slice(0, 4);

/** Én stolpe: hvor stor del av anbefalt intervall som gikk før jobben ble gjort (100 % = streken). */
function stolpeRad(x, skala) {
  // Siden siste bytte: stiplet, men i samme farge som om jobben ble gjort i dag
  const li = el('li', `boka-rad ${x.status}${x.apen ? ' apen' : ''}`);
  const tittel = x.apen ? `Siden siste bytte (${aar(x.fra)})`
    : x.fraNy ? `Fra ny (${aar(x.fra)}) – ${aar(x.til)}` : `${aar(x.fra)} – ${aar(x.til)}`;
  const pst = (a) => (a == null ? '' : ` (${Math.round(a * 100)} %)`);
  const tall = [x.km != null && formaterKm(x.km) + pst(x.andelKm), mnd(x.maneder) + pst(x.andelTid)]
    .filter(Boolean).join(' · ');
  const tekst = el('div', 'boka-tekst');
  tekst.append(el('span', null, tittel), el('span', 'boka-tall', x.andel == null ? `${tall} · mangler km` : tall));
  const spor = el('div', 'boka-spor');
  spor.style.setProperty('--grense', `${100 / skala}%`);
  const fyll = el('span', 'boka-fyll');
  fyll.style.width = `${Math.min(100, ((x.andel ?? 0) / skala) * 100)}%`;
  spor.append(fyll);
  li.append(tekst, spor);
  return li;
}

function snittFlis(etikett, verdi, under, status) {
  const f = el('div', `boka-snitt-flis ${status}`);
  f.append(el('span', 'boka-snitt-etikett', etikett), el('span', 'boka-snitt-verdi', verdi), el('span', 'boka-snitt-under', under));
  return f;
}

/** «Fulgt etter boka?»: per del, alle utførte jobber mot anbefalt intervall. Null uten historikk. */
function etterBokaSeksjon(bil, idag) {
  const o = etterBoka(bil, idag);
  if (!o.punkter.length) return null;
  const s = el('section', 'bil-etter-boka');
  s.id = 'etter-boka';
  s.append(el('h3', 'bil-overskrift', 'Fulgt etter boka?'));
  s.append(liten(o.maalt
    ? `${o.iTide} av ${o.maalt} bytter er gjort i tide. Trykk på en del for å se hver jobb.`
    : 'Registrer minst to jobber på samme del, så ser du om den er byttet så ofte som anbefalt.'));
  for (const h of o.punkter) {
    const d = el('details', 'bil-kort boka-punkt');
    d.dataset.punkt = h.id;
    const sum = el('summary');
    const navn = el('span', 'boka-navn');
    navn.append(el('strong', null, h.navn));
    const snitt = [h.snittKm != null && formaterKm(h.snittKm), h.snittManeder != null && mnd(h.snittManeder)].filter(Boolean);
    if (snitt.length) navn.append(el('span', 'boka-snitt-kort', `Snitt ${snitt.join(' · ')}`));
    sum.append(navn, el('span', `merke ${h.status}`,
      h.maalt ? `${h.iTide} av ${h.maalt} i tide` : `${h.jobber.length} registrert`));
    d.append(sum);
    // Snittet mellom byttene, stort, med anbefalt verdi under
    const tall = el('div', 'boka-snitt');
    if (h.kmIntervall != null) tall.append(snittFlis('Snitt km mellom bytter', h.snittKm != null ? formaterKm(h.snittKm) : '–',
      `Anbefalt ${formaterKm(h.kmIntervall)}`, h.snittStatusKm));
    if (h.manederIntervall != null) tall.append(snittFlis('Snitt tid mellom bytter', h.snittManeder != null ? mnd(h.snittManeder) : '–',
      `Anbefalt ${h.manederIntervall} mnd`, h.snittStatusTid));
    d.append(tall);
    if (h.snittKm == null && h.snittManeder == null) d.append(liten('Snittet kommer når delen er registrert byttet minst to ganger.'));
    const rader = [...h.intervaller, ...(h.naa ? [h.naa] : [])];
    if (rader.length) {
      // Skalaen går minst til 150 %, så streken for anbefalt intervall står på samme sted
      // og høyst til 250 %, så én veldig lang stolpe ikke klemmer de andre (den fyller da hele bredden)
      const skala = Math.min(2.5, Math.max(1.5, ...rader.map((x) => x.andel ?? 0)));
      const ol = el('ol', 'boka-stolper');
      ol.setAttribute('aria-label', `${h.navn}: tid mellom hver jobb, i prosent av anbefalt intervall`);
      ol.append(...rader.map((x) => stolpeRad(x, skala)));
      d.append(ol, liten('Streken er anbefalt intervall. Km: grønn inntil intervallet, gul inntil 20 % over. Tid: grønn inntil 20 % over, gul inntil 60 % over. Mer enn det er rødt. Stiplet: tiden siden siste bytte.'));
    }
    const jobber = el('p', 'bil-liten', `Utført: ${h.jobber.map((j) =>
      [formaterDato(j.dato), j.km != null && formaterKm(j.km)].filter(Boolean).join(', ')).join(' · ')}`);
    d.append(jobber);
    s.append(d);
  }
  return s;
}

/** Trykk på en del i listene over åpner historikken for den delen. */
function lenkTilBoka(ut) {
  const boka = ut.find((x) => x.id === 'etter-boka');
  if (!boka) return;
  for (const seksjon of ut) {
    seksjon.querySelectorAll?.('li.frist[data-punkt]').forEach((li) => {
      const d = boka.querySelector(`details[data-punkt="${li.dataset.punkt}"]`);
      if (!d) return;
      li.classList.add('har-boka');
      li.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        d.open = true;
        d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
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
  // Deler vi ikke vet når sist ble gjort: bør gjennomføres eller sjekkes
  if (hjul.ukjent.length) ut.push(fristListe('Bør gjennomføres eller sjekkes', hjul.ukjent, 'sjekk-kort', {
    ingress: 'Vi vet ikke når disse sist ble gjort. Sjekk serviceheftet og registrer dem, så får de riktig frist.',
  }));

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
  const boka = etterBokaSeksjon(bil, idag);
  if (boka) ut.push(boka);
  lenkTilBoka(ut);
  ut.push(ansvar('Fristene er veiledende og bygger på det du har registrert. Sjekk servicehefte og vognkort, og se vegvesen.no for EU-kontroll.'));
  return ut;
}

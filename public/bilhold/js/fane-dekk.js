// Fanen «Dekk» i «Bilen din»: dekksettene, når det bør byttes, og skjemaer for dekkskift og dekksett.
// Reglene ligger i dekk.js (ren og testet). Her tegnes fanen og lagres endringer.
import { supabase } from '/js/supabase.js';
import { formaterDato } from '/js/bilstatus.js';
import { normaliserStatus } from '/js/dashboard.js';
import {
  REGIONER, dekkPaBilen, dekkskift, settNavn, settType, typeFraValg, valgFraType, vurderSett,
} from '/js/dekk.js';
import { ansvar, el, flis, fliser, liten } from './bil-visning.js';

/** Dagens dato i norsk tid som YYYY-MM-DD. */
function dagTekst(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const tallEllerNull = (v) => (v === '' ? null : Number(v));

/** Lager et skjemafelt: <label>Tekst <input …></label> */
function felt(tekst, attr, tag = 'input') {
  const l = el('label', null, tekst);
  const f = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) f.setAttribute(k, v);
  l.append(f);
  return l;
}
function rad(...felter) {
  const d = el('div', 'to-kolonner');
  d.append(...felter);
  return d;
}
function knapp(tekst, klasse = 'bil-hovedknapp', type = 'button') {
  const k = el('button', klasse, tekst);
  k.type = type;
  return k;
}

/**
 * @param {object} bil
 * @param {Date} idag
 * @param {{ oppdater: () => Promise<void>, dekksettOk: boolean }} ctx
 */
export function dekkFane(bil, idag, ctx) {
  if (!ctx.dekksettOk) {
    const k = el('section', 'bil-kort');
    k.append(el('h3', null, 'Dekksett er ikke klart ennå'),
      liten('Databasen mangler tabellen for dekksett. Kjør supabase/07-dekksett.sql i Supabase SQL Editor.'));
    return [k];
  }
  const iDag = dagTekst(idag);
  const sett = bil.dekksett ?? [];
  const pa = dekkPaBilen(sett);
  const tilstand = pa ? vurderSett(pa, iDag) : null;
  const skift = dekkskift({ type: pa?.type ?? null, pigg: pa?.pigg, region: bil.dekk_region ?? 'sor', idag: iDag });
  const melding = el('p', 'bil-melding');
  melding.setAttribute('role', 'status');
  const vis = (tekst, type = '') => { melding.textContent = tekst; melding.className = `bil-melding ${type}`; };

  const ut = [fliser(
    flis('Neste dekkskift', skift.bytteTil === 'vinter' ? 'Vinterdekk' : skift.bytteTil === 'sommer' ? 'Sommerdekk' : 'Ukjent',
      skift.tekst, skift.status),
    pa
      ? flis('På bilen nå', settType(pa),
        tilstand.tekst || [pa.dimensjon, pa.montert && `Montert ${formaterDato(pa.montert)}`].filter(Boolean).join(' · ') || 'Mønster og alder ser bra ut',
        normaliserStatus(tilstand.status))
      : flis('På bilen nå', 'Ikke valgt', 'Legg til dekksett og kryss av for det som står på', 'ukjent'),
  )];

  // Knapper og skjemaer (bare ett skjema åpent om gangen)
  const knapper = el('div', 'bil-knapperad');
  const visBytte = knapp('Registrer dekkskift');
  const visNytt = knapp('+ Legg til dekksett', 'bil-knapp');
  if (sett.some((s) => !s.pa_bilen)) knapper.append(visBytte);
  knapper.append(visNytt);
  const skjemaplass = el('div');
  ut.push(knapper, melding, skjemaplass);

  const lukk = () => skjemaplass.replaceChildren();
  const apne = (skjema) => {
    skjemaplass.replaceChildren(skjema);
    skjema.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Tar av dekksettet som står på nå (hvis det ikke er `unntak`). Kun ett sett kan stå på. */
  async function taAvNaavaerende(unntak, ekstra = {}) {
    const naa = dekkPaBilen(bil.dekksett);
    if (!naa || naa.id === unntak) return null;
    return (await supabase.from('dekksett').update({ pa_bilen: false, ...ekstra }).eq('id', naa.id)).error;
  }

  // ---------- Dekkskift ----------
  visBytte.addEventListener('click', () => {
    const f = el('form', 'bil-kort bil-skjema');
    f.autocomplete = 'off';
    const kandidater = sett.filter((s) => !s.pa_bilen);
    const forslag = kandidater.find((s) => s.type !== pa?.type) ?? kandidater[0];
    const valg = felt('Dekk som settes på', { name: 'sett', required: '' }, 'select');
    for (const s of kandidater) {
      const o = new Option(settNavn(s), s.id);
      o.selected = s === forslag;
      valg.querySelector('select').append(o);
    }
    f.append(el('h3', null, 'Registrer dekkskift'), valg,
      rad(felt('Dato', { name: 'dato', type: 'date', required: '', value: iDag }),
        felt('Kilometerstand', { name: 'km', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: bil.kilometerstand ?? '' })));
    if (pa) {
      f.append(felt('Mønsterdybde på dekkene som tas av (mm)',
        { name: 'av_mm', type: 'number', min: '0', max: '20', step: '0.1', inputmode: 'decimal', placeholder: 'Valgfritt' }));
    }
    f.append(rad(felt('Kostnad (kr)', { name: 'kostnad', type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: 'Valgfritt' }),
      felt('Utført av', { name: 'utfort_av', maxlength: '100', placeholder: 'Selv, verksted …' })),
    liten('Dekkskiftet lagres også i vedlikeholdshistorikken.'));
    const lagre = knapp('Lagre dekkskift', 'bil-hovedknapp', 'submit');
    const avbryt = knapp('Avbryt', 'bil-knapp');
    avbryt.addEventListener('click', lukk);
    f.append(lagre, avbryt);

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ny = sett.find((s) => s.id === f.sett.value);
      if (!ny) return;
      const dato = f.dato.value;
      const km = tallEllerNull(f.km.value);
      const avMm = f.av_mm ? tallEllerNull(f.av_mm.value) : null;
      lagre.disabled = true;
      try {
        // 1. Ta av de gamle (og lagre mønsterdybden hvis den ble målt)
        const feil = await taAvNaavaerende(ny.id, avMm != null ? { monsterdybde_mm: avMm, maalt: dato } : {});
        if (feil) throw feil;
        // 2. Sett på de nye
        const { error: feil2 } = await supabase.from('dekksett').update({ pa_bilen: true, montert: dato }).eq('id', ny.id);
        if (feil2) throw feil2;
        // 3. I vedlikeholdshistorikken (og biløkonomien)
        const { error: feil3 } = await supabase.from('vedlikehold').insert({
          bil_id: bil.id,
          komponent: 'dekk',
          servicepunkter: ['dekkskift'], // id fra servicekatalog.js
          dato,
          kilometerstand: km,
          kostnad: tallEllerNull(f.kostnad.value),
          utfort_av: f.utfort_av.value.trim() || null,
          notat: `Dekkskift: ${settNavn(ny).toLowerCase()} på`,
        });
        if (feil3) throw feil3;
        // 4. Nyere kilometerstand på bilen
        if (km != null && km > (bil.kilometerstand ?? -1)) {
          await supabase.from('biler').update({ kilometerstand: km, kilometerstand_dato: dato }).eq('id', bil.id);
        }
        await ctx.oppdater();
      } catch (err) {
        console.error('Dekkskift: kunne ikke lagre', err);
        vis('Kunne ikke lagre dekkskiftet. Prøv igjen.', 'feil');
        lagre.disabled = false;
      }
    });
    apne(f);
  });

  // ---------- Nytt eller endre dekksett ----------
  function settSkjema(s = null) {
    const f = el('form', 'bil-kort bil-skjema');
    f.autocomplete = 'off';
    const type = felt('Type', { name: 'valg' }, 'select');
    for (const [v, t] of [['sommer', 'Sommerdekk'], ['vinter', 'Vinterdekk (piggfrie)'], ['vinter-pigg', 'Vinterdekk med pigg']]) {
      type.querySelector('select').append(new Option(t, v));
    }
    const paBilen = el('label', 'avkrysning');
    const boks = document.createElement('input');
    boks.type = 'checkbox';
    boks.name = 'pa_bilen';
    paBilen.append(boks, ' Står på bilen nå');
    f.append(el('h3', null, s ? 'Endre dekksett' : 'Legg til dekksett'), type,
      rad(felt('Dimensjon', { name: 'dimensjon', maxlength: '40', placeholder: 'f.eks. 205/55R16' }),
        felt('Produksjonsår', { name: 'produksjonsaar', type: 'number', min: '1980', max: '2100', step: '1', inputmode: 'numeric', placeholder: 'f.eks. 2021' })),
      liten('Produksjonsåret står i DOT-koden på dekksiden: de to siste sifrene, f.eks. 2321 = uke 23 i 2021.'),
      rad(felt('Mønsterdybde (mm)', { name: 'monsterdybde_mm', type: 'number', min: '0', max: '20', step: '0.1', inputmode: 'decimal' }),
        felt('Målt', { name: 'maalt', type: 'date' })),
      felt('Lagres hvor?', { name: 'lagring', maxlength: '100', placeholder: 'Garasjen, dekkhotell hos …' }),
      paBilen,
      felt('Notat', { name: 'notat', rows: '2', maxlength: '300' }, 'textarea'));
    const lagre = knapp('Lagre dekksett', 'bil-hovedknapp', 'submit');
    const avbryt = knapp('Avbryt', 'bil-knapp');
    avbryt.addEventListener('click', lukk);
    f.append(lagre, avbryt);

    // Nytt sett: foreslå typen som mangler
    f.valg.value = s ? valgFraType(s) : sett.some((x) => x.type === 'sommer') ? 'vinter' : 'sommer';
    f.dimensjon.value = s?.dimensjon ?? pa?.dimensjon ?? '';
    f.produksjonsaar.value = s?.produksjonsaar ?? '';
    f.monsterdybde_mm.value = s?.monsterdybde_mm ?? '';
    f.maalt.value = s?.maalt ?? '';
    f.lagring.value = s?.lagring ?? '';
    f.pa_bilen.checked = s ? s.pa_bilen : !pa;
    f.notat.value = s?.notat ?? '';

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mm = tallEllerNull(f.monsterdybde_mm.value);
      const endring = {
        ...typeFraValg(f.valg.value),
        dimensjon: f.dimensjon.value.trim() || null,
        produksjonsaar: tallEllerNull(f.produksjonsaar.value),
        monsterdybde_mm: mm,
        // Ny mønsterdybde uten dato: målt i dag
        maalt: f.maalt.value || (mm != null && mm !== Number(s?.monsterdybde_mm ?? NaN) ? iDag : null),
        lagring: f.lagring.value.trim() || null,
        pa_bilen: f.pa_bilen.checked,
        notat: f.notat.value.trim() || null,
      };
      lagre.disabled = true;
      try {
        if (endring.pa_bilen) {
          const feil = await taAvNaavaerende(s?.id);
          if (feil) throw feil;
        }
        const { error } = s
          ? await supabase.from('dekksett').update(endring).eq('id', s.id)
          : await supabase.from('dekksett').insert({ ...endring, bil_id: bil.id });
        if (error) throw error;
        await ctx.oppdater();
      } catch (err) {
        console.error('Dekksett: kunne ikke lagre', err);
        vis('Kunne ikke lagre dekksettet. Prøv igjen.', 'feil');
        lagre.disabled = false;
      }
    });
    apne(f);
  }
  visNytt.addEventListener('click', () => settSkjema());

  async function slettSett(s) {
    if (!confirm(`Slette ${settNavn(s).toLowerCase()}?`)) return;
    const { error } = await supabase.from('dekksett').delete().eq('id', s.id);
    if (error) return vis('Kunne ikke slette dekksettet. Prøv igjen.', 'feil');
    await ctx.oppdater();
  }

  // ---------- Dekksettene ----------
  if (sett.length) {
    const ul = el('ul', 'bil-sett');
    // På bilen først, så sommer før vinter
    for (const s of [...sett].sort((x, y) => Number(y.pa_bilen) - Number(x.pa_bilen) || x.type.localeCompare(y.type))) {
      const v = vurderSett(s, iDag);
      const li = el('li', `bil-kort sett ${normaliserStatus(v.status)}`);
      const hode = el('div', 'sett-hode');
      hode.append(el('h3', null, settType(s)), el('span', 'merke', s.pa_bilen ? 'På bilen' : 'Lagret'));
      li.append(hode);
      const dl = el('dl', 'bil-data');
      const fakta = [
        ['Dimensjon', s.dimensjon],
        ['Produksjonsår', s.produksjonsaar && `${s.produksjonsaar} (${Number(iDag.slice(0, 4)) - s.produksjonsaar} år)`],
        ['Mønsterdybde', s.monsterdybde_mm != null && `${String(s.monsterdybde_mm).replace('.', ',')} mm${s.maalt ? ` (målt ${formaterDato(s.maalt)})` : ''}`],
        ['Montert', s.pa_bilen && s.montert && formaterDato(s.montert)],
        ['Lagret', !s.pa_bilen && s.lagring],
      ];
      for (const [n, verdi] of fakta) {
        if (!verdi) continue;
        const d = el('div');
        d.append(el('dt', null, n), el('dd', null, verdi));
        dl.append(d);
      }
      if (dl.children.length) li.append(dl);
      if (v.tekst) li.append(el('p', 'sett-status', v.tekst));
      if (s.notat) li.append(liten(s.notat));
      const k = el('div', 'bil-knapperad');
      const endre = knapp('Endre', 'bil-knapp');
      endre.addEventListener('click', () => settSkjema(s));
      const slett = knapp('Slett', 'bil-knapp');
      slett.addEventListener('click', () => slettSett(s));
      k.append(endre, slett);
      li.append(k);
      ul.append(li);
    }
    ut.push(ul);
  } else {
    ut.push(liten('Ingen dekksett ennå. Legg inn sommer- og vinterdekkene, så sier vi fra når det er tid for å bytte.'));
  }

  // ---------- Hvor kjører du mest? ----------
  const region = el('section', 'bil-kort bil-skjema');
  const velg = felt('Hvor kjører du mest?', { name: 'region' }, 'select');
  const sel = velg.querySelector('select');
  for (const [verdi, navn] of Object.entries(REGIONER)) sel.append(new Option(navn, verdi));
  sel.value = bil.dekk_region ?? 'sor';
  sel.addEventListener('change', async () => {
    const { error } = await supabase.from('biler').update({ dekk_region: sel.value }).eq('id', bil.id);
    if (error) {
      console.error('Dekk: kunne ikke lagre region', error);
      return vis('Kunne ikke lagre hvor du kjører. Prøv igjen.', 'feil');
    }
    await ctx.oppdater();
  });
  region.append(velg, liten('Piggdekksesongen er lengre i nord. Vi bruker den til å si fra om dekkskift.'));
  ut.push(region);

  ut.push(ansvar('Datoene er veiledende. Piggdekk er lov fra 1. november til og med første søndag etter 2. påskedag '
    + '(Nordland, Troms og Finnmark: 16. oktober til 1. mai), og ellers når føret krever det. Vinterdekk skal ha minst 3 mm '
    + 'mønster om vinteren og sommerdekk minst 1,6 mm. Sjekk reglene på vegvesen.no.'));
  return ut;
}

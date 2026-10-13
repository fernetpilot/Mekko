// Fanen «Økonomi» i «Bilen din»: kjøpsopplysninger, nøkkeltall, verdianslag og diagrammer.
// Beregningene ligger i bilokonomi.js (ren og testet). Her tegnes fanen og lagres kjøpsopplysningene.
// Antakelsene for verdianslaget justeres i VERDI_ANTAKELSER i bilokonomi.js.
import { supabase } from '/js/supabase.js';
import { formaterDato } from '/js/bilstatus.js';
import { estimerVerdi, oppsummer } from '/js/bilokonomi.js';
import { ansvar, el, flis, fliser, liten } from './bil-visning.js';

const kr = (n) => `${Math.round(n).toLocaleString('nb-NO')} kr`;
const krKort = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} mill.`
  : Math.abs(n) >= 1000 ? `${Math.round(n / 1000).toLocaleString('nb-NO')}k` : String(Math.round(n)));
const farge = (k) => `var(--serie-${k})`;
const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attr = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
  return e;
};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// Verktøytips (hover på PC, trykk på mobil). Ett felles element for hele siden.
// ---------------------------------------------------------------------------
let tips = null;
function tipsEl() {
  if (!tips) {
    tips = el('div', 'viz-tips');
    tips.setAttribute('role', 'status');
    tips.hidden = true;
    document.body.append(tips);
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.treff')) skjulTips(); });
    document.getElementById('bil-panel')?.addEventListener('scroll', skjulTips, { passive: true });
  }
  return tips;
}
function visTips(e, html) {
  const t = tipsEl();
  t.innerHTML = html;
  t.hidden = false;
  const x = e.clientX ?? 0, y = e.clientY ?? 0;
  const b = t.offsetWidth, h = t.offsetHeight;
  t.style.left = `${Math.min(innerWidth - b - 8, Math.max(8, x - b / 2))}px`;
  t.style.top = `${Math.max(8, y - h - 14)}px`;
}
function skjulTips() { if (tips) tips.hidden = true; }
function medTips(e, html) {
  e.classList.add('treff');
  e.setAttribute('tabindex', '0');
  const vis = (ev) => visTips(ev, html);
  e.addEventListener('pointerenter', vis);
  e.addEventListener('pointermove', vis);
  e.addEventListener('pointerdown', vis);
  e.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') skjulTips(); });
  e.addEventListener('focus', () => { const r = e.getBoundingClientRect(); visTips({ clientX: r.x + r.width / 2, clientY: r.y }, html); });
  e.addEventListener('blur', skjulTips);
}

// ---------------------------------------------------------------------------
// Diagrammer
// ---------------------------------------------------------------------------
function diagramkort(tittel, under) {
  const k = el('section', 'bil-kort diagram');
  k.append(el('h3', null, tittel));
  if (under) k.append(liten(under));
  return k;
}

function kake(o) {
  const k = diagramkort('Fordeling per utgiftspost', o.total ? `${kr(o.total)} totalt` : null);
  if (!o.total) {
    k.append(liten('Ingen kostnader registrert ennå. Legg inn kostnad når du registrerer vedlikehold.'));
    return k;
  }
  const oppsett = el('div', 'kake-oppsett');
  const s = svg('svg', { viewBox: '0 0 200 200', role: 'img',
    'aria-label': `Fordeling: ${o.kategorier.map((x) => `${x.navn} ${Math.round(x.andel * 100)} %`).join(', ')}` });
  const cx = 100, cy = 100, r = 80, tykkelse = 26;
  let vinkel = -Math.PI / 2;
  for (const x of o.kategorier) {
    const bue = x.andel * Math.PI * 2;
    let sti;
    if (o.kategorier.length === 1) {
      sti = svg('circle', { cx, cy, r: r - tykkelse / 2, fill: 'none', 'stroke-width': tykkelse, stroke: farge(x.nokkel) });
    } else {
      const ytre = r, indre = r - tykkelse;
      const p = (rad, v) => [cx + rad * Math.cos(v), cy + rad * Math.sin(v)];
      const [x1, y1] = p(ytre, vinkel), [x2, y2] = p(ytre, vinkel + bue);
      const [x3, y3] = p(indre, vinkel + bue), [x4, y4] = p(indre, vinkel);
      const stor = bue > Math.PI ? 1 : 0;
      sti = svg('path', {
        d: `M${x1},${y1} A${ytre},${ytre} 0 ${stor} 1 ${x2},${y2} L${x3},${y3} A${indre},${indre} 0 ${stor} 0 ${x4},${y4} Z`,
        fill: farge(x.nokkel), stroke: '#16171a', 'stroke-width': 2, 'stroke-linejoin': 'round',
      });
    }
    medTips(sti, `<strong>${esc(x.navn)}</strong>${kr(x.sum)} · ${Math.round(x.andel * 100)} %`);
    s.append(sti);
    vinkel += bue;
  }
  const midt = svg('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'kake-midt-tall' });
  midt.textContent = krKort(o.total);
  const under = svg('text', { x: cx, y: cy + 20, 'text-anchor': 'middle' });
  under.textContent = 'kr totalt';
  s.append(midt, under);

  const liste = el('ul', 'tegnforklaring');
  for (const x of o.kategorier) {
    const li = el('li');
    const prikk = el('span', 'prikk');
    prikk.style.background = farge(x.nokkel);
    li.append(prikk, el('span', null, x.navn), el('span', 'belop', `${kr(x.sum)} · ${Math.round(x.andel * 100)} %`));
    liste.append(li);
  }
  oppsett.append(s, liste);
  k.append(oppsett);
  return k;
}

function fineSteg(maks) {
  if (maks <= 0) return [0, 1];
  const grov = maks / 3;
  const potens = 10 ** Math.floor(Math.log10(grov));
  const steg = [1, 2, 2.5, 5, 10].map((m) => m * potens).find((x) => x >= grov);
  return Array.from({ length: Math.ceil(maks / steg) + 1 }, (_, i) => i * steg);
}

const PLOT = { v: 40, h: 8, t: 10, b: 24, B: 340, H: 200 };
function tegnYakse(s, ticks, y) {
  for (const t of ticks) {
    s.append(svg('line', { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: y(t), y2: y(t), stroke: 'var(--rutenett)', 'stroke-width': 1 }));
    const tekst = svg('text', { x: PLOT.v - 6, y: y(t) + 3, 'text-anchor': 'end' });
    tekst.textContent = krKort(t);
    s.append(tekst);
  }
}

function stolper(o) {
  const k = diagramkort('Kostnader per år');
  if (!o.perAr.length || !o.total) {
    k.append(liten('Ingen kostnader per år å vise ennå.'));
    return k;
  }
  const s = svg('svg', { viewBox: '0 0 340 200', role: 'img',
    'aria-label': `Kostnader per år: ${o.perAr.map((p) => `${p.ar}: ${kr(p.sum)}`).join(', ')}` });
  const ticks = fineSteg(Math.max(...o.perAr.map((p) => p.sum)));
  const ymaks = ticks[ticks.length - 1];
  const bunn = PLOT.H - PLOT.b, topp = PLOT.t;
  const y = (v) => bunn - (v / ymaks) * (bunn - topp);
  tegnYakse(s, ticks, y);

  const n = o.perAr.length;
  const bredde = (PLOT.B - PLOT.h - PLOT.v) / n;
  const stolpe = Math.min(28, bredde - 2); // minst 2 px mellomrom
  const visHvert = Math.ceil(n / 8); // ikke flere enn ~8 årstall under aksen
  o.perAr.forEach((p, i) => {
    const x = PLOT.v + i * bredde + (bredde - stolpe) / 2;
    if (p.sum > 0) {
      const h = bunn - y(p.sum);
      const r = Math.min(4, h, stolpe / 2);
      // Avrundet topp, rett bunn mot grunnlinjen
      s.append(svg('path', {
        d: `M${x},${bunn} V${y(p.sum) + r} Q${x},${y(p.sum)} ${x + r},${y(p.sum)} H${x + stolpe - r} Q${x + stolpe},${y(p.sum)} ${x + stolpe},${y(p.sum) + r} V${bunn} Z`,
        fill: 'var(--serie-hoved)',
      }));
    }
    // Treffflate i hele kolonnens høyde, større enn stolpen
    const treff = svg('rect', { x: PLOT.v + i * bredde, y: topp, width: bredde, height: bunn - topp, fill: 'transparent' });
    medTips(treff, `<strong>${p.ar}</strong>${kr(p.sum)}`);
    s.append(treff);
    if (i % visHvert === 0 || i === n - 1) {
      const t = svg('text', { x: x + stolpe / 2, y: bunn + 14, 'text-anchor': 'middle' });
      t.textContent = n > 8 ? `’${String(p.ar).slice(2)}` : String(p.ar);
      s.append(t);
    }
  });
  s.append(svg('line', { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: bunn, y2: bunn, stroke: 'var(--akse)', 'stroke-width': 1 }));
  k.append(s);
  return k;
}

function kurve(o, idag, harKjopsdato) {
  const k = diagramkort('Akkumulerte kostnader', harKjopsdato ? 'Siden kjøp' : 'Legg inn kjøpsdato for å starte kurven ved kjøpet.');
  if (o.akkumulert.length < 2) {
    k.append(liten('Kurven vises når det er registrert kostnader.'));
    return k;
  }
  const tid = (d) => new Date(d).getTime();
  const punkter = [...o.akkumulert, { dato: idag.toISOString().slice(0, 10), sum: o.total, idag: true }];
  const t0 = tid(punkter[0].dato), t1 = Math.max(tid(punkter[punkter.length - 1].dato), t0 + 86400000);
  const ticks = fineSteg(o.total);
  const ymaks = ticks[ticks.length - 1];
  const bunn = PLOT.H - PLOT.b, topp = PLOT.t;
  const x = (d) => PLOT.v + ((tid(d) - t0) / (t1 - t0)) * (PLOT.B - PLOT.h - PLOT.v);
  const y = (v) => bunn - (v / ymaks) * (bunn - topp);
  const s = svg('svg', { viewBox: '0 0 340 200', role: 'img',
    'aria-label': `Akkumulerte kostnader fra ${formaterDato(punkter[0].dato)}: ${kr(o.total)} i dag` });
  tegnYakse(s, ticks, y);

  // Årstall langs x-aksen
  const forste = new Date(t0).getFullYear(), siste = new Date(t1).getFullYear();
  const hver = Math.ceil((siste - forste + 1) / 6);
  for (let ar = forste + 1; ar <= siste; ar += hver) {
    const t = svg('text', { x: x(`${ar}-01-01`), y: bunn + 14, 'text-anchor': 'middle' });
    t.textContent = String(ar);
    s.append(t);
  }

  // Trappekurve: kostnaden kommer på datoen, så linjen går flatt til neste post
  let d = `M${x(punkter[0].dato)},${y(punkter[0].sum)}`;
  for (let i = 1; i < punkter.length; i++) d += ` H${x(punkter[i].dato)} V${y(punkter[i].sum)}`;
  s.append(svg('path', { d: `${d} V${bunn} H${x(punkter[0].dato)} Z`, fill: 'var(--serie-hoved)', opacity: 0.12 }));
  s.append(svg('path', { d, fill: 'none', stroke: 'var(--serie-hoved)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  s.append(svg('line', { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: bunn, y2: bunn, stroke: 'var(--akse)', 'stroke-width': 1 }));
  s.append(svg('circle', { cx: x(punkter[punkter.length - 1].dato), cy: y(o.total), r: 4, fill: 'var(--serie-hoved)', stroke: '#16171a', 'stroke-width': 2 }));

  // Siktelinje og verktøytips: nærmeste punkt langs x-aksen
  const sikte = svg('line', { y1: topp, y2: bunn, stroke: 'var(--akse)', 'stroke-width': 1, visibility: 'hidden' });
  const markor = svg('circle', { r: 5, fill: 'var(--serie-hoved)', stroke: '#16171a', 'stroke-width': 2, visibility: 'hidden' });
  s.append(sikte, markor);
  const flate = svg('rect', { x: PLOT.v, y: topp, width: PLOT.B - PLOT.h - PLOT.v, height: bunn - topp, fill: 'transparent', class: 'treff' });
  const finn = (e) => {
    const r = s.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * PLOT.B;
    let best = punkter[0];
    for (const p of punkter) if (Math.abs(x(p.dato) - sx) < Math.abs(x(best.dato) - sx)) best = p;
    sikte.setAttribute('x1', x(best.dato)); sikte.setAttribute('x2', x(best.dato));
    markor.setAttribute('cx', x(best.dato)); markor.setAttribute('cy', y(best.sum));
    sikte.setAttribute('visibility', 'visible'); markor.setAttribute('visibility', 'visible');
    visTips(e, `<strong>${best.idag ? 'I dag' : esc(formaterDato(best.dato))}</strong>${kr(best.sum)} totalt`);
  };
  flate.addEventListener('pointermove', finn);
  flate.addEventListener('pointerdown', finn);
  flate.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') { skjulTips(); sikte.setAttribute('visibility', 'hidden'); markor.setAttribute('visibility', 'hidden'); }
  });
  s.append(flate);
  k.append(s);
  return k;
}

/** Tallene som tabell (tilgjengelig alternativ til diagrammene) */
function tabeller(o) {
  const d = el('details', 'bil-kort tabellvisning');
  d.append(el('summary', null, 'Vis tallene som tabell'));
  const tabell = (tittel, hoder, rader) => {
    const t = el('table');
    t.append(el('caption', null, tittel));
    const thead = el('thead');
    const tr = el('tr');
    tr.append(...hoder.map((h) => el('th', null, h)));
    thead.append(tr);
    const tbody = el('tbody');
    for (const r of rader) {
      const rad = el('tr');
      rad.append(...r.map((c) => el('td', null, c)));
      tbody.append(rad);
    }
    t.append(thead, tbody);
    return t;
  };
  d.append(
    tabell('Per utgiftspost', ['Post', 'Beløp'], [
      ...o.kategorier.map((x) => [x.navn, `${kr(x.sum)} (${Math.round(x.andel * 100)} %)`]),
      ['Totalt', kr(o.total)],
    ]),
    tabell('Per år', ['År', 'Beløp'], o.perAr.map((p) => [String(p.ar), kr(p.sum)])),
  );
  return d;
}

// ---------------------------------------------------------------------------
// Kjøpsopplysninger
// ---------------------------------------------------------------------------
function kjopsskjema(bil, ctx) {
  const mangler = !('kjopspris' in bil); // 06-bilokonomi.sql er ikke kjørt
  const harKjop = bil.kjopspris && bil.kjopsdato;
  const d = el('details', 'bil-kort bil-kjop');
  d.open = !harKjop;
  const sum = el('summary');
  sum.append(el('span', null, 'Kjøpsopplysninger'),
    el('span', 'bil-liten', mangler ? 'Ikke tilgjengelig' : harKjop ? `${kr(bil.kjopspris)} · ${formaterDato(bil.kjopsdato)}` : 'Ikke fylt ut'));
  d.append(sum);
  const melding = el('p', 'bil-melding');
  melding.setAttribute('role', 'status');
  if (mangler) {
    melding.textContent = 'Kjøpsopplysninger kan ikke lagres ennå: databasen mangler feltene. Kjør supabase/06-bilokonomi.sql i Supabase.';
    melding.className = 'bil-melding feil';
    d.append(melding);
    return d;
  }
  const f = el('form', 'bil-skjema');
  const felt = (tekst, attr) => {
    const l = el('label', null, tekst);
    const i = document.createElement('input');
    for (const [k, v] of Object.entries(attr)) i.setAttribute(k, v);
    l.append(i);
    return l;
  };
  const rad = el('div', 'to-kolonner');
  rad.append(felt('Kjøpsdato', { name: 'kjopsdato', type: 'date', required: '', value: bil.kjopsdato ?? '' }),
    felt('Km ved kjøp', { name: 'kjops_km', type: 'number', min: '0', inputmode: 'numeric', value: bil.kjops_km ?? '' }));
  const lagre = el('button', 'bil-hovedknapp', 'Lagre');
  lagre.type = 'submit';
  f.append(liten('Brukes til å regne kostnader siden kjøp og et grovt anslag på verdien i dag.'),
    felt('Kjøpspris (kr)', { name: 'kjopspris', type: 'number', min: '0', step: '1', inputmode: 'numeric', required: '', value: bil.kjopspris ?? '' }),
    rad, lagre, melding);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tall = (v) => (v === '' ? null : Number(v));
    const endring = { kjopspris: tall(f.kjopspris.value), kjopsdato: f.kjopsdato.value || null, kjops_km: tall(f.kjops_km.value) };
    lagre.disabled = true;
    const { error } = await supabase.from('biler').update(endring).eq('id', bil.id);
    if (error) {
      lagre.disabled = false;
      melding.textContent = 'Kunne ikke lagre. Har dere kjørt supabase/06-bilokonomi.sql i Supabase?';
      melding.className = 'bil-melding feil';
      return;
    }
    await ctx.oppdater();
  });
  d.append(f);
  return d;
}

// ---------------------------------------------------------------------------
// Fanen
// ---------------------------------------------------------------------------
export function okonomiFane(bil, idag, ctx) {
  const hendelser = bil.vedlikehold ?? [];
  const o = oppsummer(hendelser, { kjopsdato: bil.kjopsdato, kjopsKm: bil.kjops_km, kmNaa: bil.kilometerstand, idag });
  const verdi = estimerVerdi({
    kjopspris: bil.kjopspris, kjopsdato: bil.kjopsdato, kjopsKm: bil.kjops_km,
    kmNaa: bil.kilometerstand, forstegangsregistrert: bil.forstegangsregistrert, hendelser, idag,
  });
  const ut = [];

  if (verdi) {
    const verditap = bil.kjopspris - verdi.verdi;
    const totalt = verditap + o.total;
    const v = flis('Forventet markedsverdi', `ca. ${kr(verdi.verdi)}`, `Intervall ${kr(verdi.lav)} – ${kr(verdi.hoy)}`);
    v.classList.add('hoved');
    const steg = el('ul', 'verdisteg');
    verdi.steg.forEach((s, i) => {
      const li = el('li');
      li.append(el('span', null, s.tekst), el('span', null, i === 0 ? kr(s.verdi) : `${s.verdi >= 0 ? '+' : '−'} ${kr(Math.abs(s.verdi))}`));
      steg.append(li);
    });
    const sumLi = el('li', 'sum');
    sumLi.append(el('span', null, 'Anslag (avrundet)'), el('span', null, kr(verdi.verdi)));
    steg.append(sumLi);
    const forklaring = el('details');
    forklaring.append(el('summary', null, 'Slik er det regnet'), steg);
    v.append(forklaring);
    ut.push(fliser(v,
      flis('Totalkostnad', kr(totalt), o.ar >= 0.5 ? `${kr(totalt / o.ar)} per år, inkl. verditap` : `Verditap ${kr(verditap)}`),
      flis('Investert totalt', kr(Number(bil.kjopspris) + o.total), 'Kjøpspris + vedlikehold')));
  }

  ut.push(kjopsskjema(bil, ctx));

  ut.push(fliser(
    flis(bil.kjopsdato ? 'Brukt siden kjøp' : 'Brukt totalt', kr(o.total), `${o.antallMedKostnad} poster`),
    o.snittPerAr != null
      ? flis('Per år', kr(o.snittPerAr), `Snitt over ${o.ar.toFixed(1).replace('.', ',')} år`)
      : flis('Per år', '–', 'Trenger minst et halvt år'),
    o.perKm != null
      ? flis('Per km', `${o.perKm.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`, `${o.kmKjort.toLocaleString('nb-NO')} km kjørt`)
      : flis('Per km', '–', 'Trenger kilometerstand'),
  ));

  ut.push(kake(o), stolper(o), kurve(o, idag, Boolean(bil.kjopsdato)));
  if (o.antallUtenKostnad) {
    ut.push(liten(`${o.antallUtenKostnad} av ${o.antallUtenKostnad + o.antallMedKostnad} hendelser i perioden mangler kostnad og er ikke med i tallene.`));
  }
  if (o.total) ut.push(tabeller(o));
  ut.push(ansvar('Markedsverdien er et grovt anslag ut fra kjøpspris, alder, kilometer og utbedringer, ikke en takst. '
    + 'Faktisk pris avhenger av tilstand, utstyr og etterspørsel. Kostnadene bygger på det som er registrert i historikken.'));
  return ut;
}

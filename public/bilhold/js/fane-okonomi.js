// Fanen «Økonomi» i «Bilen din»: nøkkeltall, verdianslag og utgifter per post.
// Beregningene ligger i bilokonomi.js (ren og testet). Diagrammene og kjøpsopplysningene er på /bilokonomi.
import { formaterDato } from '/js/bilstatus.js';
import { estimerVerdi, oppsummer } from '/js/bilokonomi.js';
import { formaterKr } from '/js/dashboard.js';
import { ansvar, el, flis, fliser, lenkekort, liten } from './bil-visning.js';

export function okonomiFane(bil, idag) {
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
    ut.push(fliser(
      flis('Forventet verdi', `ca. ${formaterKr(verdi.verdi)}`, `${formaterKr(verdi.lav)} – ${formaterKr(verdi.hoy)}`),
      flis('Totalkostnad', formaterKr(totalt), o.ar >= 0.5 ? `${formaterKr(totalt / o.ar)} per år, inkl. verditap` : `Verditap ${formaterKr(verditap)}`),
    ));
  } else {
    ut.push(liten('Legg inn kjøpspris og kjøpsdato under Biløkonomi, så får du et grovt verdianslag og totalkostnad.'));
  }

  ut.push(fliser(
    flis(bil.kjopsdato ? 'Brukt siden kjøp' : 'Brukt totalt', formaterKr(o.total), `${o.antallMedKostnad} poster`),
    o.snittPerAr != null
      ? flis('Per år', formaterKr(o.snittPerAr), `Snitt over ${o.ar.toFixed(1).replace('.', ',')} år`)
      : flis('Per år', '–', 'Trenger minst et halvt år'),
    o.perKm != null
      ? flis('Per km', `${o.perKm.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`, `${o.kmKjort.toLocaleString('nb-NO')} km kjørt`)
      : null,
    bil.kjopspris != null
      ? flis('Kjøpspris', formaterKr(bil.kjopspris), bil.kjopsdato ? `Kjøpt ${formaterDato(bil.kjopsdato)}` : null)
      : null,
  ));

  // Utgifter per post som enkle stolper (fargene er de samme som på Biløkonomi)
  if (o.total) {
    const k = el('section', 'bil-kort');
    k.append(el('h3', null, 'Fordeling per utgiftspost'));
    const ul = el('ul', 'bil-poster');
    for (const p of o.kategorier) {
      const li = el('li');
      const linje = el('div', 'post-linje');
      linje.append(el('span', null, p.navn), el('span', 'post-belop', `${formaterKr(p.sum)} · ${Math.round(p.andel * 100)} %`));
      const stolpe = el('div', 'post-stolpe');
      const fyll = el('span');
      fyll.style.width = `${Math.max(2, p.andel * 100)}%`;
      fyll.style.background = `var(--serie-${p.nokkel})`;
      stolpe.append(fyll);
      li.append(linje, stolpe);
      ul.append(li);
    }
    k.append(ul);
    ut.push(k);
  }
  if (o.antallUtenKostnad) {
    ut.push(liten(`${o.antallUtenKostnad} av ${o.antallUtenKostnad + o.antallMedKostnad} hendelser mangler kostnad og er ikke med i tallene.`));
  }

  ut.push(lenkekort(bil, 'Biløkonomi', 'Diagrammer per år, akkumulert kurve og kjøpsopplysninger.', '/bilokonomi'));
  ut.push(ansvar('Verdien er et grovt anslag ut fra kjøpspris, alder, kilometer og utbedringer, ikke en takst. Kostnadene bygger på det som er registrert.'));
  return ut;
}

// "Hvor mye kan du laste hengeren?" i tilhenger-visningen på forsiden.
// Samme regler og utregning som /kalkulator: skilt slås opp via /api/kjoretoy,
// og beregnMaksLast i /js/beregning.js finner hvilken grense som begrenser.

import { beregnMaksLast } from '/js/beregning.js';
import { hentKjoretoy } from '/js/kjoretoy.js';

const FORER_VEKT_KG = 80;          // bilen regnes tom med fører
const LETT_HENGER_GRENSE = 750;    // over dette må hengeren ha brems

const NAVN = {
  forerkort: 'Førerkortet',
  bil: 'Bilens tilhengervekt',
  henger: 'Hengerens egen kapasitet',
  vogntog: 'Bilens vogntogvekt',
};
const FORERKORT_HJELP = {
  B: 'Tilhenger til 3 500 kg samlet.',
  B96: 'B med kode 96: bil og henger til 4 250 kg samlet.',
  BE: 'Tilhenger opptil 3 500 kg.',
};

const $ = (id) => document.getElementById(id);
const skjema = $('last-skjema');
const knapp = $('last-knapp');
const feil = $('last-feil');
const resultat = $('last-resultat');
const bremsFelt = $('last-brems');

const kg = (n) => `${Math.round(n).toLocaleString('no-NO')} kg`;
const rens = (skilt) => skilt.toUpperCase().replace(/[\s-]/g, '');

for (const valg of skjema.querySelectorAll('input[name="forerkort"]')) {
  valg.addEventListener('change', () => { $('forerkort-hjelp').textContent = FORERKORT_HJELP[valg.value]; });
}
for (const valg of skjema.querySelectorAll('input[name="brems"]')) {
  valg.addEventListener('change', () => bremsFelt.classList.remove('mangler'));
}

async function slaOpp(skilt) {
  const svar = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(skilt)}`);
  const data = await svar.json().catch(() => ({}));
  if (!svar.ok) throw new Error(data.feil || `Oppslaget feilet (${svar.status}).`);
  return hentKjoretoy(data);
}

function visFeil(tekst) {
  feil.textContent = tekst;
  feil.hidden = false;
  resultat.hidden = true;
}

function visResultat(res, bilFaktiskVekt, bilTotalvekt, harBrems, hengerErTung) {
  const hoved = $('last-hovedtall');
  const begrenser = $('last-begrenser');
  const grenser = $('last-grenser');
  const forklaring = $('last-forklaring');
  grenser.replaceChildren();
  forklaring.hidden = true;

  if (res.lovlig && res.maksLast > 0) {
    hoved.textContent = kg(res.maksLast);
    hoved.className = 'hovedtall ok';
    begrenser.textContent = `Begrenset av: ${NAVN[res.begrensning] ?? res.begrensning}`;
    begrenser.hidden = false;
  } else {
    hoved.textContent = 'Ingen last';
    hoved.className = 'hovedtall ingen';
    begrenser.hidden = true;
  }

  $('last-bremsstatus').textContent = hengerErTung
    ? 'Hengeren er over 750 kg, så den må ha brems. Beregningen er gjort med brems.'
    : harBrems
      ? 'Beregnet med brems på hengeren.'
      : 'Beregnet uten brems på hengeren. Uten brems er hengeren begrenset til 750 kg totalt.';

  if (!res.lovlig) {
    forklaring.textContent = res.forerkort.forklaring;
    forklaring.hidden = false;
  } else {
    for (const g of res.grenser) {
      const rad = document.createElement('li');
      rad.className = g.id === res.begrensning ? 'begrenser' : '';
      const venstre = document.createElement('div');
      const navn = document.createElement('p');
      navn.className = 'grense-navn';
      navn.textContent = NAVN[g.id] ?? g.navn;
      const tekst = document.createElement('p');
      tekst.className = 'hjelpetekst';
      tekst.textContent = g.forklaring;
      venstre.append(navn, tekst);
      const verdi = document.createElement('p');
      verdi.className = 'grense-verdi';
      verdi.textContent = kg(g.maksLast);
      rad.append(venstre, verdi);
      grenser.append(rad);
    }
  }

  // Lasten på bilen: tillatt totalvekt minus bilens vekt med fører
  if (bilTotalvekt != null) {
    $('last-bil-tall').textContent = kg(Math.max(0, bilTotalvekt - bilFaktiskVekt));
    $('last-bil-tekst').textContent = `Bilen er tillatt inntil ${kg(bilTotalvekt)} totalt. Den regnes med ${kg(bilFaktiskVekt)} (tom bil pluss fører). Hengeren er ikke med i dette tallet.`;
  } else {
    $('last-bil-tall').textContent = 'Ukjent';
    $('last-bil-tekst').textContent = 'Bilen mangler opplysning om tillatt totalvekt.';
  }

  const adv = $('last-advarsler');
  adv.replaceChildren(...res.advarsler.map((t) => {
    const p = document.createElement('p');
    p.className = 'hjelpetekst';
    p.textContent = t;
    return p;
  }));
  adv.hidden = res.advarsler.length === 0;
}

skjema.addEventListener('submit', async (e) => {
  e.preventDefault();
  feil.hidden = true;
  bremsFelt.hidden = false;
  const bilSkilt = rens($('last-bil').value);
  const hengerSkilt = rens($('last-henger').value);
  if (!bilSkilt || !hengerSkilt) {
    visFeil('Skriv inn skiltnummer for både bil og henger.');
    return;
  }
  knapp.disabled = true;
  knapp.textContent = 'Henter opplysninger …';
  try {
    const forerkort = skjema.querySelector('input[name="forerkort"]:checked').value;
    const valgtBrems = skjema.querySelector('input[name="brems"]:checked')?.value;
    const [bil, henger] = await Promise.all([slaOpp(bilSkilt), slaOpp(hengerSkilt)]);

    if (bil.erTilhenger) throw new Error(`${bilSkilt} er registrert som tilhenger, ikke bil.`);
    if (!henger.erTilhenger) throw new Error(`${hengerSkilt} er ikke registrert som tilhenger.`);

    const bilFaktiskVekt = (bil.vekter.egenvekt ?? 0) + FORER_VEKT_KG;
    const hengerErTung = (henger.vekter.tillattTotalvekt ?? 0) > LETT_HENGER_GRENSE;
    // Hengere over 750 kg må ha brems, så da spør vi ikke. Lettere hengere må svares på.
    bremsFelt.hidden = hengerErTung;
    if (!hengerErTung && !valgtBrems) {
      bremsFelt.classList.add('mangler');
      throw new Error('Svar på om hengeren har brems. Trykk «Slik ser du det» hvis du er usikker.');
    }
    const harBrems = hengerErTung ? true : valgtBrems === 'ja';

    const res = beregnMaksLast({
      bil: bil.vekter,
      henger: { ...henger.vekter, harBrems },
      forerkort,
      bilFaktiskVekt,
    });
    visResultat(res, bilFaktiskVekt, bil.vekter.tillattTotalvekt, harBrems, hengerErTung);
    resultat.hidden = false;
    resultat.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    visFeil(err.message || 'Noe gikk galt. Prøv igjen.');
  } finally {
    knapp.disabled = false;
    knapp.textContent = 'Beregn maks last';
  }
});

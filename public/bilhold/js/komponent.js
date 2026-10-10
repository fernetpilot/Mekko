// Underside for én bildel. Hvilken del styres av ?del=motor|bremser|dekk.
// Alt her er eksempeldata til vi kobler på ekte servicehistorikk.

const DELER = {
  motor: {
    tema: 'dark',
    status: 'ok',
    statusTekst: 'OK',
    tittel: 'Motorolje & filter',
    ingress: 'Sist skiftet for 6 mnd siden. Neste skift om ca. 6 mnd eller 7 500 km.',
    maler: { navn: 'Igjen til neste skift', prosent: 50 },
    fakta: [
      ['Sist skiftet', 'April 2026'],
      ['Kilometerstand da', '214 300 km'],
      ['Olje', '5W-30, 7,0 liter'],
      ['Filter', 'Originalt oljefilter'],
      ['Utført av', 'Verksted'],
    ],
    handling: 'Legg inn nytt oljeskift',
  },
  bremser: {
    tema: 'light',
    status: 'sjekk',
    statusTekst: 'Bør sjekkes',
    tittel: 'Bremseklosser foran',
    ingress: 'Slitasjen nærmer seg 75 %. Få dem sjekket ved neste service eller innen 2 000 km.',
    maler: { navn: 'Slitasje', prosent: 75 },
    fakta: [
      ['Sist byttet', 'Mai 2024'],
      ['Kilometerstand da', '188 900 km'],
      ['Bremseskiver', 'Ser fine ut'],
      ['Bremsevæske', 'Byttet 2024'],
    ],
    handling: 'Bestill bremsesjekk',
  },
  dekk: {
    tema: 'light',
    status: 'kritisk',
    statusTekst: 'Må byttes!',
    tittel: 'Sommerdekk (265/70R16)',
    ingress: 'Mønsterdybden er under lovkravet på 1,6 mm. Bilen bør ikke kjøres før dekkene er byttet.',
    maler: { navn: 'Mønsterdybde (1,4 mm av 9 mm)', prosent: 16 },
    fakta: [
      ['Dimensjon', '265/70R16'],
      ['Montert', 'Mai 2021'],
      ['Lovkrav sommer', 'Minst 1,6 mm'],
      ['Lagres på', 'Dekkhotell'],
    ],
    handling: 'Finn nye dekk',
  },
};

const navn = new URLSearchParams(location.search).get('del');
const del = DELER[navn] ?? DELER.motor;

document.documentElement.dataset.theme = del.tema;
document.querySelector('meta[name="theme-color"]').content = del.tema === 'light' ? '#eef0f2' : '#0a0b0d';
document.title = `Mekkoo – ${del.tittel}`;

const statusKlasse = `status-${del.status}`;
const prikk = del.status === 'kritisk'
  ? '<span class="status-prikk varsel">⚠️</span>'
  : '<span class="status-prikk"></span>';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

document.getElementById('innhold').insertAdjacentHTML('beforeend', `
  <div class="status-hode ${statusKlasse}">
    ${prikk}
    <span class="kort-status">${esc(del.statusTekst)}</span>
  </div>
  <h1>${esc(del.tittel)}</h1>
  <p class="ingress">${esc(del.ingress)}</p>

  <section class="glasskort ${statusKlasse}">
    <h2>Status</h2>
    <div class="malerlinje"><span style="width:${del.maler.prosent}%"></span></div>
    <span class="kort-tekst">${esc(del.maler.navn)}</span>
  </section>

  <section class="glasskort ${statusKlasse}">
    <h2>Detaljer</h2>
    <ul class="fakta">
      ${del.fakta.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('')}
    </ul>
  </section>

  <button class="handling" type="button" disabled>${esc(del.handling)} (kommer snart)</button>
  <p class="eksempeldata">Eksempeldata – ikke ekte målinger.</p>
`);

// Racerbanen i spillet: en lukket landevei, beskrevet som en midtlinje med punkter hver 2. meter.
// Ren logikk (ingen Three.js), så den kan testes og gjenbrukes. 3D-veien lages i bane-3d.js.
//
// Koordinater som i resten av 3D-koden: 1 enhet = 1 meter, y er opp, banen ligger i x/z-planet.
// Bilen starter i origo og kjører mot +z i høyre felt, akkurat som på forsiden. Derfor ligger
// midtlinjen 1,9 meter til venstre for bilen (+x).

export const VEI_BREDDE = 7.5;      // samme vei som på forsiden
export const KANTLINJE = 3.6;       // hvit linje fra midten
export const STIKKE = 4.4;          // brøytestikkene
export const GRENSE = 11;           // autovernet: lenger ut kommer man ikke
export const MIDTSTRIPE_X = 1.9;    // midtlinjen ved start (bilen står i høyre felt)
export const MAAL_S = 40;           // start/mål ligger 40 meter foran bilen

// Kontrollpunkter (x, z) som kurven går gjennom. Første punkt er starten; de to naboene ligger
// rett bak og rett foran, så banen går rett fram (+z) der bilen starter.
const KONTROLLPUNKTER = [
  [0, 0], [0, 100], [-6, 160],
  [-40, 205], [-95, 215], [-140, 185],
  [-150, 135], [-120, 95], [-100, 55],
  [-120, 15], [-175, 0], [-215, -40],
  [-210, -100], [-165, -140], [-105, -135],
  [-60, -175], [-15, -165], [0, -100],
];

// Centripetal Catmull-Rom: går gjennom alle punktene uten løkker og overskyting i krappe svinger
function catmullRom(p0, p1, p2, p3, t) {
  const knute = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-4;
  const t0 = 0, t1 = t0 + knute(p0, p1), t2 = t1 + knute(p1, p2), t3 = t2 + knute(p2, p3);
  const u = t1 + (t2 - t1) * t;
  const lerp = (a, b, ta, tb) => {
    const k = (u - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  const a1 = lerp(p0, p1, t0, t1), a2 = lerp(p1, p2, t1, t2), a3 = lerp(p2, p3, t2, t3);
  const b1 = lerp(a1, a2, t0, t2), b2 = lerp(a2, a3, t1, t3);
  return lerp(b1, b2, t1, t2);
}

/**
 * Lager banen: punkter med jevn avstand langs midtlinjen.
 * Hvert punkt har posisjon (x, z), retning (tx, tz), venstre normal (nx, nz) og strekning s.
 */
export function lagBane(kontroll = KONTROLLPUNKTER, avstand = 2) {
  const n = kontroll.length;
  // Tett kurve først, så jevn avstand etterpå
  const tett = [];
  for (let i = 0; i < n; i++) {
    const p = (k) => kontroll[(k + n) % n];
    for (let j = 0; j < 40; j++) tett.push(catmullRom(p(i - 1), p(i), p(i + 1), p(i + 2), j / 40));
  }
  tett.push(tett[0]);
  const lengder = [0];
  for (let i = 1; i < tett.length; i++) {
    lengder.push(lengder[i - 1] + Math.hypot(tett[i][0] - tett[i - 1][0], tett[i][1] - tett[i - 1][1]));
  }
  const total = lengder[lengder.length - 1];
  const antall = Math.round(total / avstand);
  const steg = total / antall;
  const punkter = [];
  let k = 0;
  for (let i = 0; i < antall; i++) {
    const s = i * steg;
    while (lengder[k + 1] < s) k++;
    const f = (s - lengder[k]) / (lengder[k + 1] - lengder[k] || 1);
    punkter.push({
      x: tett[k][0] + (tett[k + 1][0] - tett[k][0]) * f + MIDTSTRIPE_X,
      z: tett[k][1] + (tett[k + 1][1] - tett[k][1]) * f,
      s,
    });
  }
  for (let i = 0; i < antall; i++) {
    const a = punkter[(i - 1 + antall) % antall], b = punkter[(i + 1) % antall];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    const p = punkter[i];
    p.tx = (b.x - a.x) / l;
    p.tz = (b.z - a.z) / l;
    // Venstre side når man kjører langs banen (for +z er venstre +x)
    p.nx = p.tz;
    p.nz = -p.tx;
  }
  return { punkter, lengde: total, steg };
}

/**
 * Nærmeste punkt på midtlinjen. `fra` er indeksen fra forrige gang: da letes det bare i nærheten,
 * så man ikke hopper over til en annen del av banen som ligger tett ved.
 * avvik er avstanden fra midtlinjen, positiv til venstre.
 */
export function naermeste(bane, x, z, fra = null) {
  const { punkter } = bane;
  const n = punkter.length;
  let best = 0, bestD = Infinity;
  const sok = (i) => {
    const p = punkter[(i + n) % n];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bestD) { bestD = d; best = (i + n) % n; }
  };
  if (fra == null) for (let i = 0; i < n; i++) sok(i);
  else for (let i = fra - 30; i <= fra + 30; i++) sok(i);
  const p = punkter[best];
  const langs = (x - p.x) * p.tx + (z - p.z) * p.tz;
  const avvik = (x - p.x) * p.nx + (z - p.z) * p.nz;
  let s = p.s + langs;
  if (s < 0) s += bane.lengde;
  if (s >= bane.lengde) s -= bane.lengde;
  return { i: best, avvik, s, nx: p.nx, nz: p.nz, tx: p.tx, tz: p.tz };
}

/** Punktet på banen ved strekning s (meter), med sideforskyvning (positiv til venstre). */
export function punktVed(bane, s, sideveis = 0) {
  const n = bane.punkter.length;
  const t = (((s % bane.lengde) + bane.lengde) % bane.lengde) / bane.steg;
  const i = Math.floor(t) % n;
  const a = bane.punkter[i], b = bane.punkter[(i + 1) % n];
  const f = t - Math.floor(t);
  const nx = a.nx + (b.nx - a.nx) * f, nz = a.nz + (b.nz - a.nz) * f;
  return {
    x: a.x + (b.x - a.x) * f + nx * sideveis,
    z: a.z + (b.z - a.z) * f + nz * sideveis,
    tx: a.tx + (b.tx - a.tx) * f,
    tz: a.tz + (b.tz - a.tz) * f,
  };
}

/**
 * Rundetid: banen er delt i fire, og en runde teller bare når man har vært innom alle delene i
 * rekkefølge og kommer over mållinjen. Ren tilstandsmaskin: oppdater med strekningen hver frame.
 */
export function lagRundeteller(lengde) {
  return {
    neste: 1,          // neste kvart man må innom (0 = mållinjen)
    forrigeS: null,
    startTid: null,    // når den pågående runden startet (sekunder)
    runder: 0,
    beste: null,
    siste: null,
    oppdater(s, tid) {
      const kvart = Math.floor(((s - MAAL_S + lengde) % lengde) / (lengde / 4));
      const forrige = this.forrigeS;
      this.forrigeS = s;
      if (forrige == null) return null;
      // Krysset mållinjen forover?
      const over = (a, b) => {
        const fa = (a - MAAL_S + lengde) % lengde, fb = (b - MAAL_S + lengde) % lengde;
        return fa > lengde * 0.75 && fb < lengde * 0.25;
      };
      if (over(forrige, s)) {
        if (this.startTid == null) { this.startTid = tid; this.neste = 1; return 'start'; }
        if (this.neste === 0) {
          const runde = tid - this.startTid;
          this.siste = runde;
          this.runder++;
          const rekord = this.beste == null || runde < this.beste;
          if (rekord) this.beste = runde;
          this.startTid = tid;
          this.neste = 1;
          return rekord ? 'rekord' : 'runde';
        }
        // Snarvei eller rygget over linjen: runden starter på nytt
        this.startTid = tid;
        this.neste = 1;
        return 'start';
      }
      if (this.neste !== 0 && kvart === this.neste) this.neste = this.neste === 3 ? 0 : this.neste + 1;
      return null;
    },
  };
}

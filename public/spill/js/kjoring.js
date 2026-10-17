// Kjørefølelsen i spillet: arkadefysikk med litt skrens, overført fra Starter Kit Racing
// (MIT, se ../LISENS-starter-kit-racing.txt) og regnet om til meter og sekunder.
// Ren logikk (ingen Three.js og ingen DOM), testet i tests/spill.test.js.
//
// Retning er en vinkel rundt y-aksen: 0 peker mot +z, og positiv vinkel svinger mot +x
// (bilens venstre side). Styring x: -1 = venstre, 1 = høyre. Gass z: 1 = gass, -1 = brems/revers.

export const VMAKS = 30;            // m/s ved full fart (108 km/t)
const STYRING = 2.1;                // rad/s i full fart, ca. 14 meters svingradius
const DEMPING = 0.1;
const GRESS_MAKS = 0.45;            // på gresset går det ikke fortere enn 45 % av toppfarten

const klem = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
export function vinkelDiff(mal, fra) {
  let d = mal - fra;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function nyBil({ x = 0, z = 0, retning = 0, fart = 0 } = {}) {
  const s = fart / VMAKS;
  return {
    x, z, retning,
    s,                               // fart forover, -0,5..1 av toppfarten
    vinkelfart: 0,
    aks: s + 0.25 * s * Math.abs(s), // fart som henger litt etter: gir neiing og skrens
    vx: Math.sin(retning) * fart,    // faktisk bevegelse (kan skli litt sidelengs)
    vz: Math.cos(retning) * fart,
    styr: 0,                         // forhjulenes vinkel (radianer)
    neiing: 0,                       // karosseriet vipper fram/bak
    krengning: 0,                    // karosseriet lener seg i svinger
    skrens: 0,                       // 0 = god grep, over ca. 0,15 = dekkspor
  };
}

/** Fart i km/t. */
export const kmt = (b) => Math.hypot(b.vx, b.vz) * 3.6;

/**
 * Ett tidssteg. inn = { x, z } fra tastatur/håndkontroll, eller { retning: { x, z } } fra berøring:
 * da svinger bilen mot den retningen fingeren peker (i verden) og gir gass selv, som i Starter Kit Racing.
 */
export function kjor(b, inn, dt, { gress = false } = {}) {
  if (dt <= 0) return b;
  let x = inn.x ?? 0;
  const z = inn.z ?? 0;
  const grep = klem(Math.abs(b.s), 0.2, 1);

  if (inn.retning && (inn.retning.x || inn.retning.z)) {
    const diff = vinkelDiff(Math.atan2(inn.retning.x, inn.retning.z), b.retning);
    const maks = STYRING * 1.3 * grep * dt;
    const dreid = klem(diff * (1 - Math.exp(-3 * dt)), -maks, maks);
    b.retning += dreid;
    b.vinkelfart = dreid / dt;
    x = klem(-diff * 2, -1, 1);
    b.s = lerp(b.s, 1, dt * 1.5);
  } else {
    let retningForover = Math.sign(b.s);
    if (retningForover === 0) retningForover = Math.abs(z) > 0.1 ? Math.sign(z) : 1;
    const malVinkel = -x * grep * STYRING * retningForover;
    b.vinkelfart = lerp(b.vinkelfart, malVinkel, dt * 4);
    b.retning += b.vinkelfart * dt;
    if (z < 0 && b.s > 0.01) b.s = lerp(b.s, 0, dt * 3);          // brems
    else if (z < 0) b.s = lerp(b.s, z / 2, dt * 2);                // rygg
    else b.s = lerp(b.s, z, dt * 1.5);                             // gass, eller rull ut
  }
  if (gress && b.s > GRESS_MAKS) b.s = lerp(b.s, GRESS_MAKS, dt * 2.5);
  b.s *= Math.max(0, 1 - DEMPING * dt);
  b.aks = lerp(b.aks, b.s + 0.25 * b.s * Math.abs(b.s), dt);

  // Bilen vil dit den peker, men dekkene trenger litt tid: gir skrens i krappe svinger
  const mx = Math.sin(b.retning) * b.s * VMAKS;
  const mz = Math.cos(b.retning) * b.s * VMAKS;
  const feste = 1 - Math.exp(-(gress ? 2.5 : 5.5) * dt);
  b.vx = lerp(b.vx, mx, feste);
  b.vz = lerp(b.vz, mz, feste);
  b.x += b.vx * dt;
  b.z += b.vz * dt;

  b.skrens = Math.hypot(b.vx - mx, b.vz - mz) / VMAKS + Math.abs(b.s - b.aks) * 0.5;
  b.styr = lerp(b.styr, -x * 0.5, 1 - Math.exp(-10 * dt));
  b.neiing = lerp(b.neiing, -(b.s - b.aks) / 14, 1 - Math.exp(-10 * dt));
  b.krengning = lerp(b.krengning, -(x / 12) * b.s, 1 - Math.exp(-5 * dt));
  return b;
}

/**
 * Bilen har kjørt inn i autovernet. (nx, nz) peker ut av banen, dybde er hvor langt forbi den er.
 * Bilen flyttes tilbake, mister farten ut mot vernet og en del av farten forover.
 */
export function stoppMotVegg(b, nx, nz, dybde) {
  b.x -= nx * dybde;
  b.z -= nz * dybde;
  const ut = b.vx * nx + b.vz * nz;
  if (ut > 0) {
    b.vx -= nx * ut * 1.4;
    b.vz -= nz * ut * 1.4;
    b.s *= 1 - Math.min(0.5, (ut / VMAKS) * 1.5);
  }
  return b;
}

/**
 * Selvkjøring før spilleren tar over: holder seg i høyre felt og ruller i fast fart.
 * malX/malZ er et punkt litt lenger fram i feltet. Gir et { x, z }-innspill til kjor().
 */
export function autopilot(b, malX, malZ, fart) {
  const diff = vinkelDiff(Math.atan2(malX - b.x, malZ - b.z), b.retning);
  // Farten dempes litt hele tiden, så gassen må stå litt over ønsket fart (1,6/1,5) for å holde den
  return { x: klem(-diff * 3, -1, 1), z: (fart / VMAKS) * (1.6 / 1.5) };
}

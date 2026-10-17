// Spillkameraet henger fast bak bilen og dreier med den, så man alltid ser veien som kommer.
// Det ser et stykke foran bilen, ikke på selve bilen. Dreiningen glir litt etter bilen, så
// bildet ikke rykker i svinger. Forsiden bruker startKamera() til å fly kameraet hit før den
// bytter side, så det siste bildet på forsiden og det første i spillet blir like. Ren logikk, ingen Three.js.

export function spillKamera(aspekt) {
  const staaende = aspekt < 1;
  return {
    fov: staaende ? 60 : 50,
    bak: staaende ? 9 : 8,        // meter bak bilen, langs bakken
    hoyde: staaende ? 4.6 : 3.8,  // meter over bakken
    framfor: staaende ? 10 : 8,   // kameraet ser på et punkt så langt foran bilen (meter)
    malHoyde: 0.8,
    myk: 4,                       // hvor fort kameraet dreier etter bilen (høyere = strammere)
  };
}

/** Kameraets plass og retning når det står rett bak en bil med retning r. */
function bakBilen(k, bilX, bilZ, r) {
  const sx = Math.sin(r), sz = Math.cos(r);
  return {
    pos: { x: bilX - sx * k.bak, y: k.hoyde, z: bilZ - sz * k.bak },
    mal: { x: bilX + sx * k.framfor, y: k.malHoyde, z: bilZ + sz * k.framfor },
    frem: { x: sx, z: sz },       // «opp» på skjermen, langs bakken
    hoyre: { x: -sz, z: sx },     // «høyre» på skjermen, langs bakken
  };
}

/** Hvor kameraet står og ser når bilen har kjørt rett fram en stund. */
export function startKamera(aspekt, bilX, bilZ, vx, vz) {
  const k = spillKamera(aspekt);
  const r = vx || vz ? Math.atan2(vx, vz) : 0;
  const { pos, mal } = bakBilen(k, bilX, bilZ, r);
  return { fov: k.fov, pos, mal };
}

/**
 * Følgekamera: står bak bilen og dreier mykt etter bilens retning. tilstand = { retning } er
 * kameraets retning nå (radianer); den endres. Svarer med pos, mal, og hva som er frem og høyre
 * på skjermen (brukes av styringen med fingeren).
 */
export function folgKamera(tilstand, k, bilX, bilZ, retning, dt) {
  let d = retning - tilstand.retning;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  tilstand.retning += d * (1 - Math.exp(-dt * k.myk));
  return bakBilen(k, bilX, bilZ, tilstand.retning);
}

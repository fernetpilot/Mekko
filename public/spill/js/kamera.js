// Spillkameraet står skrått bak og over bilen og har samme retning hele tiden, som i Starter Kit Racing
// (MIT, se ../LISENS-starter-kit-racing.txt). Det ser litt foran bilen i fartsretningen.
// Forsiden bruker startKamera() til å fly kameraet hit før den bytter side, så det siste bildet
// på forsiden og det første i spillet blir like. Ren logikk, ingen Three.js.

const grad = (g) => (g * Math.PI) / 180;

export function spillKamera(aspekt) {
  const staaende = aspekt < 1;
  const avstand = staaende ? 21 : 17;
  const hoyde = grad(staaende ? 48 : 36);     // vinkel over bakken
  const side = grad(staaende ? 10 : 16);      // dreid litt ut mot bilens venstre side, der kameraet står på forsiden
  const ox = Math.sin(side) * Math.cos(hoyde) * avstand;
  const oz = -Math.cos(side) * Math.cos(hoyde) * avstand;
  const l = Math.hypot(ox, oz);
  const frem = { x: -ox / l, z: -oz / l };    // «opp» på skjermen, langs bakken
  return {
    fov: staaende ? 50 : 38,                  // samme som forsiden
    offset: { x: ox, y: Math.sin(hoyde) * avstand, z: oz },
    frem,
    hoyre: { x: -frem.z, z: frem.x },         // «høyre» på skjermen, langs bakken
    ledd: 0.15,                               // sekunder: hvor langt foran bilen kameraet ser
    radius: 3.5,                              // ser aldri lenger foran bilen enn dette (meter)
    myk: 1.5,
    skift: staaende ? 2.5 : 0.5,             // meter: flytter bildet så bilen og hengeren står midt på
  };
}

const klemLengde = (x, z, maks) => {
  const l = Math.hypot(x, z);
  return l > maks ? [(x * maks) / l, (z * maks) / l] : [x, z];
};

/** Hvor kameraet står og ser når bilen har kjørt jevnt en stund. */
export function startKamera(aspekt, bilX, bilZ, vx, vz) {
  const k = spillKamera(aspekt);
  const [lx, lz] = klemLengde(vx * k.ledd, vz * k.ledd, k.radius);
  const mal = { x: bilX + lx - k.frem.x * k.skift, y: 0, z: bilZ + lz - k.frem.z * k.skift };
  return { fov: k.fov, mal, pos: { x: mal.x + k.offset.x, y: k.offset.y, z: mal.z + k.offset.z } };
}

/**
 * Følgekamera: ser på et punkt foran bilen i fartsretningen. Hvor langt foran glir mykt etter
 * farten, så kameraet ikke rykker når man svinger eller bremser. tilstand = { x, z } er hvor langt
 * foran bilen kameraet ser (meter); den endres. Svarer med punktet kameraet skal se på.
 */
export function folgKamera(tilstand, k, bilX, bilZ, vx, vz, dt) {
  const [lx, lz] = klemLengde(vx * k.ledd, vz * k.ledd, k.radius);
  const a = 1 - Math.exp(-dt * k.myk);
  tilstand.x += (lx - tilstand.x) * a;
  tilstand.z += (lz - tilstand.z) * a;
  return { x: bilX + tilstand.x - k.frem.x * k.skift, z: bilZ + tilstand.z - k.frem.z * k.skift };
}

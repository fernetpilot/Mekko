// Standardbilen: en stilisert Land Rover Discovery 2 (ca. 1999–2004) med «stepped roof»,
// alpinevinduer og reservehjul på bakdøra. Vises for utloggede og for biler uten egen modell.
// Forenklet realisme med skarpe, enkle linjer. Felles deler (hjul, kupé, skanning) ligger i felles.js.

import * as THREE from 'three';

const FORAKSEL_Z = 1.32;
const BAKAKSEL_Z = -1.22;

export const standard = {
  navn: 'Standard',
  hjulradius: 0.39,
  foraksel: FORAKSEL_Z,
  bakaksel: BAKAKSEL_Z,
  sporvidde: 0.82,                       // avstand fra midten til hjulsenter
  bredde: 1.86,
  front: 2.28,
  bak: -2.22,
  karosseri({ karosseri, mat, boks, sideplate }) {
    const { solv, plast, glass, krom, lykt, blinklys, baklykt, motorrom, motorMat, oljeMat, dekkMat } = mat;
    const BREDDE = 1.86;
    const FRONT = 2.28;
    const BAK = -2.22;
    const BELTE = 1.12;      // høyden der panser og vinduer begynner

    // Nedre del av karosseriet. Midtpartiet er smalere enn sporvidden, og sidene har
    // hjulbuer, så hjulene får fri plass og aldri går gjennom karosseriet når bilen rister.
    const MIDT_B = 1.3;                     // innenfor hjulenes innerkant (0.685)
    const BUE_TOPP = 0.9;                   // dekket rekker opp til ca. 0.8
    const BUE_HALV = 0.52;                  // halv lengde på hjulbueåpningen
    boks(MIDT_B, BELTE - 0.48, 0.73 - BAK, solv, 0, (BELTE + 0.48) / 2, (0.73 + BAK) / 2);
    boks(MIDT_B, 0.32, FRONT - 0.73, solv, 0, 0.64, (FRONT + 0.73) / 2);   // under motorrommet
    const sideX = (BREDDE + MIDT_B) / 4;    // midt i sidepanelet
    const sideB = (BREDDE - MIDT_B) / 2;
    const sidepanel = (zFra, zTil, yFra, yTil) => {
      for (const s of [-1, 1]) boks(sideB, yTil - yFra, zTil - zFra, solv, s * sideX, (yFra + yTil) / 2, (zFra + zTil) / 2);
    };
    const fremreBue = [FORAKSEL_Z - BUE_HALV, FORAKSEL_Z + BUE_HALV];
    const bakreBue = [BAKAKSEL_Z - BUE_HALV, BAKAKSEL_Z + BUE_HALV];
    sidepanel(fremreBue[1], FRONT, 0.48, BELTE);
    sidepanel(fremreBue[0], fremreBue[1], BUE_TOPP, BELTE);
    sidepanel(bakreBue[1], fremreBue[0], 0.48, BELTE);
    sidepanel(bakreBue[0], bakreBue[1], BUE_TOPP, BELTE);
    sidepanel(BAK, bakreBue[0], 0.48, BELTE);
    // Mørk innerskjerm i hjulbuene
    for (const s of [-1, 1]) {
      for (const [a, b] of [fremreBue, bakreBue]) {
        // Litt luft til karosseriflatene, ellers flimrer de mot hverandre (z-fighting)
        boks(0.01, BUE_TOPP - 0.5, b - a - 0.01, plast, s * (MIDT_B / 2 + 0.012), (BUE_TOPP + 0.48) / 2, (a + b) / 2);
        boks(sideB - 0.01, 0.01, b - a - 0.01, plast, s * sideX, BUE_TOPP - 0.012, (a + b) / 2);
        // Mørke endevegger foran og bak i hjulbuen. Uten dem synes de lyse endeflatene på
        // sidepanelene, og de lå i samme plan som de svarte bueklossene, så de flimret mot hverandre.
        for (const z of [a + 0.012, b - 0.012]) {
          boks(sideB - 0.01, BUE_TOPP - 0.49, 0.012, plast, s * sideX, (BUE_TOPP + 0.48) / 2, z);
        }
      }
    }
    // Frontpanel med grill
    boks(BREDDE - 0.28, BELTE - 0.8, 0.06, solv, 0, (BELTE + 0.8) / 2, FRONT - 0.03);
    boks(0.9, 0.2, 0.04, plast, 0, 0.94, FRONT + 0.01);
    for (let i = 0; i < 4; i++) boks(0.86, 0.015, 0.02, krom, 0, 0.87 + i * 0.045, FRONT + 0.035);
    // Lykter
    for (const s of [-1, 1]) {
      // Discovery 2: to runde lamper i hver lyktboks
      boks(0.34, 0.2, 0.04, plast, s * 0.7, 0.94, FRONT + 0.01);
      for (const dx of [-0.08, 0.08]) {
        const lampe = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 24), lykt);
        lampe.rotation.x = Math.PI / 2;
        lampe.position.set(s * 0.7 + dx, 0.94, FRONT + 0.035);
        karosseri.add(lampe);
      }
      boks(0.09, 0.06, 0.03, blinklys, s * 0.7, 0.8, FRONT + 0.01);
      // Baklys høyt oppe på bakhjørnene, og små lys i støtfangeren
      boks(0.1, 0.5, 0.05, baklykt, s * 0.81, 1.5, BAK - 0.01);
      boks(0.16, 0.06, 0.03, baklykt, s * 0.75, 0.62, BAK - 0.19);
    }
    // Brannvegg og selve motorrommet
    boks(BREDDE - 0.28, 0.32, 0.05, motorrom, 0, 0.96, 0.75);
    boks(BREDDE - 0.3, 0.02, FRONT - 0.82, motorrom, 0, 0.81, (FRONT + 0.77) / 2);

    // Motor med oljelokk og oljefilter (blir grønne i motorrom-seksjonen)
    const motorGruppe = new THREE.Group();
    karosseri.add(motorGruppe);
    boks(0.62, 0.24, 0.72, motorMat, 0, 0.94, 1.45, motorGruppe);                       // motorblokk
    boks(0.66, 0.06, 0.66, motorMat, 0, 1.08, 1.45, motorGruppe);                       // ventildeksel
    boks(0.32, 0.14, 0.4, plast, -0.55, 0.98, 1.65, motorGruppe);                       // luftfilterboks
    const oljelokk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), oljeMat);
    oljelokk.position.set(0.15, 1.13, 1.32);
    karosseri.add(oljelokk);
    const oljefilter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20), oljeMat);
    oljefilter.rotation.z = Math.PI / 2;
    oljefilter.position.set(0.42, 0.95, 1.55);
    karosseri.add(oljefilter);

    // Panser (hengslet ved frontruta så det kan åpnes)
    const panser = new THREE.Group();
    panser.position.set(0, BELTE + 0.01, 0.76);
    karosseri.add(panser);
    boks(BREDDE - 0.02, 0.05, FRONT - 0.76, solv, 0, 0, (FRONT - 0.76) / 2, panser);
    boks(BREDDE - 0.5, 0.012, FRONT - 0.9, solv, 0, 0.03, (FRONT - 0.76) / 2, panser); // pregning

    // Kupé med "stepped roof" som på Discovery. Sidene er hele plater formet etter
    // frontruta, og vinduer og stolper ligger utenpå, så det ikke blir glipper.
    const KUPE_B = 1.76;
    const TAK_UNDER = 1.89;
    const RUTE_FOT = { z: 0.6, y: BELTE };   // frontruta møter panseret
    const RUTE_TOPP = { z: 0.24, y: 1.92 };  // frontruta møter taket
    const TRINN_Z = -1.25;                   // der det hevede taket bak begynner
    const aStolpeZ = (y) => RUTE_FOT.z + (RUTE_TOPP.z - RUTE_FOT.z) * (y - RUTE_FOT.y) / (RUTE_TOPP.y - RUTE_FOT.y);

    boks(KUPE_B, 0.04, 2.75, solv, 0, BELTE + 0.02, -0.8);                              // overgang
    boks(KUPE_B, 0.08, RUTE_TOPP.z + 0.02 - TRINN_Z, solv, 0, TAK_UNDER + 0.04, (RUTE_TOPP.z + 0.02 + TRINN_Z) / 2); // tak foran
    boks(KUPE_B, 0.16, TRINN_Z - BAK, solv, 0, TAK_UNDER + 0.08, (TRINN_Z + BAK) / 2);  // hevet tak bak
    // Takrails med føtter ned i taket (foran, ved trinnet og bak)
    const RAIL_Y = 2.08;
    const TAK_FORAN = TAK_UNDER + 0.08;      // oversiden av taket foran
    const TAK_BAK = TAK_UNDER + 0.16;        // oversiden av det hevede taket
    for (const s of [-1, 1]) {
      boks(0.04, 0.04, RUTE_TOPP.z - 0.05 - BAK, plast, s * 0.72, RAIL_Y, (RUTE_TOPP.z - 0.05 + BAK) / 2);
      for (const [z, tak] of [[RUTE_TOPP.z - 0.12, TAK_FORAN], [TRINN_Z + 0.12, TAK_FORAN], [BAK + 0.1, TAK_BAK]]) {
        boks(0.05, RAIL_Y - tak, 0.1, plast, s * 0.72, (RAIL_Y + tak) / 2, z);
      }
    }

    const VINDU_FOT = 1.22;
    const VINDU_TOPP = 1.84;
    for (const s of [-1, 1]) {
      const ytre = s * (KUPE_B / 2 - 0.01);
      // Vindusåpningene (z, y): fordør (følger frontruta), bakdør og bakre sidevindu
      const vinduer = [
        [[0.0, VINDU_FOT], [aStolpeZ(VINDU_FOT) - 0.06, VINDU_FOT], [aStolpeZ(VINDU_TOPP) - 0.06, VINDU_TOPP], [0.0, VINDU_TOPP]],
        [[-1.0, VINDU_FOT], [-0.1, VINDU_FOT], [-0.1, VINDU_TOPP], [-1.0, VINDU_TOPP]],
        [[BAK + 0.12, VINDU_FOT], [-1.1, VINDU_FOT], [-1.1, VINDU_TOPP], [BAK + 0.12, VINDU_TOPP]],
      ];
      // Sidevegg fra beltelinjen helt opp til taket, med hull der vinduene er (så man ser inn når glasset blir klart)
      sideplate([[BAK, BELTE], [RUTE_FOT.z, BELTE], [RUTE_TOPP.z, TAK_UNDER + 0.01], [BAK, TAK_UNDER + 0.01]], 0.03, solv, ytre, vinduer);
      // Hevet tak bak: veggen fortsetter opp
      sideplate([[BAK, TAK_UNDER], [TRINN_Z, TAK_UNDER], [TRINN_Z, TAK_UNDER + 0.15], [BAK, TAK_UNDER + 0.15]], 0.03, solv, ytre);
      const glassX = ytre + s * 0.02;
      for (const v of vinduer) sideplate(v, 0.01, glass, glassX);
      // Alpine-vinduer i det hevede taket
      sideplate([[BAK + 0.2, TAK_UNDER + 0.03], [TRINN_Z - 0.12, TAK_UNDER + 0.03], [TRINN_Z - 0.12, TAK_UNDER + 0.12], [BAK + 0.2, TAK_UNDER + 0.12]], 0.01, glass, glassX);
      // Speil
      boks(0.2, 0.14, 0.08, plast, s * 1.02, 1.3, 0.45);
    }
    // Frontrute (skrå) med A-stolper
    const ruteVinkel = Math.atan2(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
    const ruteLengde = Math.hypot(RUTE_FOT.z - RUTE_TOPP.z, RUTE_TOPP.y - RUTE_FOT.y);
    const ruteMidt = [(RUTE_FOT.y + RUTE_TOPP.y) / 2, (RUTE_FOT.z + RUTE_TOPP.z) / 2];
    const rute = boks(KUPE_B - 0.06, ruteLengde, 0.02, glass, 0, ruteMidt[0], ruteMidt[1]);
    rute.rotation.x = -ruteVinkel;
    for (const s of [-1, 1]) {
      const a = boks(0.06, ruteLengde + 0.04, 0.07, solv, s * (KUPE_B / 2 - 0.02), ruteMidt[0], ruteMidt[1]);
      a.rotation.x = -ruteVinkel;
    }
    // Bakrute og reservehjul på bakdøra
    boks(KUPE_B - 0.2, 0.58, 0.02, glass, 0, 1.55, BAK - 0.005);
    boks(KUPE_B, 0.76, 0.04, solv, 0, 0.8, BAK - 0.01);

    // Støtfangere og hjulbuer i sort plast
    boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, FRONT + 0.08);
    boks(BREDDE + 0.06, 0.2, 0.2, plast, 0, 0.6, BAK - 0.08);
    for (const s of [-1, 1]) {
      boks(0.04, 0.08, fremreBue[0] - bakreBue[1], plast, s * (BREDDE / 2 + 0.01), 0.52, (fremreBue[0] + bakreBue[1]) / 2); // sidelist
      boks(0.03, 0.06, fremreBue[0] - bakreBue[1] - 0.1, plast, s * (BREDDE / 2 + 0.01), 0.84, (fremreBue[0] + bakreBue[1]) / 2); // støtlist på dørene
      for (const z of [FORAKSEL_Z, BAKAKSEL_Z]) {
        boks(0.1, 0.07, BUE_HALV * 2 + 0.14, plast, s * (BREDDE / 2 + 0.03), BUE_TOPP + 0.035, z);
        // Loddrette bueklosser: litt inn i buen, så ingen flate ligger i samme plan som sidepanelet
        for (const zz of [-1, 1]) boks(0.1, BUE_TOPP - 0.6, 0.07, plast, s * (BREDDE / 2 + 0.03), (BUE_TOPP + 0.6) / 2, z + zz * (BUE_HALV + 0.022));
      }
    }

    // Reservehjul på bakdøra
    const reserve = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 28), dekkMat);
    reserve.rotation.x = Math.PI / 2;
    reserve.position.set(0, 1.08, BAK - 0.16);
    reserve.castShadow = true;
    karosseri.add(reserve);
    const deksel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 28), solv);
    deksel.rotation.x = Math.PI / 2;
    deksel.position.set(0, 1.08, BAK - 0.29);
    karosseri.add(deksel);

    return { panser, oljelokk };
  },
};

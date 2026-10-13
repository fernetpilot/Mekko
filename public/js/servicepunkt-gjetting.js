// Gjetter hvilke servicepunkter en vedlikeholdsregistrering gjelder, ut fra kategori og fritekst.
// Ren logikk. Brukes ved import og registrering, og som forslag på historikklinjer.

import { allePunkter } from "./servicekatalog.js";

/** Alle servicepunkter som kan velges, med norsk navn (hele katalogen, se servicekatalog.js). */
export function alleServicepunkter() {
  return allePunkter().map((p) => ({ id: p.id, navn: p.navn }));
}

const vask = (s) => String(s ?? "").toLowerCase();

// Rekkefølgen betyr noe: det mest spesifikke først. Treff fjernes fra teksten,
// slik at «oljefilter» ikke også gir «motorolje». Skrivemåter fra ekte historikk er med
// («veske», «forran», «regreim», «pollefilter», «skriver»).
const V = "v[æae]ske";
const REGLER = [
  // Oljer, væsker og filtre
  [new RegExp(`bremse\\s*-?${V}`), "bremsevaeske"],
  [new RegExp(`kj[øo]le\\s*-?${V}|frost\\s*-?${V}|glykol`), "kjolevaeske"],
  [new RegExp(`spyler\\s*-?${V}`), "spylervaeske"],
  [/servo\s*-?olje/, "servostyring"],
  [/diesel\s*-?filter|drivstoff\s*-?filter/, "drivstoffilter-diesel"],
  [/oljekj[øo]ler/, "oljekjoler"],
  [/oljepumpe/, "oljepumpe"],
  [/olje\s*-?filter/, "oljefilter"],
  [/luft\s*-?filter/, "luftfilter"],
  [/pollen?\s*-?filter|kup[ée]\s*-?filter/, "pollenfilter"],
  [/overf[øo]ring|transfer/, "overforing"],
  [/manuell|manuelt gir/, "manuelt-gir"],
  [/(?:automat)?gir(?:kasse)?\s*-?filter/, "automatgirfilter"],
  [/automatgir\s*-?olje|automatgir|gir(?:kasse)?\s*-?olje|gear\s*-?olje|\batf\b/, "automatgir"],
  [/ac\s*-?gass/, "ac-gass"],
  // Bremser
  [/br[ae]mse\s*-?klos|klosse/, "bremseklosser"],
  [/br[ae]mse\s*-?skiv|\bskiver\b|-?skriver\b/, "bremseskiver"],
  [/caliper|kaliper|bremsesadel/, "bremsecaliper"],
  [/bremse\s*-?slang/, "bremseslanger"],
  [/bremse\s*-?r[øo]r/, "bremseror"],
  [/h[åa]ndbrems|parkbrems|parkeringsbrems/, "parkbrems"],
  [/slitasjesensor/, "slitasjesensor-brems"],
  [/\babs\b/, "abs-sensor"],
  // Fjæring og demping (før styring, så «nivåsensor luftfjær» ikke blir noe annet)
  [/mansjett\s+(?:p[åa]\s+)?luft\s*-?(?:demper|belg|fj[æa]r)|luft\s*-?(?:demper|belg)\s*-?mansjett/, "luftfjaerbelg"],
  [/niv[åa]\s*-?sensor|h[øo]ydesensor/, "nivasensor"],
  [/luft\s*-?t[øo]rker/, "lufttorker"],
  [/kompressor\s*-?rel[ée]/, "kompressorrele"],
  [/ac\s*-?kompressor|klima\s*-?kompressor/, "ac-kompressor"],
  [/kompressor/, "luftkompressor"],
  [/luft\s*-?tank/, "lufttank"],
  [/ventil\s*-?blokk/, "ventilblokk"],
  [/luft\s*-?(r[øo]r|slange)/, "luftror"],
  [/luft\s*-?(demper|belg|fj[æa]r)/, "luftfjaerbelg"],
  [/toppfeste|fj[æa]rbeinslager/, "toppfeste"],
  [/st[øo]t\s*-?d[ae]mper|\bst[øo]d\b|\bdempere?\b/, "stotdemper"],
  [/spiral\s*-?fj[æa]r|\bfj[æa]rer\b/, "spiralfjaer"],
  // Hjuloppheng og styring
  [/hjul\s*-?lager|\bnav\b/, "hjullager"],
  [/hjulstilling/, "hjulstilling"],
  [/stabilisator\s*-?foring|stab\s*-?foring/, "stabilisatorforinger"],
  [/stabilisator|stab\s*-?stag/, "stabilisatorstag"],
  [/indre\s+og\s+ytre\s+styreledd|styreledd\s+indre\s+og\s+ytre/, "indre-styreledd+ytre-styreledd"],
  [/indre\s*-?styreledd|aksialledd|styreledd\s+indre/, "indre-styreledd"],
  [/ytre\s*-?styreledd|endeledd|styreledd/, "ytre-styreledd"],
  [/styre\s*-?(snekke|stativ|boks)/, "styresnekke"],
  [/styre\s*-?stag/, "styrestag"],
  [/rattstamme/, "rattstamme"],
  [/rattaksling|kryssledd/, "rattaksling"],
  [/foring\s+[øo]vre|[øo]vre\s+b[æa]rearm\s*-?foring|b[æa]rearm\s*-?foring\s+[øo]vre/, "foring-ovre-fremre"],
  [/b[æa]rearm\s*-?foring|foring/, "foring-nedre-fremre"],
  [/kuleledd\s+[øo]vre|[øo]vre\s+kuleledd/, "ovre-kuleledd"],
  [/kuleledd|b[æa]rekule/, "nedre-kuleledd"],
  [/b[æa]rearm\s+[øo]vre|[øo]vre\s+b[æa]rearm/, "ovre-baerearm"],
  [/b[æa]rearm/, "nedre-baerearm"],
  // Drivlinje
  [/drivaksel\s*-?mansjett|mansjett/, "drivakselmansjett"],
  [/drivaksel/, "drivakselledd"],
  [/mellomaksel/, "mellomaksel"],
  [/kardang?/, "kardanaksel"],
  [/clutch|svinghjul/, "clutch"],
  [/girkasse\s*-?feste/, "girkassefester"],
  [/gir\s*-?velger|gear\s*-?velger|gir\s*-?kabel/, "girvelger"],
  [/girkasse|gearkasse|torque|momentomformer|solenoid/, "girkasse"],
  // Motor
  [/multi\s*-?reim|aggregatreim|dynamo\s*-?reim|vifte\s*-?reim/, "multireim"],
  [/h[øo]ytrykkspumpe\s*-?reim/, "hoytrykkspumpereim"],
  [/reg(?:ister)?\s*-?reim|\breim/, "registerreim"],
  [/registerkjede|kamkjede/, "registerkjede"],
  [/servopumpe/, "servopumpe"],
  [/vannpumpe/, "vannpumpe"],
  [/termostat/, "termostat"],
  [/intercooler|kj[øo]ler\b|radiator/, "kjoler"],
  [/kup[ée]\s*-?vifte/, "kupevifte"],
  [/vifte/, "kjolevifte"],
  [/turbo/, "turbo"],
  [/gl[øo]de\s*-?plugg/, "gloeplugger"],
  [/tenn\s*-?plugg/, "tennplugger"],
  [/\bcoil|tennspole/, "coil"],
  [/\bdyse|injektor/, "injektorer"],
  [/sveivhus|oljeutskiller/, "sveivhusventilasjon"],
  [/motor\s*-?feste/, "motorfester"],
  [/ventil\s*-?deksel/, "ventildekselpakning"],
  // Avgass
  [/\begr/, "egr"],
  [/\bdpf|partikkelfilter/, "dpf"],
  [/katalysator/, "katalysator"],
  [/lambda/, "lambdasonde"],
  [/adblue/, "adblue"],
  [/eksos|lyddemper/, "eksos"],
  // Elektrisk og lys
  [/motorvarmer|\bdefa\b|calix/, "motorvarmer"],
  [/batteri/, "batteri"],
  [/dynamo|generator/, "dynamo"],
  [/startmotor/, "startmotor"],
  [/lyktjuster/, "lyktjustering"],
  [/lysp[æa]re|\bp[æa]rer?\b/, "lyspaerer"],
  [/sikring|\brel[ée]/, "sikringer"],
  [/hengerkontakt/, "hengerkontakt"],
  // Dekk og hjul
  [/dekkskift|hjulskift|skift(?:e|et)? (?:av )?hjul/, "dekkskift"],
  [/nye dekk|nye (?:vinter|sommer)dekk/, "nye-dekk"],
  [/balanser/, "hjulbalansering"],
  [/tpms|dekktrykksensor/, "tpms"],
  [/felg/, "felger"],
  // Klima og kupé
  [/\bac\b|aircon|klimaanlegg/, "ac-service"],
  [/setevarme|varmeapparat|mellomvarme/, "varmeapparat"],
  // Karosseri og understell
  [/vann\s*-?kanal|soltak|avl[øo]p/, "avlop"],
  [/rust\s*-?rep|reparert rust|rust i ramme|sveis|kanaler|terskel/, "rustreparasjon"],
  [/rust|te[ck]tyl|understell/, "rustbehandling"],
  [/hengsl|d[øo]rl[åa]s/, "smoring-dorer"],
  [/hengerfeste|tilhengerfeste/, "hengerfeste"],
];

// Differensialolje: «Diffolje forran og bak» gir begge, «diffolje bak» bare bak
const DIFF = /diff\w*\s*-?olje(?:[^,.;]*?(?:foran|forran|fremme|framme|\bbak\b))*/;
function diffOlje(t) {
  const m = t.match(DIFF);
  if (!m) return [];
  const foran = /foran|forran|fremme|framme/.test(m[0]);
  const bak = /\bbak\b/.test(m[0]);
  if (foran && !bak) return ["diff-foran"];
  if (bak && !foran) return ["diff-bak"];
  return ["diff-foran", "diff-bak"];
}

/**
 * Motorolje og oljefilter byttes nesten alltid samtidig, så de følger hverandre.
 * @param {string[]} deler
 * @returns {string[]}
 */
export function utvidDeler(deler) {
  const s = new Set(deler ?? []);
  if (s.has("motorolje")) s.add("oljefilter");
  if (s.has("oljefilter")) s.add("motorolje");
  return [...s];
}

/**
 * @param {string} komponent  Kategori, f.eks. "bremser", "motor", "service"
 * @param {string} [tekst]    Fritekst fra notat eller type
 * @returns {string[]}        Id-er på servicepunkter, tom liste hvis ingen kunne avgjøres
 */
export function gjettServicepunkter(komponent, tekst) {
  let t = vask(tekst);
  const funnet = [];
  funnet.push(...diffOlje(t));
  t = t.replace(new RegExp(DIFF.source, "g"), " ");
  for (const [moenster, punkt] of REGLER) {
    if (new RegExp(moenster.source).test(t)) {
      if (punkt) funnet.push(...punkt.split("+"));
      t = t.replace(new RegExp(moenster.source, "g"), " ");
    }
  }
  if (/\bolje(?:skift)?\b|motorolje/.test(t) && (komponent === "motor" || komponent === "service")) funnet.push("motorolje");
  if (komponent === "motor" && funnet.length === 0) funnet.push("motorolje");
  // «Ekstra service» alene er bare en merkelapp, så det tas bare når ingen av de faste delene er funnet
  if (funnet.length === 0 && /ekstra service/.test(vask(tekst))) return ["ekstra-service"];
  return utvidDeler([...new Set(funnet)]);
}

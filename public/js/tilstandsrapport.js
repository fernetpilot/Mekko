// Tilstandsrapport for salg av bil: samler det en kjøper trenger å vite på ett sted.
// Bygget etter samme mønster som tilstandsrapporter for bolig (tilstandsgrader TG0–TG3) og
// områdene i NAF-test ved eierskifte (motor/drivverk, bremser, hjuloppheng, styring, understell, karosseri, lys, interiør).
//
// Ren logikk: ingen DOM, ingen nettverk. Brukes av tilstandsrapport-siden og PDF-en.
// Det som ikke kan leses ut av historikken (tilstand per område, kollisjonsskader, nøkler …),
// fyller selgeren inn selv – det er en egenerklæring, ikke en profesjonell test.

import { hentKjoretoy, bilEgenskaper } from "./kjoretoy.js";
import { registrertFarge } from "./bilfarge.js";
import { euStatus, formaterDato } from "./bilstatus.js";
import { kategorierFor, hendelseTittel } from "./kategorier.js";
import { etterBoka } from "./etter-boka.js";
import { alleFrister, sorterFrister, sorterHendelser } from "./dashboard.js";
import { settNavn, vurderSett } from "./dekk.js";

/** Tilstandsgrader, som i boligsalg. */
export const TILSTANDSGRADER = [
  { id: "TG0", navn: "Ingen avvik", tekst: "Som forventet for alderen, ingen kjente feil." },
  { id: "TG1", navn: "Normal slitasje", tekst: "Mindre avvik eller vanlig slitasje. Ikke behov for tiltak nå." },
  { id: "TG2", navn: "Avvik", tekst: "Feil eller slitasje som bør utbedres på sikt." },
  { id: "TG3", navn: "Store avvik", tekst: "Feil som bør utbedres snart, eller som påvirker sikkerheten." },
  { id: "TGIU", navn: "Ikke vurdert", tekst: "Selgeren har ikke vurdert området." },
];
export const tilstandsgrad = (id) => TILSTANDSGRADER.find((t) => t.id === id) ?? TILSTANDSGRADER.at(-1);

/**
 * Områdene i rapporten. kategorier er kategoriene i servicekatalogen, så vi kan vise
 * siste dokumenterte arbeid på området. sjekk er hva selgeren bør se etter.
 */
export const OMRADER = [
  { id: "motor", navn: "Motor og avgass", kategorier: ["motor", "oljer", "avgass"],
    sjekk: "Starter den lett, går den jevnt? Oljelekkasjer, røyk, uvanlige lyder, motorlampe." },
  { id: "drivlinje", navn: "Girkasse og drivlinje", kategorier: ["drivlinje"],
    sjekk: "Girskift, clutch, lyder fra drivaksler og firehjulstrekk." },
  { id: "bremser", navn: "Bremser", kategorier: ["bremser"],
    sjekk: "Klosser og skiver, ujevn bremsing, parkbrems, ABS-lampe." },
  { id: "styring", navn: "Hjuloppheng og styring", kategorier: ["styring"],
    sjekk: "Slark i rattet, ujevn dekkslitasje, lyder over dumper, bilen trekker til siden." },
  { id: "fjaering", navn: "Fjæring og demping", kategorier: ["fjaering"],
    sjekk: "Støtdempere, fjærer, eventuell luftfjæring og nivå." },
  { id: "understell", navn: "Understell og rust", kategorier: ["karosseri"],
    sjekk: "Rust i ramme, terskler og bunnplate. Rustbehandling." },
  { id: "karosseri", navn: "Karosseri og lakk", kategorier: [],
    sjekk: "Bulker, riper, lakkskader, ruter og lykter." },
  { id: "elektrisk", navn: "Elektrisk og lys", kategorier: ["elektrisk"],
    sjekk: "Batteri, lys, vinduer, sentrallås, varsellamper." },
  { id: "dekk", navn: "Dekk og felger", kategorier: ["dekk"],
    sjekk: "Mønsterdybde, alder på dekkene, skader på felger." },
  { id: "interior", navn: "Interiør, klima og kupé", kategorier: ["klima"],
    sjekk: "Seter, slitasje, lukt, AC og varme, infotainment." },
];

/** Egenerklæringen: spørsmål en kjøper ofte stiller. */
export const SPORSMAL = [
  { id: "kollisjon", tekst: "Har bilen vært kollisjonsskadet, eller hatt større karosseriskader?", type: "janei", utdyp: "Beskriv skaden og hvordan den ble reparert", obs: "Har vært kollisjonsskadet" },
  { id: "kjente_feil", tekst: "Kjenner du til feil eller mangler som ikke er utbedret?", type: "janei", utdyp: "Beskriv feilene", obs: "Kjente feil som ikke er utbedret" },
  { id: "varsellamper", tekst: "Lyser det varsellamper på dashbordet nå?", type: "janei", utdyp: "Hvilke lamper?", obs: "Varsellamper lyser" },
  { id: "royk", tekst: "Har det vært røykt i bilen?", type: "janei" },
  { id: "dyr", tekst: "Har det vært dyr i bilen?", type: "janei" },
  { id: "nokler", tekst: "Antall nøkler som følger med", type: "tall" },
  { id: "utstyr", tekst: "Ekstrautstyr som følger med (f.eks. hengerfeste, takstativ, ekstra hjulsett)", type: "tekst" },
  { id: "kommentar", tekst: "Annet kjøper bør vite", type: "tekst" },
];

export const SVAR_NAVN = { ja: "Ja", nei: "Nei", vet_ikke: "Vet ikke" };

/** Tom egenvurdering: alle områder «Ikke vurdert». */
export function tomEgenvurdering() {
  return {
    omrader: Object.fromEntries(OMRADER.map((o) => [o.id, { tg: "TGIU", kommentar: "" }])),
    svar: {},
    visKostnader: true,
  };
}

/** Lagret egenvurdering slått sammen med standardverdiene (tåler eldre/ufullstendige data). */
export function lesEgenvurdering(data) {
  const tom = tomEgenvurdering();
  const d = data && typeof data === "object" ? data : {};
  for (const o of OMRADER) {
    const lagret = d.omrader?.[o.id] ?? {};
    tom.omrader[o.id] = {
      tg: TILSTANDSGRADER.some((t) => t.id === lagret.tg) ? lagret.tg : "TGIU",
      kommentar: String(lagret.kommentar ?? "").slice(0, 500),
    };
  }
  for (const s of SPORSMAL) {
    const lagret = d.svar?.[s.id];
    if (lagret != null) tom.svar[s.id] = { svar: lagret.svar ?? "", utdyp: String(lagret.utdyp ?? "").slice(0, 1000) };
  }
  if (typeof d.visKostnader === "boolean") tom.visKostnader = d.visKostnader;
  return tom;
}

/**
 * Fakta om bilen fra Vegvesenets API-svar (hentes når rapporten lages, lagres ikke hos oss).
 * Tåler at svaret mangler: da blir feltene null.
 */
export function kjoretoyFakta(apiSvar) {
  const k = apiSvar?.kjoretoydataListe?.[0];
  if (!k) return {};
  let basis = {};
  try { basis = hentKjoretoy(apiSvar); } catch { /* tomt svar */ }
  const egenskaper = bilEgenskaper(apiSvar);
  const td = k.godkjenning?.tekniskGodkjenning?.tekniskeData ?? {};
  const motor = td.motorOgDrivverk?.motor?.[0];
  const kw = motor?.drivstoff?.[0]?.maksNettoEffekt ?? null;
  const gir = td.motorOgDrivverk?.girkassetype?.kodeNavn ?? null;
  return {
    understellsnummer: k.kjoretoyId?.understellsnummer ?? null,
    forstegangsregistrert: basis.forstegangsregistrert ?? null,
    registrertNorge: k.forstegangsregistrering?.registrertForstegangNorgeDato ?? null,
    bruktimportFra: k.godkjenning?.forstegangsGodkjenning?.bruktimport?.importland?.landNavn ?? null,
    eierSiden: k.registrering?.registrertForstegangPaEierskap?.slice(0, 10) ?? null,
    farge: registrertFarge(apiSvar),
    drivstoff: motor?.drivstoff?.[0]?.drivstoffKode?.kodeNavn ?? egenskaper.drivstoff,
    effekt: kw ? `${kw} kW (${Math.round(kw * 1.36)} hk)` : null,
    slagvolum: motor?.slagvolum ? `${(motor.slagvolum / 1000).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} liter` : null,
    girkasse: gir ?? (egenskaper.girkasse === "automat" ? "Automat" : egenskaper.girkasse === "manuell" ? "Manuell" : null),
    drift: egenskaper.drift === "4x4" ? "Firehjulstrekk" : egenskaper.drift === "foran" ? "Forhjulstrekk" : egenskaper.drift === "bak" ? "Bakhjulstrekk" : null,
    sitteplasser: td.persontall?.sitteplasserTotalt ?? null,
    euroKlasse: td.miljodata?.euroKlasse?.kodeNavn ?? null,
    hengervekt: basis.vekter?.tillattTilhengervektMedBrems ?? null,
    euSistGodkjent: basis.euSistGodkjent ?? null,
    euKontrollfrist: basis.euKontrollfrist ?? null,
  };
}

// Notatet uten merkelappen importen legger på («– Type service: Ekstra Service»)
const renNotat = (t) => String(t ?? "").replace(/\s+[–·-]\s+type service:[^\n]*$/i, "").trim();

// Rutinearbeid som ikke regnes som «utbedringer» (det vises under service etter boka)
const RUTINE = new Set(["oljer", "service", "eu_kontroll"]);
const UTBEDRINGER_AAR = 5;

/**
 * Lager hele rapporten.
 * @param {object} p
 * @param {object} p.bil         rad fra `biler` med vedlikehold (med dokumenter) og gjerne dekksett
 * @param {object} [p.kjoretoy]  kjoretoyFakta(apiSvar)
 * @param {object} [p.egen]      selgerens egenvurdering (lesEgenvurdering)
 * @param {Date}   [p.idag]
 */
export function lagTilstandsrapport({ bil, kjoretoy = {}, egen = tomEgenvurdering(), idag = new Date() }) {
  const iDag = idag.toISOString().slice(0, 10);
  const hendelser = sorterHendelser(bil?.vedlikehold ?? []).filter((h) => h.dato && h.dato <= iDag);
  const kmNaa = bil?.kilometerstand ?? null;
  const visKr = egen.visKostnader !== false;

  // EU-kontroll: helst ferske tall fra Vegvesenet
  const euFrist = kjoretoy.euKontrollfrist ?? bil?.eu_kontrollfrist ?? null;
  const eu = { sistGodkjent: kjoretoy.euSistGodkjent ?? null, frist: euFrist, ...euStatus(euFrist, idag) };

  // Historikken samlet
  const antallVedlegg = hendelser.reduce((n, h) => n + (h.dokumenter?.length ?? 0), 0);
  const medVedlegg = hendelser.filter((h) => h.dokumenter?.length).length;
  const totalKostnad = hendelser.reduce((n, h) => n + (Number(h.kostnad) || 0), 0);
  const sisteService = hendelser.find((h) => kategorierFor(h).some((k) => k.id === "oljer" || k.id === "service")) ?? null;
  const historikk = {
    antall: hendelser.length,
    forste: hendelser.at(-1)?.dato ?? null,
    siste: hendelser[0]?.dato ?? null,
    medVedlegg,
    antallVedlegg,
    totalKostnad: visKr ? totalKostnad : null,
    sisteService: sisteService && { dato: sisteService.dato, km: sisteService.kilometerstand ?? null, tittel: hendelseTittel(sisteService) },
    aar: hendelser.length ? Math.max(1, Number(iDag.slice(0, 4)) - Number(hendelser.at(-1).dato.slice(0, 4)) + 1) : 0,
  };

  // Fulgt etter boka: hvor mange bytter som skjedde i tide
  const boka = etterBoka({ ...bil, vedlikehold: hendelser }, idag);
  const etter = {
    maalt: boka.maalt,
    iTide: boka.iTide,
    andel: boka.maalt ? boka.iTide / boka.maalt : null,
    punkter: boka.punkter.map((p) => ({
      navn: p.navn,
      antall: p.jobber.length,
      siste: p.jobber.at(-1)?.dato ?? null,
      sisteKm: p.jobber.at(-1)?.km ?? null,
      status: p.status,
      iTide: p.iTide,
      maalt: p.maalt,
      intervall: [p.kmIntervall && `${p.kmIntervall.toLocaleString("nb-NO")} km`, p.manederIntervall && `${p.manederIntervall} mnd`]
        .filter(Boolean).join(" / "),
    })),
  };

  // Større arbeid de siste årene (alt som ikke bare er olje/filter/service/EU)
  const grense = `${Number(iDag.slice(0, 4)) - UTBEDRINGER_AAR}${iDag.slice(4)}`;
  const utbedringer = hendelser
    .filter((h) => h.dato >= grense)
    .map((h) => ({ h, kategorier: kategorierFor(h).filter((k) => !RUTINE.has(k.id)) }))
    .filter(({ kategorier }) => kategorier.length)
    .map(({ h, kategorier }) => ({
      dato: h.dato,
      km: h.kilometerstand ?? null,
      tittel: hendelseTittel(h),
      deler: kategorier.flatMap((k) => k.delNavn),
      notat: renNotat(h.notat),
      utfortAv: h.utfort_av ?? null,
      kostnad: visKr && h.kostnad != null ? Number(h.kostnad) : null,
      vedlegg: h.dokumenter?.length ?? 0,
    }));

  // Det som forfaller eller snart bør gjøres – ærlig informasjon til kjøper
  const kommende = sorterFrister(alleFrister({ ...bil, vedlikehold: hendelser, eu_kontrollfrist: euFrist }, idag))
    .filter((f) => f.status === "forfalt" || f.status === "snart")
    .map((f) => ({ navn: f.navn, status: f.status, tekst: f.tekst }));

  // Dekk
  const dekk = (bil?.dekksett ?? []).map((s) => {
    const v = vurderSett(s, iDag);
    return {
      navn: settNavn(s),
      paBilen: Boolean(s.pa_bilen),
      produksjonsaar: s.produksjonsaar ?? null,
      monsterdybde: s.monsterdybde_mm != null ? Number(s.monsterdybde_mm) : null,
      maalt: s.maalt ?? null,
      status: v.status,
      tekst: v.tekst,
    };
  });

  // Områdene: selgerens vurdering + siste dokumenterte arbeid fra historikken
  const omrader = OMRADER.map((o) => {
    const arbeid = hendelser.filter((h) => kategorierFor(h).some((k) => o.kategorier.includes(k.id)));
    const vurdering = egen.omrader?.[o.id] ?? { tg: "TGIU", kommentar: "" };
    return {
      id: o.id,
      navn: o.navn,
      tg: vurdering.tg,
      tgNavn: tilstandsgrad(vurdering.tg).navn,
      kommentar: vurdering.kommentar ?? "",
      antallArbeid: arbeid.length,
      sisteArbeid: arbeid[0] ? { dato: arbeid[0].dato, tittel: hendelseTittel(arbeid[0]) } : null,
    };
  });

  const egenerklaering = SPORSMAL.map((s) => {
    const svar = egen.svar?.[s.id] ?? {};
    let tekst = "";
    if (s.type === "janei") tekst = SVAR_NAVN[svar.svar] ?? "";
    else tekst = String(svar.svar ?? "").trim();
    return { id: s.id, sporsmal: s.tekst, svar: tekst || "Ikke besvart", besvart: Boolean(tekst), utdyp: (svar.utdyp ?? "").trim() };
  });

  return {
    laget: iDag,
    bil: {
      kjennemerke: bil?.kjennemerke ?? "",
      navn: [bil?.merke, bil?.modell].filter(Boolean).join(" "),
      kilometerstand: kmNaa,
      ...kjoretoy,
    },
    eu,
    historikk,
    etterBoka: etter,
    utbedringer,
    kommende,
    dekk,
    omrader,
    egenerklaering,
    sammendrag: lagSammendrag({ eu, historikk, etter, kommende, omrader, egenerklaering, dekk }),
  };
}

/** Korte punkter øverst i rapporten: det viktigste først, både positivt og det kjøper bør vite. */
function lagSammendrag({ eu, historikk, etter, kommende, omrader, egenerklaering, dekk }) {
  const ut = [];
  const pluss = (tekst) => ut.push({ type: "pluss", tekst });
  const obs = (tekst) => ut.push({ type: "obs", tekst });

  if (eu.status === "ok") pluss(`EU-godkjent${eu.sistGodkjent ? ` ${formaterDato(eu.sistGodkjent)}` : ""}, neste frist ${formaterDato(eu.frist)}`);
  else if (eu.status === "sjekk") obs(`EU-kontroll snart: ${eu.tekst}`);
  else if (eu.status === "kritisk") obs(`EU-kontrollen er ikke gjort: ${eu.tekst}`);

  if (historikk.antall) {
    pluss(`${historikk.antall} registrerte vedlikeholdshendelser fra ${formaterDato(historikk.forste)}`
      + (historikk.antallVedlegg ? `, ${historikk.antallVedlegg} kvitteringer/dokumenter` : ""));
  } else {
    obs("Ingen vedlikeholdshistorikk er registrert");
  }
  if (etter.maalt) {
    const prosent = Math.round(etter.andel * 100);
    (prosent >= 80 ? pluss : obs)(`${prosent} % av målbare service-bytter er gjort innen anbefalt intervall`);
  }
  const forfalt = kommende.filter((k) => k.status === "forfalt");
  if (forfalt.length) obs(`Forfalt vedlikehold: ${forfalt.map((k) => k.navn).join(", ")}`);

  const tg3 = omrader.filter((o) => o.tg === "TG3");
  const tg2 = omrader.filter((o) => o.tg === "TG2");
  if (tg3.length) obs(`Store avvik (TG3): ${tg3.map((o) => o.navn).join(", ")}`);
  if (tg2.length) obs(`Avvik som bør utbedres (TG2): ${tg2.map((o) => o.navn).join(", ")}`);
  const vurdert = omrader.filter((o) => o.tg !== "TGIU");
  if (vurdert.length && !tg2.length && !tg3.length) pluss(`Ingen kjente avvik på ${vurdert.length} vurderte områder`);

  for (const e of egenerklaering) {
    const s = SPORSMAL.find((x) => x.id === e.id);
    if (s?.obs && e.svar === "Ja") obs(`${s.obs}${e.utdyp ? `: ${e.utdyp}` : ""}`);
  }
  for (const d of dekk.filter((x) => x.status === "forfalt")) obs(`${d.navn}: ${d.tekst}`);
  return ut;
}

// Gjør hele API-svaret fra Statens vegvesen om til lesbare seksjoner for «Mine biler».
// Ren logikk: ingen DOM, ingen nettverk. Tomme felt utelates.
// Feltoversikt: docs/api-felter.md

import { formaterDato } from "./bilstatus.js";

/** Kodeobjekter ({ kodeNavn, kodeBeskrivelse, kodeVerdi }) eller vanlig tekst → tekst */
function tekst(v) {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v.length ? tekst(v[0]) : null;
  if (typeof v === "object") return v.kodeNavn ?? v.kodeBeskrivelse ?? v.kodeVerdi ?? null;
  return String(v);
}

const tall = (n) => (typeof n === "number" ? n.toLocaleString("nb-NO") : null);
const medEnhet = (n, enhet) => (typeof n === "number" ? `${tall(n)} ${enhet}` : null);
const jaNei = (b) => (b === true ? "Ja" : b === false ? "Nei" : null);
const dato = (d) => (d ? formaterDato(String(d).slice(0, 10)) : null);

function seksjon(tittel, rader) {
  const fylte = rader.filter(([, verdi]) => verdi != null && verdi !== "");
  return fylte.length ? { tittel, rader: fylte } : null;
}

/**
 * @param {object} apiSvar JSON fra /api/kjoretoy
 * @returns {{ tittel: string, rader: [string, string][] }[]}
 */
export function kjoretoyDetaljer(apiSvar) {
  const k = apiSvar?.kjoretoydataListe?.[0];
  if (!k) return [];

  const fg = k.godkjenning?.forstegangsGodkjenning ?? {};
  const tg = k.godkjenning?.tekniskGodkjenning ?? {};
  const kl = tg.kjoretoyklassifisering ?? {};
  const td = tg.tekniskeData ?? {};
  const gen = td.generelt ?? {};
  const v = td.vekter ?? {};
  const motor = td.motorOgDrivverk?.motor?.[0] ?? {};
  const drivstoff = motor.drivstoff?.[0] ?? {};
  const miljo = td.miljodata?.miljoOgdrivstoffGruppe?.[0] ?? {};
  const utslipp = miljo.forbrukOgUtslipp?.[0] ?? {};
  const aksler = td.akslinger ?? {};
  const forsteAksel = aksler.akselGruppe?.[0]?.akselListe?.aksel?.[0] ?? {};
  const kopling = td.tilhengerkopling?.kopling?.[0] ?? null;
  const bruktimport = fg.bruktimport ?? null;

  const kw = drivstoff.maksNettoEffekt;
  const effekt = typeof kw === "number" ? `${tall(kw)} kW (${tall(Math.round(kw * 1.36))} hk)` : null;

  // Dekk og felg: første godkjente kombinasjon, én rad per aksel
  const kombinasjoner = td.dekkOgFelg?.akselDekkOgFelgKombinasjon ?? [];
  const dekkRader = (kombinasjoner[0]?.akselDekkOgFelg ?? []).map((a) => [
    `Aksel ${a.akselId ?? ""}`.trim(),
    [
      [a.dekkdimensjon, [a.belastningskodeDekk, a.hastighetskodeDekk].filter(Boolean).join("")].filter(Boolean).join(" "),
      a.felgdimensjon ? `felg ${a.felgdimensjon}` : null,
      a.innpress ? `ET${a.innpress}` : null,
      a.tvilling ? "tvilling" : null,
    ].filter(Boolean).join(", ") || null,
  ]);
  if (kombinasjoner.length > 1) {
    dekkRader.push(["Godkjente kombinasjoner", String(kombinasjoner.length)]);
  }

  return [
    seksjon("Registrering", [
      ["Skiltnummer", k.kjoretoyId?.kjennemerke],
      ["Understellsnummer (VIN)", k.kjoretoyId?.understellsnummer],
      ["Status", tekst(k.registrering?.registreringsstatus)],
      ["Første gang registrert", dato(fg.forstegangRegistrertDato)],
      ["Første gang registrert i Norge", dato(k.forstegangsregistrering?.registrertForstegangNorgeDato)],
      ["Nåværende eier siden", dato(k.registrering?.registrertForstegangPaEierskap)],
      ["Kjøringens art", tekst(k.registrering?.kjoringensArt)],
      ["Bruktimportert fra", bruktimport ? tekst(bruktimport.importland?.landNavn) : null],
    ]),
    seksjon("EU-kontroll", [
      ["Neste frist", dato(k.periodiskKjoretoyKontroll?.kontrollfrist)],
      ["Sist godkjent", dato(k.periodiskKjoretoyKontroll?.sistGodkjent)],
    ]),
    seksjon("Kjøretøy", [
      ["Merke", gen.merke?.[0]?.merke],
      ["Modell", tekst(gen.handelsbetegnelse)],
      ["Typebetegnelse", gen.typebetegnelse],
      ["Kjøretøygruppe", tekst(kl.tekniskKode) ?? kl.beskrivelse],
      ["Kjennetegn", kl.spesielleKjennetegn],
      ["Farge", tekst(td.karosseriOgLasteplan?.rFarge)],
      ["Antall dører", tekst(td.karosseriOgLasteplan?.antallDorer)],
      ["Sitteplasser", tall(td.persontall?.sitteplasserTotalt)],
      ["Godkjenning", tekst(tg.godkjenningsundertype)],
    ]),
    seksjon("Motor og miljø", [
      ["Drivstoff", tekst(drivstoff.drivstoffKode) ?? tekst(miljo.drivstoffKodeMiljodata)],
      ["Effekt", effekt],
      ["Slagvolum", medEnhet(motor.slagvolum, "cm³")],
      ["Hybrid", tekst(td.motorOgDrivverk?.hybridKategori)],
      ["Maks hastighet", medEnhet(td.motorOgDrivverk?.maksimumHastighet?.[0], "km/t")],
      ["Euroklasse", tekst(td.miljodata?.euroKlasse)],
      ["Forbruk, blandet kjøring", typeof utslipp.forbrukBlandetKjoring === "number" ? `${tall(utslipp.forbrukBlandetKjoring)} per 100 km` : null],
      ["CO₂, blandet kjøring", medEnhet(utslipp.co2BlandetKjoring, "g/km")],
      ["NOx", medEnhet(utslipp.utslippNOxMgPrKm, "mg/km")],
      ["Partikkelfilter fra fabrikk", jaNei(utslipp.partikkelfilterFabrikkmontert)],
      ["Støy (stillestående)", medEnhet(miljo.lyd?.standstoy, "dB")],
    ]),
    seksjon("Vekter", [
      ["Egenvekt", medEnhet(v.egenvekt, "kg")],
      ["Nyttelast", medEnhet(v.nyttelast, "kg")],
      ["Tillatt totalvekt", medEnhet(v.tillattTotalvekt, "kg")],
      ["Tilhengervekt med brems", medEnhet(v.tillattTilhengervektMedBrems, "kg")],
      ["Tilhengervekt uten brems", medEnhet(v.tillattTilhengervektUtenBrems, "kg")],
      ["Vogntogvekt", medEnhet(v.tillattVogntogvekt, "kg")],
      ["Kuletrykk", medEnhet(v.tillattVertikalKoplingslast, "kg")],
    ]),
    seksjon("Dekk og felg", dekkRader),
    seksjon("Mål og aksler", [
      ["Lengde", medEnhet(td.dimensjoner?.lengde, "mm")],
      ["Bredde", medEnhet(td.dimensjoner?.bredde, "mm")],
      ["Antall aksler", tall(aksler.antallAksler)],
      ["Akselavstand", medEnhet(forsteAksel.avstandTilNesteAksling, "mm")],
      ["Sporvidde foran", medEnhet(forsteAksel.sporvidde, "mm")],
    ]),
    kopling && seksjon("Tilhengerkopling", [
      ["Type", tekst(kopling.type)],
      ["Fabrikant", kopling.fabrikantKopling],
      ["Belastning", medEnhet(kopling.belastningSverdi, "kg")],
    ]),
  ].filter(Boolean);
}

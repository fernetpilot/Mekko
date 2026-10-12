// Henter ut det beregningen trenger fra Vegvesenets API-svar.
// Ren logikk – ingen nettverkskall.

/** «br 67 285» → «BR67285». Gir null hvis det ikke ligner et norsk skiltnummer. */
export function normaliserSkilt(tekst) {
  const s = String(tekst ?? "").toUpperCase().replace(/[\s-]/g, "");
  return /^[A-ZÆØÅ0-9]{2,7}$/.test(s) ? s : null;
}

/**
 * @param {object} apiSvar JSON fra /api/kjoretoy
 * @returns {{ kjennemerke, merke, modell, tekniskKode, erTilhenger, vekter }}
 */
export function hentKjoretoy(apiSvar) {
  const k = apiSvar?.kjoretoydataListe?.[0];
  if (!k) throw new Error("Fant ingen kjøretøydata i svaret.");

  const tg = k.godkjenning?.tekniskGodkjenning ?? {};
  const td = tg.tekniskeData ?? {};
  const v = td.vekter ?? {};
  const kode = tg.kjoretoyklassifisering?.tekniskKode ?? td.generelt?.tekniskKode ?? {};
  const tekniskKode = kode.kodeVerdi ?? kode.kodeNavn ?? "";

  return {
    kjennemerke: k.kjoretoyId?.kjennemerke ?? null,
    merke: td.generelt?.merke?.[0]?.merke ?? null,
    modell: td.generelt?.handelsbetegnelse?.[0] ?? null,
    beskrivelse: tg.kjoretoyklassifisering?.beskrivelse ?? null,
    tekniskKode,
    // Tilhengere har teknisk kode O1–O4.
    erTilhenger: /^O\d/i.test(tekniskKode),
    // Datoer som tekst på formen ÅÅÅÅ-MM-DD
    forstegangsregistrert:
      k.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato ??
      k.forstegangsregistrering?.registrertForstegangNorgeDato ?? null,
    euKontrollfrist: k.periodiskKjoretoyKontroll?.kontrollfrist ?? null,
    euSistGodkjent: k.periodiskKjoretoyKontroll?.sistGodkjent ?? null,
    vekter: {
      egenvekt: v.egenvekt ?? null,
      tillattTotalvekt: v.tillattTotalvekt ?? null,
      tillattTilhengervektMedBrems: v.tillattTilhengervektMedBrems ?? null,
      tillattTilhengervektUtenBrems: v.tillattTilhengervektUtenBrems ?? null,
      tillattVogntogvekt: v.tillattVogntogvekt ?? null,
      tillattVertikalKoplingslast: v.tillattVertikalKoplingslast ?? null,
    },
  };
}

// Modeller med luftfjæring fra fabrikk. Vognkortet sier ikke noe om fjæring, så dette er en liste vi utvider ved behov.
const LUFTFJAERING = /DISCOVERY [345]|RANGE ROVER/i;

/**
 * Det servicekatalogen trenger for å vise bare deler som passer bilen.
 * null betyr ukjent. Da vises alle deler for den egenskapen.
 * Girkasse står ikke i feltoversikten vår, så den leses forsiktig og er ofte null.
 * @param {object} apiSvar JSON fra /api/kjoretoy
 * @returns {{ drivstoff: "diesel"|"bensin"|"elektrisk"|null, drift: "foran"|"bak"|"4x4"|null,
 *             girkasse: "automat"|"manuell"|null, luftfjaering: true|null }}
 */
export function bilEgenskaper(apiSvar) {
  const k = apiSvar?.kjoretoydataListe?.[0];
  const td = k?.godkjenning?.tekniskGodkjenning?.tekniskeData ?? {};
  const kodetekst = (kode) => `${kode?.kodeVerdi ?? ""} ${kode?.kodeNavn ?? ""}`.toLowerCase();

  const drivstoffKoder = (td.motorOgDrivverk?.motor ?? [])
    .flatMap((m) => m.drivstoff ?? []).map((d) => kodetekst(d.drivstoffKode));
  const har = (ord) => drivstoffKoder.some((t) => t.includes(ord));
  const drivstoff = har("diesel") ? "diesel" : har("bensin") ? "bensin" : har("elektr") ? "elektrisk" : null;

  // Hvilke aksler som driver. Første aksel er foran.
  const aksler = (td.akslinger?.akselGruppe ?? []).flatMap((g) => g.akselListe?.aksel ?? []);
  const drevne = aksler.map((a) => a.drivAksel);
  let drift = null;
  if (drevne.length >= 2 && drevne.every((d) => typeof d === "boolean")) {
    if (drevne[0] && drevne.slice(1).some(Boolean)) drift = "4x4";
    else if (drevne[0]) drift = "foran";
    else if (drevne.slice(1).some(Boolean)) drift = "bak";
  }

  const gir = kodetekst(td.motorOgDrivverk?.girkassetype);
  const girkasse = gir.includes("automat") ? "automat" : gir.includes("manuell") ? "manuell" : null;

  const modell = `${td.generelt?.merke?.[0]?.merke ?? ""} ${td.generelt?.handelsbetegnelse?.[0] ?? ""}`;
  return { drivstoff, drift, girkasse, luftfjaering: LUFTFJAERING.test(modell) ? true : null };
}

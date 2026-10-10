// Henter ut det beregningen trenger fra Vegvesenets API-svar.
// Ren logikk – ingen nettverkskall.

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

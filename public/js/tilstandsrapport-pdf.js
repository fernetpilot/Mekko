// Tilstandsrapporten som PDF (A4), klar til å legges ved en salgsannonse.
// Ren modul uten DOM: pdf-lib sendes inn, så den kan testes i Node og gjenbrukes i en app.
// Innholdet kommer ferdig regnet fra lagTilstandsrapport (tilstandsrapport.js).

import { formaterDato, formaterKm } from "./bilstatus.js";

const A4 = [595.28, 841.89];
const M = 44; // marg
const B = A4[0] - M * 2;
const F = {
  tekst: [0.1, 0.1, 0.12], dempet: [0.42, 0.43, 0.46], linje: [0.86, 0.87, 0.89], flate: [0.96, 0.96, 0.97],
  topp: [0.09, 0.1, 0.12], hvit: [1, 1, 1],
  TG0: [0.2, 0.68, 0.33], TG1: [0.47, 0.72, 0.31], TG2: [0.93, 0.7, 0.05], TG3: [0.87, 0.2, 0.16], TGIU: [0.7, 0.71, 0.73],
  pluss: [0.2, 0.68, 0.33], obs: [0.93, 0.7, 0.05],
};
const kr = (n) => `${Math.round(n).toLocaleString("nb-NO").replace(/\s/g, " ")} kr`;

/**
 * @param {object} PDFLib  pdf-lib ({ PDFDocument, StandardFonts, rgb })
 * @param {object} p
 * @param {object} p.rapport        lagTilstandsrapport(...)
 * @param {Uint8Array} [p.vedlegg]  servicehefte-PDF som legges bakerst (valgfritt)
 * @returns {Promise<Uint8Array>}
 */
export async function lagTilstandsrapportPdf(PDFLib, { rapport: r, vedlegg = null }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const farge = (f) => rgb(...f);
  pdf.setTitle(`Tilstandsrapport ${r.bil.kjennemerke}`);
  pdf.setProducer("Mekkoo");
  pdf.setCreationDate(new Date(`${r.laget}T12:00:00`));

  // Standardfontene kan ikke alle tegn: bytt ut det som ikke kan skrives
  const trygg = (t, f = font) => [...String(t ?? "").replace(/[–—]/g, "-").replace(/[“”«»]/g, '"')]
    .map((c) => { try { f.encodeText(c); return c; } catch { return "?"; } }).join("");
  const bredde = (t, f, s) => f.widthOfTextAtSize(trygg(t, f), s);
  function bryt(tekst, f, s, maks) {
    const ut = [];
    for (const avsnitt of trygg(tekst, f).split("\n")) {
      let linje = "";
      for (const ord of avsnitt.split(/\s+/)) {
        const forsok = linje ? `${linje} ${ord}` : ord;
        if (f.widthOfTextAtSize(forsok, s) <= maks || !linje) linje = forsok;
        else { ut.push(linje); linje = ord; }
      }
      ut.push(linje);
    }
    return ut;
  }

  let side, y;
  const nySide = () => { side = pdf.addPage(A4); y = A4[1] - M; };
  const plass = (h) => { if (y - h < M + 24) { nySide(); return true; } return false; };
  const tekst = (t, { x = M, f = font, s = 10, c = F.tekst, maks = B, la = 1.35 } = {}) => {
    for (const l of bryt(t, f, s, maks)) {
      plass(s * la);
      side.drawText(l, { x, y: y - s, size: s, font: f, color: farge(c) });
      y -= s * la;
    }
  };
  const hoydeFor = (t, f, s, maks, la = 1.35) => bryt(t, f, s, maks).length * s * la;
  const strek = (luft = 8) => {
    side.drawLine({ start: { x: M, y: y - luft / 2 }, end: { x: A4[0] - M, y: y - luft / 2 }, thickness: 0.6, color: farge(F.linje) });
    y -= luft;
  };
  const overskrift = (t, under) => {
    plass(60);
    y -= 14;
    side.drawText(trygg(t.toUpperCase(), fet), { x: M, y: y - 11, size: 11, font: fet, color: farge(F.tekst) });
    y -= 17;
    if (under) tekst(under, { s: 9, c: F.dempet });
    strek(6);
  };
  const merke = (t, x, yy, c, { s = 8, padX = 5, h = 14 } = {}) => {
    const w = bredde(t, fet, s) + padX * 2;
    side.drawRectangle({ x, y: yy, width: w, height: h, color: farge(c) });
    side.drawText(trygg(t, fet), { x: x + padX, y: yy + (h - s) / 2 + 1.2, size: s, font: fet, color: farge(c === F.TG2 || c === F.TGIU ? F.tekst : F.hvit) });
    return w;
  };

  // ---- Toppen -------------------------------------------------------------
  nySide();
  const toppH = 104;
  side.drawRectangle({ x: 0, y: A4[1] - toppH, width: A4[0], height: toppH, color: farge(F.topp) });
  side.drawText("TILSTANDSRAPPORT", { x: M, y: A4[1] - 34, size: 9, font: fet, color: rgb(0.75, 0.77, 0.8) });
  side.drawText(trygg(r.bil.kjennemerke, fet), { x: M, y: A4[1] - 66, size: 28, font: fet, color: farge(F.hvit) });
  side.drawText(trygg(r.bil.navn), { x: M, y: A4[1] - 86, size: 12, font, color: rgb(0.85, 0.86, 0.88) });
  const laget = trygg(`Laget ${formaterDato(r.laget)} i Mekkoo`);
  side.drawText(laget, { x: A4[0] - M - bredde(laget, font, 9), y: A4[1] - 34, size: 9, font, color: rgb(0.75, 0.77, 0.8) });
  y = A4[1] - toppH - 18;

  // Nøkkeltall i to kolonner
  const b = r.bil;
  const fakta = [
    ["Kilometerstand", b.kilometerstand != null ? formaterKm(b.kilometerstand) : null],
    ["Første gang registrert", b.forstegangsregistrert && formaterDato(b.forstegangsregistrert)],
    ["Drivstoff og motor", [b.drivstoff, b.slagvolum, b.effekt].filter(Boolean).join(", ")],
    ["Girkasse og drift", [b.girkasse, b.drift].filter(Boolean).join(", ")],
    ["EU-kontroll sist godkjent", r.eu.sistGodkjent && formaterDato(r.eu.sistGodkjent)],
    ["Neste EU-kontroll", r.eu.frist && formaterDato(r.eu.frist)],
    ["Farge", b.farge],
    ["Sitteplasser", b.sitteplasser != null ? String(b.sitteplasser) : null],
    ["Understellsnummer (VIN)", b.understellsnummer],
    ["Bruktimportert fra", b.bruktimportFra],
  ].filter(([, v]) => v);
  const kolB = (B - 16) / 2;
  for (let i = 0; i < fakta.length; i += 2) {
    plass(30);
    fakta.slice(i, i + 2).forEach(([n, v], j) => {
      const x = M + j * (kolB + 16);
      side.drawText(trygg(n), { x, y: y - 8, size: 8, font, color: farge(F.dempet) });
      side.drawText(trygg(v, fet), { x, y: y - 21, size: 10.5, font: fet, color: farge(F.tekst) });
    });
    y -= 29;
  }
  y -= 4;

  // ---- Sammendrag --------------------------------------------------------
  if (r.sammendrag.length) {
    const linjeB = B - 40;
    const h = r.sammendrag.reduce((n, s) => n + hoydeFor(s.tekst, font, 10, linjeB) + 5, 0) + 34;
    plass(h);
    side.drawRectangle({ x: M, y: y - h, width: B, height: h, color: farge(F.flate) });
    let yy = y - 20;
    side.drawText("SAMMENDRAG", { x: M + 14, y: yy, size: 9, font: fet, color: farge(F.dempet) });
    yy -= 8;
    for (const s of r.sammendrag) {
      const l = bryt(s.tekst, font, 10, linjeB);
      side.drawCircle({ x: M + 20, y: yy - 6.5, size: 6, color: farge(F[s.type]) });
      side.drawText(s.type === "pluss" ? "+" : "!", { x: M + (s.type === "pluss" ? 17.2 : 18.6), y: yy - 9.6, size: 9, font: fet, color: farge(F.hvit) });
      for (const linje of l) {
        side.drawText(linje, { x: M + 32, y: yy - 10, size: 10, font, color: farge(F.tekst) });
        yy -= 13.5;
      }
      yy -= 5;
    }
    y -= h + 6;
  }

  // ---- Tilstand per område ----------------------------------------------
  overskrift("Tilstand per område", "Selgers vurdering. TG0 ingen avvik · TG1 normal slitasje · TG2 avvik, bør utbedres på sikt · TG3 store avvik · IU ikke vurdert.");
  const navnB = 138, tgB = 112, komX = M + navnB + tgB, komB = B - navnB - tgB;
  for (const o of r.omrader) {
    // Linjene først, så vi vet hvor høy raden blir
    const linjer = [
      ...(o.kommentar ? bryt(o.kommentar, font, 9, komB).map((l) => [l, F.tekst]) : []),
      ...(o.sisteArbeid ? bryt(`Sist dokumentert arbeid: ${formaterDato(o.sisteArbeid.dato)} (${o.sisteArbeid.tittel})`, font, 8.5, komB).map((l) => [l, F.dempet]) : []),
    ];
    const h = Math.max(22, linjer.length * 11.5 + 9);
    plass(h + 4);
    side.drawText(trygg(o.navn, fet), { x: M, y: y - 13, size: 10, font: fet, color: farge(F.tekst) });
    merke(o.tg === "TGIU" ? "IU" : o.tg, M + navnB, y - 16, F[o.tg]);
    side.drawText(trygg(o.tgNavn), { x: M + navnB + 32, y: y - 13, size: 8.5, font, color: farge(F.dempet) });
    linjer.forEach(([l, c], i) => side.drawText(l, { x: komX, y: y - 13 - i * 11.5, size: c === F.tekst ? 9 : 8.5, font, color: farge(c) }));
    y -= h;
    strek(4);
  }

  // ---- Egenerklæring ------------------------------------------------------
  overskrift("Selgers egenerklæring");
  for (const e of r.egenerklaering) {
    const svarB = 150;
    const h = Math.max(hoydeFor(e.sporsmal, font, 9.5, B - svarB - 10), hoydeFor(e.svar, fet, 9.5, svarB)) + 4;
    plass(h + (e.utdyp ? 20 : 0));
    const start = y;
    tekst(e.sporsmal, { s: 9.5, maks: B - svarB - 10 });
    const etter = y;
    y = start;
    tekst(e.svar, { x: M + B - svarB, f: fet, s: 9.5, maks: svarB, c: e.besvart ? F.tekst : F.dempet });
    y = Math.min(y, etter);
    if (e.utdyp) tekst(e.utdyp, { x: M + 12, s: 9, c: F.dempet, maks: B - 12 });
    y -= 3;
  }

  // ---- Vedlikehold og dokumentasjon -----------------------------------
  const h = r.historikk;
  overskrift("Vedlikehold og dokumentasjon", h.antall
    ? `Registrert i Mekkoo fra ${formaterDato(h.forste)} til ${formaterDato(h.siste)}.`
    : "Ingen vedlikehold er registrert.");
  if (h.antall) {
    const tall = [
      ["Hendelser", String(h.antall)],
      ["Med kvittering", `${h.medVedlegg} (${h.antallVedlegg} dok.)`],
      h.sisteService && ["Siste service", `${formaterDato(h.sisteService.dato)}${h.sisteService.km != null ? `\n${formaterKm(h.sisteService.km)}` : ""}`],
      h.totalKostnad != null && ["Dokumentert brukt", kr(h.totalKostnad)],
    ].filter(Boolean);
    plass(40);
    const w = B / tall.length;
    tall.forEach(([n, v], i) => {
      side.drawText(trygg(n), { x: M + i * w, y: y - 8, size: 8, font, color: farge(F.dempet) });
      v.split("\n").forEach((l, j) => side.drawText(trygg(l, fet), { x: M + i * w, y: y - 22 - j * 12, size: j ? 9 : 11, font: j ? font : fet, color: farge(F.tekst) }));
    });
    y -= 44;
  }
  if (r.etterBoka.punkter.length) {
    tekst(`Service etter boka: ${r.etterBoka.iTide} av ${r.etterBoka.maalt} målbare bytter er gjort innen anbefalt intervall (med litt slingringsmonn).`, { f: fet, s: 9.5 });
    y -= 2;
    for (const p of r.etterBoka.punkter) {
      plass(15);
      side.drawText(trygg(p.navn), { x: M + 8, y: y - 9.5, size: 9, font, color: farge(F.tekst) });
      const info = trygg(`${p.antall} ${p.antall === 1 ? "gang" : "ganger"} · sist ${formaterDato(p.siste)}${p.intervall ? ` · intervall ${p.intervall}` : ""}`);
      side.drawText(info, { x: M + 190, y: y - 9.5, size: 8.5, font, color: farge(F.dempet) });
      const andel = p.maalt ? p.iTide / p.maalt : null;
      const t = p.maalt ? `${p.iTide} av ${p.maalt} i tide` : "Ikke målbart ennå";
      const c = andel == null ? F.TGIU : andel >= 0.8 ? F.TG0 : andel >= 0.5 ? F.TG2 : F.TG3;
      merke(t, A4[0] - M - bredde(t, fet, 7.5) - 10, y - 11, c, { s: 7.5, h: 12 });
      y -= 14.5;
    }
  }

  // ---- Større arbeid --------------------------------------------------------
  overskrift("Større arbeid siste 5 år", r.utbedringer.length ? "Reparasjoner og utskiftninger utover vanlig service." : "Ingen større arbeid er registrert de siste fem årene.");
  for (const u of r.utbedringer) {
    const hode = [formaterDato(u.dato), u.km != null && formaterKm(u.km), u.kostnad != null && kr(u.kostnad), u.vedlegg && `${u.vedlegg} vedlegg`].filter(Boolean).join("  ·  ");
    plass(34);
    tekst(u.deler.length ? u.deler.join(", ") : u.tittel, { f: fet, s: 9.5 });
    tekst(hode + (u.utfortAv ? `  ·  ${u.utfortAv}` : ""), { s: 8.5, c: F.dempet });
    if (u.notat) tekst(u.notat.length > 220 ? `${u.notat.slice(0, 218)}…` : u.notat, { s: 9 });
    y -= 4;
  }

  // ---- Bør gjøres snart -------------------------------------------------
  if (r.kommende.length) {
    overskrift("Bør gjøres snart", "Ut fra registrert historikk og anbefalte intervaller.");
    for (const k of r.kommende) {
      plass(15);
      merke(k.status === "forfalt" ? "Forfalt" : "Snart", M, y - 12, k.status === "forfalt" ? F.TG3 : F.TG2, { s: 7.5, h: 12 });
      side.drawText(trygg(k.navn, fet), { x: M + 52, y: y - 9.5, size: 9.5, font: fet, color: farge(F.tekst) });
      side.drawText(trygg(k.tekst ?? ""), { x: M + 230, y: y - 9.5, size: 9, font, color: farge(F.dempet) });
      y -= 15;
    }
  }

  // ---- Dekk ---------------------------------------------------------------
  if (r.dekk.length) {
    overskrift("Dekk som følger med");
    for (const d of r.dekk) {
      plass(30);
      tekst(`${d.navn}${d.paBilen ? " (står på bilen)" : ""}`, { f: fet, s: 9.5 });
      tekst([
        d.monsterdybde != null ? `Mønsterdybde ${String(d.monsterdybde).replace(".", ",")} mm${d.maalt ? ` (målt ${formaterDato(d.maalt)})` : ""}` : "Mønsterdybde ikke målt",
        d.produksjonsaar && `produsert ${d.produksjonsaar}`,
        d.tekst,
      ].filter(Boolean).join(" · "), { s: 9, c: F.dempet });
      y -= 3;
    }
  }

  // ---- Om rapporten ---------------------------------------------------
  overskrift("Om rapporten");
  tekst("Rapporten er selgers egenerklæring, supplert med vedlikehold registrert i Mekkoo og opplysninger fra Statens vegvesen. "
    + "Tilstandsgradene er selgers egen vurdering, ikke en uavhengig test. Kjøper anbefales å prøvekjøre bilen, sjekke vognkortet, "
    + "undersøke heftelser i Løsøreregisteret og gjerne bestille en uavhengig test (for eksempel NAF-test ved eierskifte).", { s: 9, c: F.dempet });
  if (vedlegg) { y -= 4; tekst("Hele servicehistorikken med kvitteringer er lagt ved bakerst.", { s: 9, c: F.dempet }); }

  const rapportSider = pdf.getPageCount();

  // ---- Vedlegg: servicehistorikken ------------------------------------
  if (vedlegg) {
    const kilde = await PDFDocument.load(vedlegg, { ignoreEncryption: true });
    for (const s of await pdf.copyPages(kilde, kilde.getPageIndices())) pdf.addPage(s);
  }

  // Bunntekst på rapportsidene (vedleggene har sin egen)
  pdf.getPages().slice(0, rapportSider).forEach((s, i) => {
    const t = trygg(`${r.bil.kjennemerke} · Tilstandsrapport ${formaterDato(r.laget)} · Side ${i + 1} av ${rapportSider}`);
    s.drawText(t, { x: A4[0] - M - bredde(t, font, 8), y: 20, size: 8, font, color: farge(F.dempet) });
  });

  return pdf.save();
}

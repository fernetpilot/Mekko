// Lager servicehefte som PDF: historikk først, deretter alle vedlegg (bilder og PDF-er)
// i samme rekkefølge som hendelsene. Formatet er foreløpig – skal finpusses senere.
//
// Ren logikk uten DOM: pdf-lib og en funksjon som henter filer sendes inn,
// slik at modulen kan testes i Node og gjenbrukes i en app.

import { formaterDato, formaterKm } from "./bilstatus.js";
import { hendelseTittel, kategorierFor } from "./kategorier.js";

const A4 = [595.28, 841.89];
const MARG = 50;
const FARGE = { tekst: [0.1, 0.1, 0.12], dempet: [0.42, 0.43, 0.46], linje: [0.85, 0.86, 0.88] };

/**
 * @param {object} PDFLib  pdf-lib-modulen ({ PDFDocument, StandardFonts, rgb })
 * @param {object} data
 * @param {object} data.bil         { kjennemerke, merke, modell, kallenavn, forstegangsregistrert, understellsnummer?, kilometerstand? }
 * @param {object[]} data.hendelser vedlikehold med dokumenter: [{ dato, komponent, kilometerstand, kostnad, utfort_av, notat, dokumenter: [{ filsti, filnavn, mimetype }] }]
 * @param {(filsti: string) => Promise<Uint8Array>} data.hentFil
 * @param {Date} [data.laget]
 * @returns {Promise<{ bytes: Uint8Array, feil: string[] }>}
 */
export async function lagServiceheftePdf(PDFLib, { bil, hendelser, hentFil, laget = new Date() }) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const farge = (f) => rgb(...f);
  const feil = [];

  pdf.setTitle(`Servicehefte ${bil.kjennemerke}`);
  pdf.setProducer("Mekkoo");
  pdf.setCreationDate(laget);

  // Standardfontene støtter ikke alle tegn (f.eks. emoji): bytt dem ut med «?»
  const trygg = (tekst, f = font) =>
    [...String(tekst ?? "")].map((t) => { try { f.encodeText(t); return t; } catch { return "?"; } }).join("");

  // Bryt tekst til linjer som får plass i bredden
  function linjer(tekst, f, storrelse, bredde) {
    const ut = [];
    for (const avsnitt of trygg(tekst, f).split("\n")) {
      let linje = "";
      for (const ord of avsnitt.split(/\s+/)) {
        const forsok = linje ? `${linje} ${ord}` : ord;
        if (f.widthOfTextAtSize(forsok, storrelse) <= bredde || !linje) linje = forsok;
        else { ut.push(linje); linje = ord; }
      }
      ut.push(linje);
    }
    return ut;
  }

  // ---- Historikk-sidene ----------------------------------------------------
  let side = pdf.addPage(A4);
  let y = A4[1] - MARG;
  const bredde = A4[0] - MARG * 2;

  function nySideVedBehov(hoyde) {
    if (y - hoyde < MARG + 20) {
      side = pdf.addPage(A4);
      y = A4[1] - MARG;
    }
  }
  function skriv(tekst, { f = font, storrelse = 10, f2 = FARGE.tekst, x = MARG, maksBredde = bredde, linjeAvstand = 1.35 } = {}) {
    for (const l of linjer(tekst, f, storrelse, maksBredde)) {
      nySideVedBehov(storrelse * linjeAvstand);
      side.drawText(l, { x, y: y - storrelse, size: storrelse, font: f, color: farge(f2) });
      y -= storrelse * linjeAvstand;
    }
  }
  function strek() {
    nySideVedBehov(12);
    side.drawLine({ start: { x: MARG, y: y - 4 }, end: { x: A4[0] - MARG, y: y - 4 }, thickness: 0.6, color: farge(FARGE.linje) });
    y -= 12;
  }

  const bilNavn = bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ");
  skriv("SERVICEHEFTE", { f: fet, storrelse: 10, f2: FARGE.dempet });
  y -= 4;
  skriv(`${bil.kjennemerke}${bilNavn ? ` – ${bilNavn}` : ""}`, { f: fet, storrelse: 22 });
  y -= 6;
  const fakta = [
    bil.understellsnummer && `Understellsnummer (VIN): ${bil.understellsnummer}`,
    bil.forstegangsregistrert && `Første gang registrert: ${formaterDato(bil.forstegangsregistrert)}`,
    bil.kilometerstand != null && `Siste kjente kilometerstand: ${formaterKm(bil.kilometerstand)}`,
    `Utskrevet: ${formaterDato(laget.toISOString().slice(0, 10))} fra Mekkoo`,
  ].filter(Boolean);
  for (const linje of fakta) skriv(linje, { storrelse: 10, f2: FARGE.dempet });
  y -= 10;
  strek();

  if (!hendelser.length) skriv("Ingen vedlikehold er registrert.", { f2: FARGE.dempet });

  // Vedlegg nummereres fortløpende og listes under hver hendelse
  let vedleggNr = 0;
  const vedlegg = [];
  for (const h of hendelser) {
    nySideVedBehov(60);
    const type = hendelseTittel(h);
    skriv(`${formaterDato(h.dato)}  ·  ${type}`, { f: fet, storrelse: 12 });
    // Delene per kategori, som i historikken på nettsiden
    for (const k of kategorierFor(h)) {
      if (k.delNavn.length) skriv(`${k.navn}: ${k.delNavn.join(", ")}`, { storrelse: 10 });
    }
    const detaljer = [
      h.kilometerstand != null && formaterKm(h.kilometerstand),
      h.kostnad != null && `${Number(h.kostnad).toLocaleString("nb-NO")} kr`,
      h.utfort_av && `Utført av: ${h.utfort_av}`,
    ].filter(Boolean).join("   ·   ");
    if (detaljer) skriv(detaljer, { storrelse: 10, f2: FARGE.dempet });
    if (h.notat) skriv(h.notat, { storrelse: 10 });
    for (const d of h.dokumenter ?? []) {
      vedleggNr++;
      vedlegg.push({ nr: vedleggNr, hendelse: h, type, dokument: d });
      skriv(`Vedlegg ${vedleggNr}: ${d.filnavn}`, { storrelse: 9, f2: FARGE.dempet, x: MARG + 10, maksBredde: bredde - 10 });
    }
    y -= 6;
    strek();
  }

  // ---- Vedleggene ------------------------------------------------------------
  const etikett = (v) => trygg(`Vedlegg ${v.nr} – ${formaterDato(v.hendelse.dato)} – ${v.type} – ${v.dokument.filnavn}`);

  for (const v of vedlegg) {
    let bytes;
    try {
      bytes = await hentFil(v.dokument.filsti);
    } catch {
      feil.push(`Kunne ikke hente ${v.dokument.filnavn}`);
      continue;
    }
    try {
      if (v.dokument.mimetype === "application/pdf") {
        const kilde = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const sider = await pdf.copyPages(kilde, kilde.getPageIndices());
        sider.forEach((s, i) => {
          pdf.addPage(s);
          // Liten etikett øverst så vedlegget kan kobles til historikken
          const { height } = s.getSize();
          s.drawText(i === 0 ? etikett(v) : `Vedlegg ${v.nr} (forts.)`, { x: 12, y: height - 12, size: 7, font, color: farge(FARGE.dempet) });
        });
      } else {
        const bilde = v.dokument.mimetype === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const s = pdf.addPage(A4);
        s.drawText(etikett(v), { x: MARG, y: A4[1] - MARG + 10, size: 9, font, color: farge(FARGE.dempet) });
        const maksB = A4[0] - MARG * 2;
        const maksH = A4[1] - MARG * 2 - 20;
        const skala = Math.min(maksB / bilde.width, maksH / bilde.height, 1);
        const b = bilde.width * skala;
        const hoyde = bilde.height * skala;
        s.drawImage(bilde, { x: (A4[0] - b) / 2, y: A4[1] - MARG - 20 - hoyde, width: b, height: hoyde });
      }
    } catch {
      feil.push(`Kunne ikke legge ved ${v.dokument.filnavn}`);
    }
  }

  // ---- Sidetall -------------------------------------------------------------
  const sider = pdf.getPages();
  sider.forEach((s, i) => {
    const tekst = `${bil.kjennemerke} · Side ${i + 1} av ${sider.length}`;
    const w = font.widthOfTextAtSize(tekst, 8);
    s.drawText(tekst, { x: s.getSize().width - w - 20, y: 14, size: 8, font, color: farge(FARGE.dempet) });
  });

  return { bytes: await pdf.save(), feil };
}

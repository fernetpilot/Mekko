// Siden «Tilstandsrapport»: velg bil, fyll inn egenvurdering og egenerklæring, last ned PDF.
// Innholdet regnes ut i tilstandsrapport.js (ren, testet), PDF-en lages i tilstandsrapport-pdf.js.
// Egenvurderingen lagres automatisk i tabellen `tilstandsrapporter` (se supabase/08-tilstandsrapport.sql).
import { supabase } from "./supabase.js";
import { leggPaDekksett } from "./dekk-data.js";
import { formaterDato, formaterKm } from "./bilstatus.js";
import { BUCKET } from "./dokumenter.js";
import {
  OMRADER, SPORSMAL, SVAR_NAVN, TILSTANDSGRADER, kjoretoyFakta, lagTilstandsrapport, lesEgenvurdering,
} from "./tilstandsrapport.js";
import { lagTilstandsrapportPdf } from "./tilstandsrapport-pdf.js";
import { lagServiceheftePdf } from "./servicehefte-pdf.js";

const $ = (id) => document.getElementById(id);
const lag = (tag, klasse, tekst) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
};
const kr = (n) => `${Math.round(n).toLocaleString("nb-NO")} kr`;

function melding(tekst, type = "") {
  $("melding").textContent = tekst;
  $("melding").className = `melding ${type}`;
}

let biler = [];
let bil = null;
let egen = lesEgenvurdering(null);
const fakta = new Map(); // kjennemerke → kjoretoyFakta (hentes én gang per bil)
let kanLagre = true;

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  const { data, error } = await supabase
    .from("biler")
    .select("*, vedlikehold(*, dokumenter(*))")
    .order("opprettet")
    .order("dato", { referencedTable: "vedlikehold", ascending: false });
  $("laster").hidden = true;
  if (error) {
    $("laster").hidden = false;
    $("laster").textContent = "Kunne ikke hente bilene dine. Prøv igjen senere.";
    return;
  }
  biler = data ?? [];
  if (!biler.length) {
    $("ingen-biler").hidden = false;
    return;
  }
  await leggPaDekksett(supabase, biler);

  const valg = $("bil-valg");
  for (const b of biler) {
    valg.append(new Option([b.kjennemerke, b.kallenavn || [b.merke, b.modell].filter(Boolean).join(" ")].filter(Boolean).join(" – "), b.id));
  }
  const onsket = new URLSearchParams(location.search).get("bil");
  if (onsket && biler.some((b) => b.id === onsket)) valg.value = onsket;
  valg.addEventListener("change", () => velgBil(valg.value));

  tegnForklaring();
  $("innhold").hidden = false;
  $("bunn").hidden = false;
  await velgBil(valg.value);
}

async function velgBil(id) {
  bil = biler.find((b) => b.id === id);
  history.replaceState(null, "", `?bil=${encodeURIComponent(id)}`);
  melding("");

  // Lagret egenvurdering (tåler at tabellen ikke finnes ennå)
  const { data, error } = await supabase.from("tilstandsrapporter").select("data").eq("bil_id", id).maybeSingle();
  kanLagre = !error;
  $("tabell-mangler").hidden = kanLagre;
  egen = lesEgenvurdering(data?.data);
  $("vis-kostnader").checked = egen.visKostnader;

  tegnSkjema();
  tegnRapport();

  // Ferske data fra Vegvesenet (EU-kontroll, VIN, motor …). Ikke kritisk om det feiler.
  if (!fakta.has(bil.kjennemerke)) {
    try {
      const res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(bil.kjennemerke)}`);
      fakta.set(bil.kjennemerke, res.ok ? kjoretoyFakta(await res.json()) : {});
    } catch {
      fakta.set(bil.kjennemerke, {});
    }
    if (bil?.id === id) tegnRapport();
  }
}

const rapport = () => lagTilstandsrapport({ bil, kjoretoy: fakta.get(bil.kjennemerke) ?? {}, egen });

// ---------------------------------------------------------------------------
// Forhåndsvisning
// ---------------------------------------------------------------------------
function tegnRapport() {
  const r = rapport();
  $("sammendrag").replaceChildren(...r.sammendrag.map((s) => {
    const li = lag("li", s.type);
    li.append(lag("span", "merke-ikon", s.type === "pluss" ? "✓" : "!"), lag("span", null, s.tekst));
    return li;
  }));

  const d = $("detaljer");
  d.replaceChildren();
  const blokk = (tittel, rader) => {
    if (!rader.length) return;
    const s = lag("div", "datablokk");
    s.append(lag("h3", null, tittel));
    const dl = lag("dl");
    for (const [n, v] of rader) dl.append(lag("dt", null, n), lag("dd", null, v));
    s.append(dl);
    d.append(s);
  };
  const b = r.bil;
  blokk("Bilen", [
    ["Kjennemerke", b.kjennemerke], ["Merke og modell", b.navn],
    b.kilometerstand != null && ["Kilometerstand", formaterKm(b.kilometerstand)],
    b.forstegangsregistrert && ["Første gang registrert", formaterDato(b.forstegangsregistrert)],
    b.drivstoff && ["Drivstoff", b.drivstoff], b.effekt && ["Effekt", b.effekt],
    b.girkasse && ["Girkasse", b.girkasse], b.drift && ["Drift", b.drift], b.farge && ["Farge", b.farge],
  ].filter(Boolean));
  blokk("EU-kontroll", [
    r.eu.sistGodkjent && ["Sist godkjent", formaterDato(r.eu.sistGodkjent)],
    ["Neste frist", r.eu.frist ? formaterDato(r.eu.frist) : "Ukjent"],
  ].filter(Boolean));
  blokk("Vedlikehold", [
    ["Registrerte hendelser", String(r.historikk.antall)],
    ["Med kvittering/dokument", String(r.historikk.medVedlegg)],
    r.historikk.sisteService && ["Siste service", `${formaterDato(r.historikk.sisteService.dato)}${r.historikk.sisteService.km != null ? `, ${formaterKm(r.historikk.sisteService.km)}` : ""}`],
    r.historikk.totalKostnad != null && ["Dokumentert brukt", kr(r.historikk.totalKostnad)],
    r.etterBoka.maalt && ["Service i tide", `${r.etterBoka.iTide} av ${r.etterBoka.maalt} bytter`],
  ].filter(Boolean));
  blokk(`Større arbeid siste 5 år (${r.utbedringer.length})`, r.utbedringer.map((u) => [formaterDato(u.dato), [u.deler.join(", ") || u.tittel, u.kostnad != null && kr(u.kostnad)].filter(Boolean).join(" · ")]));
  blokk("Bør gjøres snart", r.kommende.map((k) => [k.navn, k.tekst]));
  blokk("Dekk", r.dekk.map((x) => [x.navn, [x.monsterdybde != null && `${String(x.monsterdybde).replace(".", ",")} mm`, x.produksjonsaar && `fra ${x.produksjonsaar}`].filter(Boolean).join(", ") || "Ikke målt"]));

  // «Fra historikken» på hvert område
  for (const o of r.omrader) {
    const el = document.querySelector(`[data-omrade="${o.id}"] .fra-historikk`);
    if (el) el.textContent = o.sisteArbeid
      ? `Fra historikken: ${o.antallArbeid} ${o.antallArbeid === 1 ? "registrering" : "registreringer"}, sist ${formaterDato(o.sisteArbeid.dato)} (${o.sisteArbeid.tittel})`
      : o.id === "dekk" && r.dekk.length ? `Fra historikken: ${r.dekk.length} dekksett registrert` : "Fra historikken: ingen registrert arbeid";
  }
}

// ---------------------------------------------------------------------------
// Skjemaet
// ---------------------------------------------------------------------------
function tegnForklaring() {
  $("tg-forklaring").replaceChildren(...TILSTANDSGRADER.flatMap((t) => {
    const dt = lag("dt");
    dt.append(lag("span", `tg-merke ${t.id.toLowerCase()}`, t.id === "TGIU" ? "IU" : t.id), ` ${t.navn}`);
    return [dt, lag("dd", null, t.tekst)];
  }));
}

function tegnSkjema() {
  $("omrader").replaceChildren(...OMRADER.map((o) => {
    const v = egen.omrader[o.id];
    const li = lag("li", "kort omrade");
    li.dataset.omrade = o.id;
    li.dataset.tg = v.tg;
    li.append(lag("h3", null, o.navn), lag("p", "liten", `Se etter: ${o.sjekk}`), lag("p", "liten fra-historikk"));

    const gruppe = lag("fieldset", "tg-velger");
    gruppe.append(lag("legend", "skjult-tekst", `Tilstandsgrad for ${o.navn}`));
    for (const t of TILSTANDSGRADER) {
      const l = lag("label", `tg-valg ${t.id.toLowerCase()}`);
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `tg-${o.id}`;
      input.value = t.id;
      input.checked = v.tg === t.id;
      input.addEventListener("change", () => {
        egen.omrader[o.id].tg = t.id;
        li.dataset.tg = t.id;
        endret();
      });
      l.title = t.tekst;
      l.append(input, lag("span", "tg-kode", t.id === "TGIU" ? "IU" : t.id.slice(2)), lag("span", "tg-navn", t.navn));
      gruppe.append(l);
    }
    const kommentar = document.createElement("textarea");
    kommentar.rows = 2;
    kommentar.maxLength = 500;
    kommentar.placeholder = "Kommentar (valgfritt), f.eks. «Litt rust på bakre terskel»";
    kommentar.value = v.kommentar;
    kommentar.setAttribute("aria-label", `Kommentar til ${o.navn}`);
    kommentar.addEventListener("input", () => { egen.omrader[o.id].kommentar = kommentar.value; endret(); });
    li.append(gruppe, kommentar);
    return li;
  }));

  $("sporsmal").replaceChildren(...SPORSMAL.map((s) => {
    const svar = egen.svar[s.id] ?? { svar: "", utdyp: "" };
    const sett = (felt, verdi) => { egen.svar[s.id] = { ...(egen.svar[s.id] ?? { svar: "", utdyp: "" }), [felt]: verdi }; endret(); };
    const boks = lag("div", "sporsmal");
    if (s.type === "janei") {
      const fs = lag("fieldset", "janei");
      fs.append(lag("legend", null, s.tekst));
      const rad = lag("div", "janei-rad");
      let utdyp = null;
      for (const [verdi, navn] of Object.entries(SVAR_NAVN)) {
        const l = lag("label", "valg-brikke");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = `sp-${s.id}`;
        input.value = verdi;
        input.checked = svar.svar === verdi;
        input.addEventListener("change", () => { sett("svar", verdi); if (utdyp) utdyp.hidden = verdi !== "ja"; });
        l.append(input, lag("span", null, navn));
        rad.append(l);
      }
      fs.append(rad);
      if (s.utdyp) {
        utdyp = document.createElement("textarea");
        utdyp.rows = 2;
        utdyp.maxLength = 1000;
        utdyp.placeholder = s.utdyp;
        utdyp.value = svar.utdyp ?? "";
        utdyp.hidden = svar.svar !== "ja";
        utdyp.setAttribute("aria-label", s.utdyp);
        utdyp.addEventListener("input", () => sett("utdyp", utdyp.value));
        fs.append(utdyp);
      }
      boks.append(fs);
    } else {
      const l = lag("label", null, s.tekst);
      const felt = s.type === "tall" ? document.createElement("input") : document.createElement("textarea");
      if (s.type === "tall") { felt.type = "number"; felt.min = "0"; felt.max = "10"; felt.inputMode = "numeric"; } else { felt.rows = 2; felt.maxLength = 1000; }
      felt.value = svar.svar ?? "";
      felt.addEventListener("input", () => sett("svar", felt.value));
      l.append(felt);
      boks.append(l);
    }
    return boks;
  }));
}

$("vis-kostnader").addEventListener("change", (e) => { egen.visKostnader = e.target.checked; endret(); });

// Lagrer automatisk kort tid etter siste endring
let tidtaker = null;
function endret() {
  tegnRapport();
  if (!kanLagre) return;
  clearTimeout(tidtaker);
  melding("Endringer lagres …");
  tidtaker = setTimeout(lagre, 800);
}
async function lagre() {
  const { error } = await supabase.from("tilstandsrapporter")
    .upsert({ bil_id: bil.id, data: egen, oppdatert: new Date().toISOString() }, { onConflict: "bil_id" });
  melding(error ? "Kunne ikke lagre vurderingen. Prøv igjen." : "Lagret", error ? "feil" : "ok");
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
$("last-ned").addEventListener("click", async (e) => {
  const knapp = e.currentTarget;
  knapp.disabled = true;
  melding("Lager PDF …");
  try {
    const PDFLib = await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");
    let vedlegg = null;
    let feil = [];
    if ($("legg-ved").checked) {
      const hendelser = bil.vedlikehold ?? [];
      const totalt = hendelser.reduce((n, h) => n + (h.dokumenter?.length ?? 0), 0);
      let hentet = 0;
      const hefte = await lagServiceheftePdf(PDFLib, {
        bil: { ...bil, understellsnummer: fakta.get(bil.kjennemerke)?.understellsnummer ?? null },
        hendelser: egen.visKostnader ? hendelser : hendelser.map((h) => ({ ...h, kostnad: null })),
        hentFil: async (filsti) => {
          melding(`Henter vedlegg ${++hentet} av ${totalt} …`);
          const { data, error } = await supabase.storage.from(BUCKET).download(filsti);
          if (error) throw error;
          return new Uint8Array(await data.arrayBuffer());
        },
      });
      vedlegg = hefte.bytes;
      feil = hefte.feil;
    }
    const bytes = await lagTilstandsrapportPdf(PDFLib, { rapport: rapport(), vedlegg });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tilstandsrapport-${bil.kjennemerke}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    melding(feil.length ? `PDF-en er laget, men: ${feil.join(", ")}.` : "PDF-en er lastet ned.", feil.length ? "feil" : "ok");
  } catch (err) {
    console.error(err);
    melding("Kunne ikke lage PDF. Prøv igjen.", "feil");
  } finally {
    knapp.disabled = false;
  }
});

start();

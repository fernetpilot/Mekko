// Servicehefte for én bil: historikk med dokumentasjon, og nedlasting som PDF.
import { supabase } from "./supabase.js";
import { KOMPONENT_NAVN, formaterDato, formaterKm } from "./bilstatus.js";
import { BUCKET, signerteLenker } from "./dokumenter.js";
import { lagServiceheftePdf } from "./servicehefte-pdf.js";

const $ = (id) => document.getElementById(id);
const bilId = new URLSearchParams(location.search).get("bil");

function melding(tekst, type = "") {
  $("melding").textContent = tekst;
  $("melding").className = `melding ${type}`;
}

let bil = null;
let hendelser = [];

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  if (!bilId) {
    location.replace("/min-side");
    return;
  }

  const { data, error } = await supabase
    .from("biler")
    .select("*, vedlikehold(*, dokumenter(*))")
    .eq("id", bilId)
    .order("dato", { referencedTable: "vedlikehold", ascending: false })
    .maybeSingle();

  if (error || !data) {
    $("tittel").textContent = "Fant ikke bilen";
    $("undertittel").textContent = "Gå tilbake til Mine biler og prøv igjen.";
    return;
  }
  bil = data;
  hendelser = bil.vedlikehold ?? [];

  const navn = bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ");
  document.title = `Mekkoo – servicehefte ${bil.kjennemerke}`;
  $("tittel").textContent = bil.kjennemerke;
  $("undertittel").textContent = [navn, bil.kilometerstand != null && formaterKm(bil.kilometerstand)].filter(Boolean).join(" · ");
  $("registrer").href = `/registrer-vedlikehold?bil=${encodeURIComponent(bil.id)}`;
  $("handlinger").hidden = false;

  await tegnTidslinje();
}

async function tegnTidslinje() {
  const ol = $("tidslinje");
  if (!hendelser.length) {
    const li = document.createElement("li");
    li.className = "tom";
    li.textContent = "Ingen vedlikehold er registrert ennå.";
    ol.replaceChildren(li);
    return;
  }

  // Midlertidige lenker til alle vedlegg (filene er private)
  let lenker = {};
  try {
    lenker = await signerteLenker(supabase, hendelser.flatMap((h) => (h.dokumenter ?? []).map((d) => d.filsti)));
  } catch {
    melding("Kunne ikke hente vedleggene akkurat nå.", "feil");
  }

  ol.replaceChildren(...hendelser.map((h) => {
    const li = document.createElement("li");
    li.className = "kort hendelse";

    const tittel = document.createElement("h2");
    tittel.textContent = KOMPONENT_NAVN[h.komponent] ?? h.komponent;
    const dato = document.createElement("p");
    dato.className = "overline";
    dato.textContent = formaterDato(h.dato);

    const detaljer = document.createElement("p");
    detaljer.className = "detaljer";
    detaljer.textContent = [
      h.kilometerstand != null && formaterKm(h.kilometerstand),
      h.kostnad != null && `${Number(h.kostnad).toLocaleString("nb-NO")} kr`,
      h.utfort_av && `Utført av ${h.utfort_av}`,
    ].filter(Boolean).join(" · ");

    li.append(dato, tittel, detaljer);
    if (h.notat) {
      const notat = document.createElement("p");
      notat.className = "notat";
      notat.textContent = h.notat;
      li.append(notat);
    }

    const dok = h.dokumenter ?? [];
    if (dok.length) {
      const liste = document.createElement("div");
      liste.className = "vedlegg";
      for (const d of dok) {
        const a = document.createElement("a");
        a.href = lenker[d.filsti] ?? "#";
        a.target = "_blank";
        a.rel = "noopener";
        a.className = "vedlegg-kort";
        if (d.mimetype.startsWith("image/") && lenker[d.filsti]) {
          const img = document.createElement("img");
          img.src = lenker[d.filsti];
          img.alt = d.filnavn;
          img.loading = "lazy";
          a.append(img);
        } else {
          const ikon = document.createElement("span");
          ikon.className = "pdf-ikon";
          ikon.textContent = "PDF";
          a.append(ikon);
        }
        const navn = document.createElement("span");
        navn.className = "vedlegg-navn";
        navn.textContent = d.filnavn;
        a.append(navn);
        liste.append(a);
      }
      li.append(liste);
    }
    return li;
  }));
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

    // Understellsnummer fra Vegvesenet (lagres ikke hos oss) – hoppes over hvis det feiler
    let understellsnummer = null;
    try {
      const res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(bil.kjennemerke)}`);
      if (res.ok) understellsnummer = (await res.json())?.kjoretoydataListe?.[0]?.kjoretoyId?.understellsnummer ?? null;
    } catch { /* ikke kritisk */ }

    let hentet = 0;
    const totalt = hendelser.reduce((n, h) => n + (h.dokumenter?.length ?? 0), 0);
    const { bytes, feil } = await lagServiceheftePdf(PDFLib, {
      bil: { ...bil, understellsnummer },
      hendelser,
      hentFil: async (filsti) => {
        melding(`Henter vedlegg ${++hentet} av ${totalt} …`);
        const { data, error } = await supabase.storage.from(BUCKET).download(filsti);
        if (error) throw error;
        return new Uint8Array(await data.arrayBuffer());
      },
    });

    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `servicehefte-${bil.kjennemerke}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);

    melding(feil.length ? `PDF-en er laget, men: ${feil.join(", ")}.` : "PDF-en er lastet ned.", feil.length ? "feil" : "ok");
  } catch {
    melding("Kunne ikke lage PDF. Prøv igjen.", "feil");
  } finally {
    knapp.disabled = false;
  }
});

start();

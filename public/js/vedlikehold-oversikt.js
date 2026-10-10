// «Vedlikehold»: alt som er gjort med bilen, gruppert per år (nyeste først).
// Gruppering og summer ligger i dashboard.js (ren og testet). Her tegnes bare siden.
import { formaterDato, formaterKm } from "./bilstatus.js";
import { signerteLenker } from "./dokumenter.js";
import { vedlikeholdOversikt, hendelseTittel, formaterKr } from "./dashboard.js";
import { $, el, lastBil } from "./dashboard-side.js";

function flis({ etikett, verdi, under }) {
  const d = el("article", "flis noytral");
  d.append(el("p", "flis-etikett", etikett), el("p", "flis-verdi", verdi));
  if (under) d.append(el("p", "flis-under", under));
  return d;
}

function hendelse(h, lenker) {
  const li = el("li", "jobb");
  const hode = el("div", "jobb-hode");
  hode.append(el("time", "jobb-dato", formaterDato(h.dato)));
  if (h.kostnad != null) hode.append(el("span", "jobb-kost", formaterKr(h.kostnad)));
  li.append(hode, el("h3", null, hendelseTittel(h)));

  const info = [
    h.kilometerstand != null && formaterKm(h.kilometerstand),
    h.utfort_av && h.utfort_av,
  ].filter(Boolean).join(" · ");
  if (info) li.append(el("p", "jobb-info", info));
  if (h.notat) li.append(el("p", "jobb-notat", h.notat));

  const dok = h.dokumenter ?? [];
  if (dok.length) {
    const liste = el("div", "jobb-vedlegg");
    for (const d of dok) {
      const url = lenker[d.filsti];
      const a = el("a", "vedlegg-chip");
      if (url) {
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
      } else {
        a.setAttribute("aria-disabled", "true");
      }
      a.append(el("span", "chip-ikon", d.mimetype === "application/pdf" ? "PDF" : "Bilde"), el("span", "chip-navn", d.filnavn));
      liste.append(a);
    }
    li.append(liste);
  }
  return li;
}

async function start() {
  const res = await lastBil();
  if (!res?.bil) return;
  const { bil, supabase } = res;
  document.title = `Mekkoo – vedlikehold ${bil.kjennemerke}`;

  const o = vedlikeholdOversikt(bil.vedlikehold ?? []);
  $("fliser").replaceChildren(
    flis({ etikett: "Jobber registrert", verdi: String(o.antall), under: o.aar.length ? `Fra ${o.aar.at(-1).aar} til ${o.aar[0].aar}` : "Ingen ennå" }),
    flis({
      etikett: "Totalt brukt",
      verdi: formaterKr(o.totalKostnad),
      under: !o.antall ? "Ingen beløp ennå" : o.medKostnad < o.antall ? `${o.medKostnad} av ${o.antall} jobber har beløp` : "Alle registrerte jobber",
    }),
    flis({
      etikett: "Siste jobb",
      verdi: o.siste ? formaterDato(o.siste.dato) : "–",
      under: o.siste ? hendelseTittel(o.siste) : "Ingen registrert",
    }),
  );

  $("tom").hidden = o.antall > 0;

  // Midlertidige lenker til vedleggene (filene er private), samme måte som servicehefte
  let lenker = {};
  const stier = o.aar.flatMap((a) => a.hendelser.flatMap((h) => (h.dokumenter ?? []).map((d) => d.filsti)));
  try {
    lenker = await signerteLenker(supabase, stier);
  } catch {
    $("melding").textContent = "Kunne ikke hente vedleggene akkurat nå.";
    $("melding").className = "melding feil";
  }

  $("aar-liste").replaceChildren(...o.aar.map((a) => {
    const li = el("li", "aar");
    const hode = el("div", "aar-hode");
    hode.append(el("h2", null, a.aar));
    hode.append(el("span", "aar-sum", `${a.hendelser.length} ${a.hendelser.length === 1 ? "jobb" : "jobber"} · ${a.hendelser.some((h) => h.kostnad != null) ? formaterKr(a.sum) : "ingen beløp"}`));
    const ol = el("ol", "jobb-liste");
    ol.append(...a.hendelser.map((h) => hendelse(h, lenker)));
    li.append(hode, ol);
    return li;
  }));

  $("innhold").hidden = false;
}

start();

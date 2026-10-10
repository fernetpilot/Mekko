// «Service og EU-kontroll»: hva som kommer for én bil, de neste 12 månedene.
// All beregning ligger i dashboard.js (ren og testet). Her tegnes bare siden.
import { formaterDato, formaterKm } from "./bilstatus.js";
import { alleFrister, aarshjul, nesteService, slitasjeOppsummering } from "./dashboard.js";
import { $, el, lastBil } from "./dashboard-side.js";

const STATUS_TEKST = { ok: "OK", snart: "Snart", forfalt: "Bør gjøres", utsatt: "Utsatt", ukjent: "Ukjent" };
const KILDE_TEKST = { eu: "EU-kontroll", service: "Service", slitasje: "Slitasje" };

function dagerTekst(d) {
  if (d == null) return "";
  if (d === 0) return "i dag";
  if (d === 1) return "i morgen";
  if (d > 0) return `om ${d} dager`;
  return d === -1 ? "i går" : `${-d} dager siden`;
}

function kmIgjenTekst(k) {
  if (k == null) return "";
  return k > 0 ? `${formaterKm(k)} igjen` : `${formaterKm(-k)} over`;
}

/** Linje under navnet: dato, km og hvor lenge det er igjen. */
function detaljer(f) {
  if (f.kilde === "eu") return [f.dato && formaterDato(f.dato), dagerTekst(f.dagerIgjen)].filter(Boolean).join(" · ");
  if (f.id === "dekk") return f.tekst || "Dekkene ser fine ut";
  return [
    f.dato && formaterDato(f.dato),
    f.km != null && `ved ${formaterKm(f.km)}`,
    kmIgjenTekst(f.kmIgjen),
  ].filter(Boolean).join(" · ");
}

function fristRad(f) {
  const li = el("li", `frist ${f.status}`);
  li.append(el("span", "prikk"));
  const tekst = el("div", "frist-tekst");
  tekst.append(el("strong", null, f.navn), el("span", "frist-detaljer", detaljer(f)));
  li.append(tekst, el("span", "merke", f.status === "ok" ? KILDE_TEKST[f.kilde] : STATUS_TEKST[f.status]));
  return li;
}

function flis({ etikett, verdi, under, status }) {
  const d = el("article", `flis ${status}`);
  d.append(el("p", "flis-etikett", etikett), el("p", "flis-verdi", verdi));
  if (under) d.append(el("p", "flis-under", under));
  return d;
}

function tegnFliser(frister) {
  const eu = frister.find((f) => f.id === "eu");
  const service = nesteService(frister);
  const slitasje = slitasjeOppsummering(frister);

  const euFlis = eu.dato
    ? flis({
      etikett: "EU-kontroll",
      verdi: formaterDato(eu.dato),
      under: eu.dagerIgjen < 0 ? `Fristen gikk ut for ${-eu.dagerIgjen} dager siden` : `${dagerTekst(eu.dagerIgjen)[0].toUpperCase()}${dagerTekst(eu.dagerIgjen).slice(1)}`,
      status: eu.status,
    })
    : flis({ etikett: "EU-kontroll", verdi: "Ingen frist", under: "Oppdater bilen under Mine biler", status: "ukjent" });

  const serviceFlis = service
    ? flis({
      etikett: "Neste service",
      verdi: service.navn,
      under: service.status === "forfalt"
        ? `Burde vært gjort ${[service.dato && formaterDato(service.dato), service.km != null && `ved ${formaterKm(service.km)}`].filter(Boolean).join(" eller ")}`
        : [service.dato && formaterDato(service.dato), kmIgjenTekst(service.kmIgjen)].filter(Boolean).join(" · "),
      status: service.status,
    })
    : flis({
      etikett: "Neste service",
      verdi: "Ingen plan ennå",
      under: frister.some((f) => f.kilde === "service")
        ? "Registrer siste service, så regner vi ut neste"
        : "Serviceplan finnes foreløpig bare for Discovery 3",
      status: "ukjent",
    });

  const slitasjeFlis = flis({
    etikett: "Dekk og slitasje",
    verdi: slitasje.status === "ukjent" ? "Ikke registrert"
      : slitasje.deler.length ? slitasje.deler.map((d) => d.navn).join(", ") : "Alt ser bra ut",
    under: slitasje.status === "ukjent" ? "Legg inn dekk og bremser under Mine biler"
      : slitasje.deler.length ? STATUS_TEKST[slitasje.status] + (slitasje.deler[0].kmIgjen != null ? ` · ${kmIgjenTekst(slitasje.deler[0].kmIgjen)}` : "")
        : "Bremser, filter og dekk",
    status: slitasje.status,
  });

  $("fliser").replaceChildren(euFlis, serviceFlis, slitasjeFlis);
}

function tegnListe(seksjonId, listeId, frister) {
  $(seksjonId).hidden = frister.length === 0;
  $(listeId).replaceChildren(...frister.map(fristRad));
}

async function start() {
  const res = await lastBil();
  if (!res?.bil) return;
  const { bil } = res;
  document.title = `Mekkoo – service og EU-kontroll ${bil.kjennemerke}`;

  const idag = new Date();
  const frister = alleFrister(bil, idag);
  const hjul = aarshjul(frister, idag);

  tegnFliser(frister);
  tegnListe("forfalt", "forfalt-liste", hjul.forfalt);
  tegnListe("km-frister", "km-liste", hjul.utenDato);
  tegnListe("senere", "senere-liste", hjul.senere);

  if (hjul.maaneder.every((m) => m.frister.length === 0)) {
    const li = el("li", "maaned tom");
    li.append(el("p", "liten", "Ingen kjente frister de neste 12 månedene. Registrer vedlikehold, så fyller oversikten seg."));
    $("aarshjul").replaceChildren(li);
  } else $("aarshjul").replaceChildren(...hjul.maaneder.map((m, i) => {
    const li = el("li", `maaned${m.frister.length ? "" : " tom"}${i === 0 ? " denne" : ""}`);
    const hode = el("div", "maaned-hode");
    hode.append(el("h3", null, m.navn[0].toUpperCase() + m.navn.slice(1)));
    if (i === 0) hode.append(el("span", "merke", "Nå"));
    li.append(hode);
    if (m.frister.length) {
      const ul = el("ul", "frist-liste");
      ul.append(...m.frister.map(fristRad));
      li.append(ul);
    } else {
      li.append(el("p", "liten", "Ingenting denne måneden"));
    }
    return li;
  }));

  $("ukjent").hidden = hjul.ukjent.length === 0;
  $("ukjent-liste").textContent = hjul.ukjent.map((f) => f.navn).join(" · ");

  $("innhold").hidden = false;
}

start();

// Kortene på forsiden (Motorrom, Bremseanlegg, Dekk og hjul) for innloggede brukere:
// status og tekst fra bilens egen servicehistorikk. Ren modul: ingen DOM og ingen nettverk.
// Utloggede ser eksempelkortene som står i index.html.

import { alleFrister, sorterFrister, MANEDSNAVN } from "./dashboard.js";
import { sisteUtfortPerPunkt } from "./servicevarsler.js";
import { fmtKm } from "./service.js";

// Visningsstatus (dashboard.js) → klassen kortene på forsiden bruker (status-ok/-sjekk/-kritisk/-tom)
const KLASSE = { ok: "ok", snart: "sjekk", forfalt: "kritisk", utsatt: "tom", ukjent: "tom" };
const STATUS_TEKST = { ok: "OK", snart: "Snart", forfalt: "Bør gjøres", utsatt: "Utsatt", ukjent: "Ikke registrert" };

/** «for 6 mnd siden», «denne måneden», «for 2 år siden» */
export function sidenTekst(datoIso, idag = new Date()) {
  const [a, m] = datoIso.split("-").map(Number);
  const mnd = (idag.getUTCFullYear() - a) * 12 + (idag.getUTCMonth() + 1 - m);
  if (mnd <= 0) return "denne måneden";
  if (mnd < 24) return `for ${mnd} mnd siden`;
  return `for ${Math.floor(mnd / 12)} år siden`;
}

/** «2025-06-10» → «juni 2025» */
function maaned(datoIso) {
  const [a, m] = datoIso.split("-").map(Number);
  return `${MANEDSNAVN[m - 1]} ${a}`;
}

function kmTekst(kmIgjen) {
  if (kmIgjen == null) return "";
  return kmIgjen >= 0 ? `${fmtKm(kmIgjen)} km igjen` : `${fmtKm(-kmIgjen)} km over`;
}

function kort(status, tittel, tekst, fane, statusTekst = STATUS_TEKST[status]) {
  return { status: KLASSE[status] ?? "tom", statusTekst, tittel, tekst, fane };
}

function motor(frister, siste, idag) {
  const olje = frister.find((f) => f.id === "motorolje");
  const sist = siste.motorolje ?? siste.oljefilter ?? null;
  const sistTekst = sist ? `Sist skiftet ${sidenTekst(sist.dato, idag)}.` : "";

  if (olje && olje.status !== "ukjent") {
    const neste = [olje.dato && maaned(olje.dato), kmTekst(olje.kmIgjen)].filter(Boolean).join(", ");
    const tekst = olje.status === "forfalt"
      ? `${sistTekst} Fristen er passert.`
      : `${sistTekst} Neste ${neste || "ukjent"}.`;
    return kort(olje.status, "Motorolje & filter", tekst.trim(), "service");
  }
  if (sist) {
    // Ingen serviceplan for bilen ennå (bare Discovery 3 har det), men vi vet når den ble gjort
    return kort("ukjent", "Motorolje & filter", sistTekst, "vedlikehold", "Registrert");
  }
  return kort("ukjent", "Motorolje & filter", "Registrer siste oljeskift, så regner vi ut neste.", "service");
}

function bremser(frister, siste, idag) {
  const b = frister.find((f) => f.id === "bremseklosser");
  const sist = siste.bremseklosser ?? null;
  if (!b || b.status === "ukjent" || !sist) {
    return kort("ukjent", "Bremseklosser", "Registrer når bremseklossene sist ble byttet.", "service");
  }
  const deler = [`Byttet ${sidenTekst(sist.dato, idag)}.`];
  if (b.status === "utsatt") deler.push("Sjekken er utsatt.");
  else if (b.kmIgjen != null) deler.push(b.kmIgjen >= 0 ? `${kmTekst(b.kmIgjen)} til neste sjekk.` : `${kmTekst(b.kmIgjen)} intervallet.`);
  return kort(b.status, "Bremseklosser", deler.join(" "), "service",
    b.status === "forfalt" ? "Bør sjekkes" : STATUS_TEKST[b.status]);
}

function dekk(frister) {
  const d = frister.find((f) => f.id === "dekk");
  const skift = frister.find((f) => f.id === "dekkskift");
  const kjente = [d, skift].filter((f) => f && f.status !== "ukjent");
  if (!kjente.length) {
    return kort("ukjent", "Dekk", "Registrer dekkene dine, så sier vi fra når de bør byttes.", "dekk");
  }
  // Det mest presserende av dekkene selv og dekkskiftet
  const verst = sorterFrister(kjente)[0];
  if (verst.id === "dekkskift" && verst.status !== "ok") {
    return kort(verst.status, verst.navn, verst.tekst || "", "dekk", verst.status === "forfalt" ? "På tide" : "Snart");
  }
  if (verst.id === "dekk") {
    return kort(verst.status, "Dekk", verst.tekst || "Dekkene ser fine ut.", "dekk",
      verst.status === "forfalt" ? "Må byttes!" : STATUS_TEKST[verst.status]);
  }
  return kort("ok", "Dekk", d?.tekst || "Dekkene ser fine ut.", "dekk");
}

/**
 * Innholdet i de tre kortene på forsiden for én bil.
 * @returns {{ motor, bremser, dekk }} hver med { status: ok|sjekk|kritisk|tom, statusTekst, tittel, tekst, fane }
 *   fane er fanen i «Bilen din» kortet lenker til.
 */
export function forsideKort(bil, idag = new Date()) {
  const frister = alleFrister(bil, idag);
  const siste = sisteUtfortPerPunkt(bil?.vedlikehold ?? []);
  return {
    motor: motor(frister, siste, idag),
    bremser: bremser(frister, siste, idag),
    dekk: dekk(frister),
  };
}

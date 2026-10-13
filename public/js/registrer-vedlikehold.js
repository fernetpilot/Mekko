// Registrer vedlikehold: egen side, nås fra Min profil-menyen og fra hver bil under Mine biler.
// Med ?endre=<id> endres en registrering som finnes fra før, og den kan slettes.
import { supabase } from "./supabase.js";
import { bilLenke, formaterKm } from "./bilstatus.js";
import { BUCKET, lastOppDokumenter, MAKS_BYTES, erPdf, slettFilerForVedlikehold } from "./dokumenter.js";
import { gjettServicepunkter, utvidDeler } from "./servicepunkt-gjetting.js";
import { lagPunktvelger, hentBilEgenskaper } from "./punktvelger.js";

const $ = (id) => document.getElementById(id);
const skjema = $("vedlikehold-skjema");
const valg = $("bil-valg");

function melding(tekst, type = "") {
  $("melding").textContent = tekst;
  $("melding").className = `melding ${type}`;
}

function idagTekst() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let biler = [];
let brukerId = null;
let valgteFiler = [];
const endreId = new URLSearchParams(location.search).get("endre");
let endres = null;              // registreringen som endres (med dokumenter)

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  brukerId = session.user.id;

  const { data, error } = await supabase
    .from("biler")
    .select("id, kjennemerke, kallenavn, merke, modell, kilometerstand")
    .order("opprettet");
  $("laster").hidden = true;

  if (error) {
    $("laster").hidden = false;
    $("laster").textContent = "Kunne ikke hente bilene dine. Last siden på nytt.";
    return;
  }
  biler = data;
  if (!biler.length) {
    $("ingen-biler").hidden = false;
    return;
  }

  for (const bil of biler) {
    const o = document.createElement("option");
    o.value = bil.id;
    o.textContent = `${bil.kjennemerke} – ${bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ")}`;
    valg.append(o);
  }
  const forvalgt = new URLSearchParams(location.search).get("bil");
  if (biler.some((b) => b.id === forvalgt)) valg.value = forvalgt;

  skjema.dato.value = idagTekst();
  if (endreId && !(await fyllInnForEndring())) return;
  visKmHint();
  oppdaterImportLenke();
  filtrerPaaBil();
  skjema.hidden = false;
}

// ---------------------------------------------------------------------------
// Endre en registrering som finnes fra før
// ---------------------------------------------------------------------------
async function fyllInnForEndring() {
  const { data: rad, error } = await supabase
    .from("vedlikehold").select("*, dokumenter(*)").eq("id", endreId).maybeSingle();
  if (error || !rad) {
    $("laster").hidden = false;
    $("laster").textContent = "Fant ikke denne registreringen. Den kan være slettet.";
    return false;
  }
  endres = rad;
  document.title = "Mekkoo – endre vedlikehold";
  $("tittel").textContent = "Endre vedlikehold";
  $("import-lenke").hidden = true;
  $("lagre-knapp").textContent = "Lagre endringer";
  $("slett-knapp").hidden = false;

  valg.value = rad.bil_id;
  skjema.komponent.value = rad.komponent;
  skjema.dato.value = rad.dato;
  skjema.kilometerstand.value = rad.kilometerstand ?? "";
  skjema.kostnad.value = rad.kostnad ?? "";
  skjema.utfort_av.value = rad.utfort_av ?? "";
  skjema.notat.value = rad.notat ?? "";
  valgteDeler = rad.servicepunkter ?? [];
  velger.sett(valgteDeler);
  visServicepunkt();
  tegnLagredeFiler();
  return true;
}

// Vedlegg som allerede er lagret: kan fjernes enkeltvis
function tegnLagredeFiler() {
  const ul = $("lagrede-filer");
  const dok = endres?.dokumenter ?? [];
  ul.hidden = !dok.length;
  ul.replaceChildren(...dok.map((d) => {
    const li = document.createElement("li");
    const navn = document.createElement("span");
    navn.className = "navn";
    navn.textContent = `${d.mimetype === "application/pdf" ? "📄" : "🖼️"} ${d.filnavn}`;
    const info = document.createElement("span");
    info.className = "liten";
    info.textContent = "Lagret";
    const fjern = document.createElement("button");
    fjern.type = "button";
    fjern.className = "ikon-knapp";
    fjern.setAttribute("aria-label", `Slett ${d.filnavn}`);
    fjern.textContent = "✕";
    fjern.addEventListener("click", () => slettLagretFil(d));
    li.append(navn, info, fjern);
    return li;
  }));
}

async function slettLagretFil(d) {
  if (!confirm(`Slette «${d.filnavn}»? Dette kan ikke angres.`)) return;
  const { error: lagringsfeil } = await supabase.storage.from(BUCKET).remove([d.filsti]);
  const { error } = lagringsfeil ? { error: lagringsfeil } : await supabase.from("dokumenter").delete().eq("id", d.id);
  if (error) return melding("Kunne ikke slette vedlegget. Prøv igjen.", "feil");
  endres.dokumenter = endres.dokumenter.filter((x) => x.id !== d.id);
  tegnLagredeFiler();
  melding("Vedlegget er slettet.", "ok");
}

$("slett-knapp").addEventListener("click", async (e) => {
  if (!endres || !confirm("Slette denne registreringen og vedleggene? Dette kan ikke angres.")) return;
  e.target.disabled = true;
  melding("Sletter …");
  try {
    await slettFilerForVedlikehold(supabase, [endres.id]);
    const { error } = await supabase.from("vedlikehold").delete().eq("id", endres.id);
    if (error) throw error;
  } catch {
    e.target.disabled = false;
    return melding("Kunne ikke slette. Prøv igjen.", "feil");
  }
  location.assign(bilLenke({ id: endres.bil_id }, "vedlikehold"));
});

// Vis siste kjente kilometerstand som hjelp
function visKmHint() {
  const bil = biler.find((b) => b.id === valg.value);
  skjema.kilometerstand.placeholder = bil?.kilometerstand != null ? `Sist: ${formaterKm(bil.kilometerstand)}` : "";
}
valg.addEventListener("change", visKmHint);

// Deler: hele servicekatalogen, gruppert i kategorier. Skjules bare for EU-kontroll.
let valgteDeler = [];
const velger = lagPunktvelger({
  klasse: "punkt-chip",
  // Motorolje og oljefilter følger hverandre
  vedEndring(id, valgt) {
    valgteDeler = valgt ? utvidDeler([...valgteDeler, id]) : valgteDeler.filter((d) => d !== id);
    velger.sett(valgteDeler);
  },
});
$("servicepunkt-valg").append(velger.el);
// Vis bare deler som passer valgt bil (drivstoff, drift, girkasse, luftfjæring)
async function filtrerPaaBil() {
  const bil = biler.find((b) => b.id === valg.value);
  velger.settBil(null);
  const egenskaper = await hentBilEgenskaper(bil?.kjennemerke);
  if (valg.value === bil?.id) velger.settBil(egenskaper);
}
valg.addEventListener("change", filtrerPaaBil);
function visServicepunkt() {
  $("servicepunkt-felt").hidden = skjema.komponent.value === "eu_kontroll";
}
skjema.komponent.addEventListener("change", visServicepunkt);
visServicepunkt();
// Lenken til import følger valgt bil
function oppdaterImportLenke() {
  $("import-lenke").href = valg.value ? `/importer-historikk?bil=${encodeURIComponent(valg.value)}` : "/importer-historikk";
}
valg.addEventListener("change", oppdaterImportLenke);

// ---------------------------------------------------------------------------
// Valgte filer: kan legges til i flere omganger og fjernes før lagring
// ---------------------------------------------------------------------------
function storrelse(bytes) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(bytes / 1024)} kB`;
}

function tegnValgteFiler() {
  const ul = $("valgte-filer");
  ul.replaceChildren(...valgteFiler.map((fil, i) => {
    const li = document.createElement("li");
    const navn = document.createElement("span");
    navn.className = "navn";
    navn.textContent = `${erPdf(fil) ? "📄" : "🖼️"} ${fil.name}`;
    const info = document.createElement("span");
    // Store bilder skaleres ned ved opplasting, så bare PDF-er stoppes på størrelse her
    const forStor = erPdf(fil) && fil.size > MAKS_BYTES;
    info.className = forStor ? "feil" : "liten";
    info.textContent = forStor ? "For stor (maks 10 MB)" : storrelse(fil.size);
    const fjern = document.createElement("button");
    fjern.type = "button";
    fjern.className = "ikon-knapp";
    fjern.setAttribute("aria-label", `Fjern ${fil.name}`);
    fjern.textContent = "✕";
    fjern.addEventListener("click", () => { valgteFiler.splice(i, 1); tegnValgteFiler(); });
    li.append(navn, info, fjern);
    return li;
  }));
}

$("filer").addEventListener("change", (e) => {
  valgteFiler.push(...e.target.files);
  e.target.value = ""; // samme fil kan velges igjen
  tegnValgteFiler();
});

function rad_notat(skjema) {
  return skjema.notat.value.trim();
}

skjema.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tall = (v) => (v === "" ? null : Number(v));
  const bil = biler.find((b) => b.id === valg.value);
  const rad = {
    bil_id: valg.value,
    komponent: skjema.komponent.value,
    dato: skjema.dato.value,
    kilometerstand: tall(skjema.kilometerstand.value),
    kostnad: tall(skjema.kostnad.value),
    utfort_av: skjema.utfort_av.value.trim() || null,
    notat: skjema.notat.value.trim() || null,
    servicepunkter: $("servicepunkt-felt").hidden
      ? []
      : (valgteDeler.length ? valgteDeler : gjettServicepunkter(skjema.komponent.value, rad_notat(skjema))),
  };

  if (valgteFiler.some((f) => erPdf(f) && f.size > MAKS_BYTES)) {
    return melding("Fjern filer som er større enn 10 MB før du lagrer.", "feil");
  }

  e.submitter.disabled = true;
  melding("Lagrer …");
  const { data: lagret, error } = endres
    ? await supabase.from("vedlikehold").update(rad).eq("id", endres.id).select("id").single()
    : await supabase.from("vedlikehold").insert(rad).select("id").single();
  if (error) {
    e.submitter.disabled = false;
    return melding("Kunne ikke lagre. Sjekk feltene og prøv igjen.", "feil");
  }

  // Last opp dokumentasjon til registreringen
  let opplastingsfeil = [];
  if (valgteFiler.length) {
    const resultat = await lastOppDokumenter(supabase, {
      eierId: brukerId,
      vedlikeholdId: lagret.id,
      filer: valgteFiler,
      framdrift: (tekst) => melding(tekst),
    });
    opplastingsfeil = resultat.feil;
  }

  // Oppdater bilens kilometerstand hvis denne er nyere
  if (rad.kilometerstand != null && rad.kilometerstand > (bil?.kilometerstand ?? -1)) {
    await supabase.from("biler")
      .update({ kilometerstand: rad.kilometerstand, kilometerstand_dato: rad.dato })
      .eq("id", rad.bil_id);
  }
  if (opplastingsfeil.length) {
    // Registreringen er lagret; vis hva som ikke ble lastet opp før vi går videre
    alert(`Vedlikeholdet er lagret, men noen filer ble ikke lastet opp:\n\n${opplastingsfeil.join("\n")}`);
  }
  melding("Lagret!", "ok");
  location.assign(bilLenke({ id: rad.bil_id }, "vedlikehold"));
});

start();

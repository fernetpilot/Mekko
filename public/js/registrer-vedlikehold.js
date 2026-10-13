// Registrer vedlikehold: egen side, nås fra Min profil-menyen og fra hver bil under Mine biler.
import { supabase } from "./supabase.js";
import { bilLenke, formaterKm } from "./bilstatus.js";
import { lastOppDokumenter, MAKS_BYTES, erPdf } from "./dokumenter.js";
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
  visKmHint();
  oppdaterImportLenke();
  filtrerPaaBil();
  skjema.hidden = false;
}

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
  const { data: lagret, error } = await supabase.from("vedlikehold").insert(rad).select("id").single();
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

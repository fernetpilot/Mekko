// Registrer vedlikehold: egen side, nås fra Min profil-menyen og fra hver bil under Mine biler.
import { supabase } from "./supabase.js";
import { formaterKm } from "./bilstatus.js";

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

async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }

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
  skjema.hidden = false;
}

// Vis siste kjente kilometerstand som hjelp
function visKmHint() {
  const bil = biler.find((b) => b.id === valg.value);
  skjema.kilometerstand.placeholder = bil?.kilometerstand != null ? `Sist: ${formaterKm(bil.kilometerstand)}` : "";
}
valg.addEventListener("change", visKmHint);

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
  };

  e.submitter.disabled = true;
  melding("Lagrer …");
  const { error } = await supabase.from("vedlikehold").insert(rad);
  if (error) {
    e.submitter.disabled = false;
    return melding("Kunne ikke lagre. Sjekk feltene og prøv igjen.", "feil");
  }

  // Oppdater bilens kilometerstand hvis denne er nyere
  if (rad.kilometerstand != null && rad.kilometerstand > (bil?.kilometerstand ?? -1)) {
    await supabase.from("biler")
      .update({ kilometerstand: rad.kilometerstand, kilometerstand_dato: rad.dato })
      .eq("id", rad.bil_id);
  }
  melding("Lagret!", "ok");
  location.assign(`/min-side#bil-${rad.bil_id}`);
});

start();

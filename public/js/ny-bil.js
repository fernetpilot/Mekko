// Legg til en bil på innlogget bruker: slå opp skiltet hos Statens vegvesen (via vår proxy) og lagre.
// Brukes av Min side og av «Bilen din» på forsiden.
import { supabase } from "./supabase.js";
import { hentKjoretoy } from "./kjoretoy.js";

/** Slår opp et skilt og returnerer bilen. Kaster feil med norsk tekst. */
export async function slaOppBil(skilt) {
  let res, svar;
  try {
    res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(skilt)}`);
    svar = await res.json();
  } catch {
    throw new Error("Fikk ikke kontakt med Statens vegvesen. Prøv igjen.");
  }
  if (!res.ok) throw new Error(svar.feil || "Fant ikke bilen.");
  const k = hentKjoretoy(svar);
  if (k.erTilhenger) throw new Error("Dette skiltet tilhører en tilhenger. Skriv skiltet på bilen din.");
  return k;
}

/** Lagrer en oppslått bil på innlogget bruker og returnerer id-en til den nye raden. */
export async function lagreNyBil(skilt, k) {
  const { data, error } = await supabase.from("biler").insert({
    kjennemerke: skilt,
    merke: k.merke,
    modell: k.modell,
    forstegangsregistrert: k.forstegangsregistrert,
    eu_kontrollfrist: k.euKontrollfrist,
  }).select("id").single();
  if (error) {
    throw new Error(error.code === "23505"
      ? "Denne bilen ligger allerede under Mine biler."
      : "Kunne ikke lagre bilen. Prøv igjen.");
  }
  return data?.id ?? null;
}

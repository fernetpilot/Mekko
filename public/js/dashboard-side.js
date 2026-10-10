// Felles for oversiktssidene «Service og EU-kontroll» og «Vedlikehold»:
// sjekker innlogging, henter bilene, velger bil (?bil=<id> eller den første) og fyller toppen.
import { supabase } from "./supabase.js";
import { formaterKm } from "./bilstatus.js";
import { bilNavn, velgBil } from "./dashboard.js";

export const $ = (id) => document.getElementById(id);

/** Lager et element med klasse og tekst. */
export function el(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
}

/**
 * @returns {Promise<{ bil: object|null, biler: object[], supabase }|null>}
 *   null betyr at siden sendes videre (ikke innlogget) eller at noe feilet (melding vises).
 */
export async function lastBil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return null;
  }

  const { data: biler, error } = await supabase
    .from("biler")
    .select("*, vedlikehold(*, dokumenter(*)), utsettelser(*)")
    .order("opprettet")
    .order("dato", { referencedTable: "vedlikehold", ascending: false });

  $("laster").hidden = true;
  if (error) {
    $("laster").hidden = false;
    $("laster").textContent = "Kunne ikke hente bilene dine. Last siden på nytt.";
    return null;
  }
  if (!biler.length) {
    $("ingen-biler").hidden = false;
    return { bil: null, biler, supabase };
  }

  const bil = velgBil(biler, new URLSearchParams(location.search).get("bil"));
  tegnBilHode(bil, biler);
  return { bil, biler, supabase };
}

function tegnBilHode(bil, biler) {
  $("bil-skilt").textContent = bil.kjennemerke;
  $("bil-navn").textContent = bilNavn(bil);
  $("bil-km").textContent = bil.kilometerstand != null ? formaterKm(bil.kilometerstand) : "";
  $("bil-hode").hidden = false;

  // Lenker mellom sidene og til registrering tar med valgt bil
  const id = encodeURIComponent(bil.id);
  for (const a of document.querySelectorAll("[data-bil-lenke]")) {
    a.href = `${a.dataset.bilLenke}?bil=${id}`;
  }

  // Flere biler: velg i en liste
  if (biler.length > 1) {
    const valg = $("bil-valg");
    for (const b of biler) {
      const o = el("option", null, `${b.kjennemerke} – ${bilNavn(b)}`);
      o.value = b.id;
      valg.append(o);
    }
    valg.value = bil.id;
    valg.addEventListener("change", () => {
      location.search = `?bil=${encodeURIComponent(valg.value)}`;
    });
    $("bil-velger").hidden = false;
  }
}

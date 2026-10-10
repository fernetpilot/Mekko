// Knappene øverst til høyre: Varsler (bjelle) og Min profil (person).
import { lagVarsler } from "/js/varsler.js";

const NOKKEL = "sb-pwihbhlnskaysbxzoqwu-auth-token"; // Supabase lagrer innloggingen her

// ---------------------------------------------------------------------------
// Felles: åpne/lukke nedtrekkspaneler (bare ett åpent om gangen)
// ---------------------------------------------------------------------------
const paneler = [
  { knapp: document.getElementById("varsel-knapp"), panel: document.getElementById("varsel-panel") },
  { knapp: document.getElementById("profil-knapp"), panel: document.getElementById("profil-meny") },
];

function settApen(valgt, apen) {
  for (const p of paneler) {
    const denne = p === valgt && apen;
    p.panel.hidden = !denne;
    p.knapp.setAttribute("aria-expanded", String(denne));
  }
  if (apen) valgt.panel.querySelector("[role=menuitem]:not([aria-disabled=true]), a")?.focus();
}

for (const p of paneler) {
  p.knapp.addEventListener("click", (e) => {
    e.stopPropagation();
    settApen(p, p.panel.hidden);
  });
}

document.addEventListener("click", (e) => {
  for (const p of paneler) {
    if (!p.panel.hidden && !p.panel.contains(e.target)) settApen(p, false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const apen = paneler.find((p) => !p.panel.hidden);
  if (apen) {
    settApen(apen, false);
    apen.knapp.focus();
  }
});

// ---------------------------------------------------------------------------
// Min profil
// ---------------------------------------------------------------------------
const meny = document.getElementById("profil-meny");

// Vis e-postadressen uten å vente på Supabase-biblioteket
try {
  const okt = JSON.parse(localStorage.getItem(NOKKEL) || "null");
  document.getElementById("profil-epost").textContent = okt?.user?.email ?? "";
} catch { /* ignorer */ }

// «Kommer snart»-punkter skal ikke navigere
meny.querySelectorAll("[aria-disabled=true]").forEach((el) =>
  el.addEventListener("click", (e) => e.preventDefault()),
);

document.getElementById("profil-logg-ut").addEventListener("click", async (e) => {
  e.currentTarget.textContent = "Logger ut …";
  try {
    const { supabase } = await import("/js/supabase.js");
    await supabase.auth.signOut();
  } catch {
    // Får vi ikke kontakt, fjern innloggingen lokalt så brukeren likevel blir logget ut her
    try { localStorage.removeItem(NOKKEL); } catch { /* ignorer */ }
  }
  location.replace("/min-side?neste=%2F");
});

// ---------------------------------------------------------------------------
// Varsler
// ---------------------------------------------------------------------------
const liste = document.getElementById("varsel-liste");
const teller = document.getElementById("varsel-teller");
const varselKnapp = document.getElementById("varsel-knapp");

function tegnVarsler(varsler) {
  liste.replaceChildren();
  if (!varsler.length) {
    const li = document.createElement("li");
    li.className = "varsel-tom";
    li.textContent = "Ingen varsler nå. Vi sier fra når det nærmer seg EU-kontroll eller service.";
    liste.append(li);
  }
  for (const v of varsler) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = v.lenke ?? "/min-side";
    a.className = `varsel varsel-${v.niva}`;
    const tittel = document.createElement("strong");
    tittel.textContent = v.tittel;
    const tekst = document.createElement("span");
    tekst.textContent = v.tekst;
    a.append(tittel, tekst);
    li.append(a);
    liste.append(li);
  }

  teller.hidden = varsler.length === 0;
  teller.textContent = varsler.length > 9 ? "9+" : String(varsler.length);
  teller.classList.toggle("kritisk", varsler.some((v) => v.niva === "kritisk"));
  varselKnapp.setAttribute("aria-label", varsler.length ? `Varsler (${varsler.length})` : "Varsler");
}

async function hentVarsler() {
  try {
    const { supabase } = await import("/js/supabase.js");
    const { data: biler, error } = await supabase
      .from("biler")
      .select("kjennemerke, kallenavn, merke, modell, eu_kontrollfrist");
    if (error) throw error;
    tegnVarsler(lagVarsler(biler));
  } catch {
    liste.replaceChildren();
    const li = document.createElement("li");
    li.className = "varsel-tom";
    li.textContent = "Kunne ikke hente varsler akkurat nå.";
    liste.append(li);
  }
}

// Vent til siden er tegnet, så 3D-bilen ikke må vente på varslene.
// Utloggede brukere har ingen varsler å hente.
const innlogget = document.documentElement.classList.contains("innlogget");
if (innlogget) {
  if (document.readyState === "complete") hentVarsler();
  else addEventListener("load", hentVarsler, { once: true });
}

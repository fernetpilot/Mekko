// «Min profil»-menyen under personikonet øverst til høyre.

const NOKKEL = "sb-pwihbhlnskaysbxzoqwu-auth-token"; // Supabase lagrer innloggingen her
const knapp = document.getElementById("profil-knapp");
const meny = document.getElementById("profil-meny");

// Vis e-postadressen uten å laste hele Supabase-biblioteket
try {
  const okt = JSON.parse(localStorage.getItem(NOKKEL) || "null");
  document.getElementById("profil-epost").textContent = okt?.user?.email ?? "";
} catch { /* ignorer */ }

function apne(apen) {
  meny.hidden = !apen;
  knapp.setAttribute("aria-expanded", String(apen));
  if (apen) meny.querySelector("[role=menuitem]:not([aria-disabled=true])")?.focus();
}

knapp.addEventListener("click", (e) => {
  e.stopPropagation();
  apne(meny.hidden);
});

// Lukk ved klikk utenfor eller Escape
document.addEventListener("click", (e) => {
  if (!meny.hidden && !meny.contains(e.target)) apne(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !meny.hidden) {
    apne(false);
    knapp.focus();
  }
});

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

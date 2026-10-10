// Min side: innlogging med e-postlenke, mine biler og vedlikehold.
import { supabase } from "./supabase.js";
import { hentKjoretoy, normaliserSkilt } from "./kjoretoy.js";
import { euStatus, formaterDato, formaterKm, KOMPONENT_NAVN } from "./bilstatus.js";

const $ = (id) => document.getElementById(id);

function melding(el, tekst, type = "") {
  el.textContent = tekst;
  el.className = `melding ${type}`;
}

function idagTekst() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Innlogging
// ---------------------------------------------------------------------------

// Modus: "logg-inn" eller "ny-konto"
let modus = "logg-inn";

function settModus(ny) {
  modus = ny;
  const nyKonto = ny === "ny-konto";
  $("fane-logg-inn").setAttribute("aria-selected", String(!nyKonto));
  $("fane-ny-konto").setAttribute("aria-selected", String(nyKonto));
  $("innlogging-tittel").textContent = nyKonto ? "Opprett konto" : "Logg inn";
  $("innlogging-knapp").textContent = nyKonto ? "Opprett konto" : "Logg inn";
  $("passord").autocomplete = nyKonto ? "new-password" : "current-password";
  $("passord-hint").hidden = !nyKonto;
  $("glemt-passord").hidden = nyKonto;
  melding($("innlogging-melding"), "");
}
$("fane-logg-inn").addEventListener("click", () => settModus("logg-inn"));
$("fane-ny-konto").addEventListener("click", () => settModus("ny-konto"));

/** Gjør Supabase-feil om til forståelig norsk. */
function feilTekst(error) {
  const kode = error?.code ?? "";
  const tekst = error?.message ?? "";
  if (error?.status === 429 || /rate limit/i.test(tekst)) return "For mange forsøk akkurat nå. Vent litt og prøv igjen.";
  if (kode === "invalid_credentials" || /invalid login/i.test(tekst)) return "Feil e-post eller passord.";
  if (kode === "email_not_confirmed" || /not confirmed/i.test(tekst)) return "Du må bekrefte e-postadressen først. Sjekk innboksen din.";
  if (kode === "user_already_exists" || /already registered/i.test(tekst)) return "Det finnes allerede en konto med denne e-postadressen. Logg inn i stedet.";
  if (kode === "weak_password" || /password/i.test(tekst)) return "Passordet er for svakt. Bruk minst 8 tegn.";
  return "Noe gikk galt. Prøv igjen.";
}

$("innlogging-skjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const knapp = $("innlogging-knapp");
  const m = $("innlogging-melding");
  const email = $("epost").value.trim();
  const password = $("passord").value;
  knapp.disabled = true;
  melding(m, modus === "ny-konto" ? "Oppretter konto …" : "Logger inn …");

  if (modus === "ny-konto") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/min-side` },
    });
    knapp.disabled = false;
    if (error) return melding(m, feilTekst(error), "feil");
    // Med e-postbekreftelse på i Supabase får vi ingen innlogging før lenken er trykket.
    if (!data.session) {
      melding(m, "Nesten ferdig! Vi har sendt deg en e-post. Trykk på lenken for å bekrefte kontoen, og logg deretter inn.", "ok");
      settModusBeholdMelding("logg-inn");
    }
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  knapp.disabled = false;
  if (error) melding(m, feilTekst(error), "feil");
});

function settModusBeholdMelding(ny) {
  const m = $("innlogging-melding");
  const tekst = m.textContent, klasse = m.className;
  settModus(ny);
  m.textContent = tekst;
  m.className = klasse;
  $("passord").value = "";
}

$("glemt-passord").addEventListener("click", async () => {
  const m = $("innlogging-melding");
  const email = $("epost").value.trim();
  if (!$("epost").checkValidity() || !email) {
    $("epost").focus();
    return melding(m, "Skriv e-postadressen din først, og trykk «Glemt passord?» igjen.", "feil");
  }
  melding(m, "Sender …");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/min-side`,
  });
  if (error) return melding(m, feilTekst(error), "feil");
  // Samme svar uansett om kontoen finnes, så siden ikke avslører hvem som er registrert.
  melding(m, "Hvis det finnes en konto med denne adressen, har vi sendt en lenke for å velge nytt passord.", "ok");
});

// Nytt passord etter lenke fra «Glemt passord»
$("nytt-passord-skjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = $("nytt-passord-melding");
  e.submitter.disabled = true;
  const { error } = await supabase.auth.updateUser({ password: $("nytt-passord-felt").value });
  e.submitter.disabled = false;
  if (error) return melding(m, feilTekst(error), "feil");
  $("nytt-passord").hidden = true;
  visInnlogget((await supabase.auth.getUser()).data.user);
});

$("logg-ut").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

$("slett-konto").addEventListener("click", async () => {
  if (!confirm("Slette kontoen og alle data permanent?")) return;
  const { error } = await supabase.rpc("slett_min_konto");
  if (error) return alert("Kunne ikke slette kontoen. Prøv igjen senere.");
  await supabase.auth.signOut();
  alert("Kontoen din er slettet.");
});

function visInnlogget(bruker) {
  $("laster").hidden = true;
  $("innlogging").hidden = !!bruker;
  $("konto").hidden = !bruker;
  $("logg-ut").hidden = !bruker;
  if (bruker) {
    $("bruker-epost").textContent = bruker.email;
    lastBiler();
  }
}

supabase.auth.onAuthStateChange((hendelse, okt) => {
  // setTimeout: Supabase anbefaler å ikke kalle databasen direkte i denne callbacken
  setTimeout(() => {
    if (hendelse === "PASSWORD_RECOVERY") {
      $("laster").hidden = true;
      $("innlogging").hidden = true;
      $("konto").hidden = true;
      $("nytt-passord").hidden = false;
      return;
    }
    if (!$("nytt-passord").hidden) return; // bli på «Velg nytt passord» til det er lagret
    visInnlogget(okt?.user ?? null);
  }, 0);
});

// ---------------------------------------------------------------------------
// Biler
// ---------------------------------------------------------------------------

async function lastBiler() {
  const liste = $("biler");
  const { data: biler, error } = await supabase
    .from("biler")
    .select("*, vedlikehold(*)")
    .order("opprettet")
    .order("dato", { referencedTable: "vedlikehold", ascending: false });

  if (error) {
    liste.innerHTML = "";
    const p = document.createElement("p");
    p.className = "melding feil";
    p.textContent = "Kunne ikke hente bilene dine. Last siden på nytt.";
    liste.append(p);
    return;
  }

  liste.replaceChildren(...biler.map(tegnBil));
  if (!biler.length) {
    const p = document.createElement("p");
    p.className = "ingress";
    p.textContent = "Du har ingen biler ennå. Legg til den første under.";
    liste.append(p);
  }
}

function tegnBil(bil) {
  const node = $("bil-mal").content.firstElementChild.cloneNode(true);
  node.querySelector(".bil-skilt").textContent = bil.kjennemerke;
  node.querySelector(".bil-navn").textContent =
    bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ") || "Ukjent bil";

  const eu = euStatus(bil.eu_kontrollfrist);
  const euEl = node.querySelector(".eu");
  euEl.textContent = eu.tekst;
  euEl.classList.add(eu.status);
  node.querySelector(".km").textContent = formaterKm(bil.kilometerstand);

  node.querySelector(".slett-bil").addEventListener("click", async () => {
    if (!confirm(`Fjerne ${bil.kjennemerke} og all vedlikeholdshistorikk for bilen?`)) return;
    const { error } = await supabase.from("biler").delete().eq("id", bil.id);
    if (error) return alert("Kunne ikke fjerne bilen. Prøv igjen.");
    lastBiler();
  });

  // Historikk
  const hendelser = bil.vedlikehold ?? [];
  node.querySelector(".antall").textContent = hendelser.length ? `(${hendelser.length})` : "";
  const ul = node.querySelector(".historikk");
  if (!hendelser.length) {
    const li = document.createElement("li");
    li.className = "tom";
    li.textContent = "Ingenting registrert ennå.";
    ul.append(li);
  }
  for (const h of hendelser) ul.append(tegnHendelse(h));

  // Nytt vedlikehold
  const skjema = node.querySelector(".nytt-vedlikehold");
  skjema.dato.value = idagTekst();
  skjema.addEventListener("submit", (e) => lagreVedlikehold(e, bil));

  return node;
}

function tegnHendelse(h) {
  const li = document.createElement("li");
  const tekst = document.createElement("div");
  const tittel = document.createElement("div");
  tittel.textContent = `${KOMPONENT_NAVN[h.komponent] ?? h.komponent} · ${formaterDato(h.dato)}`;
  const detaljer = document.createElement("div");
  detaljer.className = "detaljer";
  detaljer.textContent = [
    h.kilometerstand != null ? formaterKm(h.kilometerstand) : null,
    h.kostnad != null ? `${Number(h.kostnad).toLocaleString("nb-NO")} kr` : null,
    h.utfort_av,
    h.notat,
  ].filter(Boolean).join(" · ");
  tekst.append(tittel, detaljer);

  const slett = document.createElement("button");
  slett.className = "ikon-knapp";
  slett.type = "button";
  slett.setAttribute("aria-label", "Slett");
  slett.textContent = "✕";
  slett.addEventListener("click", async () => {
    if (!confirm("Slette denne registreringen?")) return;
    const { error } = await supabase.from("vedlikehold").delete().eq("id", h.id);
    if (error) return alert("Kunne ikke slette. Prøv igjen.");
    lastBiler();
  });

  li.append(tekst, slett);
  return li;
}

async function lagreVedlikehold(e, bil) {
  e.preventDefault();
  const f = e.target;
  const m = f.querySelector(".melding");
  const tall = (v) => (v === "" ? null : Number(v));
  const rad = {
    bil_id: bil.id,
    komponent: f.komponent.value,
    dato: f.dato.value,
    kilometerstand: tall(f.kilometerstand.value),
    kostnad: tall(f.kostnad.value),
    utfort_av: f.utfort_av.value.trim() || null,
    notat: f.notat.value.trim() || null,
  };

  e.submitter.disabled = true;
  const { error } = await supabase.from("vedlikehold").insert(rad);
  e.submitter.disabled = false;
  if (error) return melding(m, "Kunne ikke lagre. Sjekk feltene og prøv igjen.", "feil");

  // Oppdater bilens kilometerstand hvis denne er nyere
  if (rad.kilometerstand != null && rad.kilometerstand > (bil.kilometerstand ?? -1)) {
    await supabase.from("biler")
      .update({ kilometerstand: rad.kilometerstand, kilometerstand_dato: rad.dato })
      .eq("id", bil.id);
  }
  lastBiler();
}

// Legg til bil via skiltoppslag hos Statens vegvesen
$("ny-bil-skjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = $("ny-bil-melding");
  const skilt = normaliserSkilt($("nytt-skilt").value);
  if (!skilt) return melding(m, "Skriv et gyldig skiltnummer, f.eks. AB 12345.", "feil");

  e.submitter.disabled = true;
  melding(m, "Henter bilen …");
  try {
    const res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(skilt)}`);
    const svar = await res.json();
    if (!res.ok) throw new Error(svar.feil || "Fant ikke bilen.");

    const k = hentKjoretoy(svar);
    if (k.erTilhenger) throw new Error("Dette er en tilhenger. Legg til bilen din her.");

    const { error } = await supabase.from("biler").insert({
      kjennemerke: skilt,
      merke: k.merke,
      modell: k.modell,
      forstegangsregistrert: k.forstegangsregistrert,
      eu_kontrollfrist: k.euKontrollfrist,
    });
    if (error) {
      throw new Error(error.code === "23505"
        ? "Denne bilen ligger allerede under Mine biler."
        : "Kunne ikke lagre bilen. Prøv igjen.");
    }
    $("nytt-skilt").value = "";
    melding(m, `${[k.merke, k.modell].filter(Boolean).join(" ")} er lagt til.`, "ok");
    lastBiler();
  } catch (feil) {
    melding(m, feil.message, "feil");
  } finally {
    e.submitter.disabled = false;
  }
});

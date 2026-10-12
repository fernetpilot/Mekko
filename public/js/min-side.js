// Min side: innlogging med e-postlenke, mine biler og vedlikehold.
import { supabase } from "./supabase.js";
import { hentKjoretoy, normaliserSkilt } from "./kjoretoy.js";
import { euStatus, formaterDato, formaterKm, KOMPONENT_NAVN } from "./bilstatus.js";
import { kjoretoyDetaljer } from "./kjoretoydetaljer.js";
import { slettFilerForVedlikehold, slettAlleMineFiler } from "./dokumenter.js";
import { servicelinjer } from "./servicevarsler.js";
import { punkterFor } from "./servicepunkter.js";
import { slitasjeLinjer, utsettelseFor, BREMSE_SNOOZE_KM } from "./slitasje.js";
import { alleServicepunkter, gjettServicepunkter, utvidDeler } from "./servicepunkt-gjetting.js";
import { stilFor } from "./punktstil.js";
import { leggPaDekksett } from "./dekk-data.js";

const $ = (id) => document.getElementById(id);

function melding(el, tekst, type = "") {
  el.textContent = tekst;
  el.className = `melding ${type}`;
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
  $("ny-konto-felter").hidden = !nyKonto;
  $("skilt-ny-konto").required = nyKonto;
  $("glemt-passord").hidden = nyKonto;
  melding($("innlogging-melding"), "");
}
$("fane-logg-inn").addEventListener("click", () => settModus("logg-inn"));
$("fane-ny-konto").addEventListener("click", () => settModus("ny-konto"));
// Lenker fra forsiden kan åpne rett på «Opprett konto» med ?modus=ny-konto
if (new URLSearchParams(location.search).get("modus") === "ny-konto") settModus("ny-konto");

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
    // 1. Slå opp bilen først, så kontoen ikke opprettes med et ugyldig skilt
    const skilt = normaliserSkilt($("skilt-ny-konto").value);
    if (!skilt) {
      knapp.disabled = false;
      return melding(m, "Skriv et gyldig skiltnummer, f.eks. AB 12345.", "feil");
    }
    let bil;
    try {
      melding(m, "Henter bilen fra Statens vegvesen …");
      bil = await slaOppBil(skilt);
    } catch (feil) {
      knapp.disabled = false;
      return melding(m, feil.message, "feil");
    }

    // 2. Opprett kontoen. Skiltet lagres på brukeren, og bilen legges inn
    //    automatisk første gang brukeren er logget inn (etter e-postbekreftelse).
    melding(m, "Oppretter konto …");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Etter bekreftelse: logg inn og gå til forsiden
        emailRedirectTo: `${location.origin}/min-side?neste=%2F`,
        data: { forste_bil: skilt },
      },
    });
    knapp.disabled = false;
    if (error) return melding(m, feilTekst(error), "feil");
    // Med e-postbekreftelse på i Supabase får vi ingen innlogging før lenken er trykket.
    if (!data.session) {
      melding(m, `Fant ${bilNavn(bil)}. Nesten ferdig! Vi har sendt deg en e-post – trykk på lenken for å bekrefte kontoen, og logg deretter inn.`, "ok");
      settModusBeholdMelding("logg-inn");
      $("skilt-ny-konto").value = "";
    }
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  knapp.disabled = false;
  if (error) return melding(m, feilTekst(error), "feil");
  // Videre til riktig side skjer i visInnlogget()
});

/** Trygg adresse å sende brukeren videre til etter innlogging, eller null. */
function nesteSide() {
  const neste = new URLSearchParams(location.search).get("neste");
  // Bare stier på vår egen side («/…», ikke «//annen-side.no»)
  return neste && /^\/(?!\/)/.test(neste) && !neste.startsWith("/min-side") ? neste : null;
}

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
  try { await slettAlleMineFiler(supabase); } catch { /* fortsett – kontoen skal slettes uansett */ }
  const { error } = await supabase.rpc("slett_min_konto");
  if (error) return alert("Kunne ikke slette kontoen. Prøv igjen senere.");
  await supabase.auth.signOut();
  alert("Kontoen din er slettet.");
});

// Første bil legges inn bare én gang, selv om flere hendelser ber om det samtidig.
let forsteBilJobb = null;
function sikreForsteBil(bruker) {
  if (!bruker?.user_metadata?.forste_bil) return forsteBilJobb ?? Promise.resolve();
  forsteBilJobb ??= leggInnForsteBil(bruker);
  return forsteBilJobb;
}

let viderekobler = false;

async function visInnlogget(bruker) {
  // Kom brukeren fra en side som krever innlogging? Send dem tilbake dit
  // (etter at en eventuell første bil er lagt inn).
  if (bruker && nesteSide()) {
    if (viderekobler) return;
    viderekobler = true;
    melding($("innlogging-melding"), "Logger inn …");
    await sikreForsteBil(bruker);
    location.replace(nesteSide());
    return;
  }
  $("laster").hidden = true;
  $("innlogging").hidden = !!bruker;
  $("konto").hidden = !bruker;
  $("logg-ut").hidden = !bruker;
  if (!bruker) return;
  $("bruker-epost").textContent = bruker.email;

  if (bruker.user_metadata?.forste_bil) $("biler").textContent = "Legger inn bilen din …";
  await sikreForsteBil(bruker);
  lastBiler();
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
    .select("*, vedlikehold(*, dokumenter(id)), utsettelser(*)")
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

  await leggPaDekksett(supabase, biler);
  liste.replaceChildren(...biler.map(tegnBil));
  // Kom brukeren fra «Registrer vedlikehold»? Vis riktig bil.
  if (location.hash.startsWith("#bil-")) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
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
    if (!confirm(`Fjerne ${bil.kjennemerke} med all vedlikeholdshistorikk og alle vedlegg?`)) return;
    await slettFilerForVedlikehold(supabase, (bil.vedlikehold ?? []).map((v) => v.id));
    const { error } = await supabase.from("biler").delete().eq("id", bil.id);
    if (error) return alert("Kunne ikke fjerne bilen. Prøv igjen.");
    lastBiler();
  });

  // Servicestatus (bare for biler med servicepunkter, foreløpig Discovery 3)
  const serviceUl = node.querySelector(".servicestatus");
  const punkter = punkterFor(bil);
  const serviceSeksjon = node.querySelector(".service-status");
  serviceSeksjon.hidden = punkter.length === 0;
  for (const l of servicelinjer(punkter, bil.vedlikehold ?? [], bil.kilometerstand ?? null)) {
    const li = document.createElement("li");
    li.className = `servicelinje ${l.status}`;
    const navn = document.createElement("span");
    navn.className = "navn";
    navn.textContent = l.navn;
    const status = document.createElement("span");
    status.className = "status";
    status.textContent = l.label;
    li.append(navn, status);
    if (l.frist) {
      const f = document.createElement("span");
      f.className = "frist";
      f.textContent = `Neste: ${l.frist}`;
      li.append(f);
    }
    // Stolpe: hvor mye av km-intervallet som er igjen (bare når km er kjent)
    if (l.kmIgjen != null && l.kmIntervall) {
      const andel = Math.max(0, Math.min(1, l.kmIgjen / l.kmIntervall));
      const stolpe = document.createElement("div");
      stolpe.className = "stolpe";
      stolpe.setAttribute("role", "img");
      stolpe.setAttribute("aria-label", `${Math.round(andel * 100)} prosent igjen`);
      const fyll = document.createElement("div");
      fyll.className = "fyll";
      fyll.style.width = `${Math.round(andel * 100)}%`;
      stolpe.append(fyll);
      const tekst = document.createElement("span");
      tekst.className = "km-igjen";
      tekst.textContent = l.kmIgjen > 0 ? `${formaterKm(l.kmIgjen)} igjen` : `${formaterKm(-l.kmIgjen)} over`;
      li.append(stolpe, tekst);
    }
    serviceUl.append(li);
  }

  // Slitasjedeler: bremser, luftfilter og dekk
  tegnSlitasje(node, bil);

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
  node.querySelector(".vedlikehold").open = hendelser.length > 0;

  node.id = `bil-${bil.id}`;
  node.querySelector(".registrer-lenke").href = `/registrer-vedlikehold?bil=${encodeURIComponent(bil.id)}`;
  node.querySelector(".servicehefte-lenke").href = `/servicehefte?bil=${encodeURIComponent(bil.id)}`;

  // Kjøretøydata hentes først når brukeren åpner seksjonen
  const data = node.querySelector(".kjoretoydata");
  data.addEventListener("toggle", () => {
    if (data.open && !data.dataset.hentet) {
      data.dataset.hentet = "1";
      visKjoretoydata(bil.kjennemerke, data.querySelector(".detaljer-innhold"));
    }
  });

  return node;
}

function span(klasse, tekst) {
  const el = document.createElement("span");
  el.className = klasse;
  el.textContent = tekst;
  return el;
}

function stolpe(kmIgjen, kmIntervall) {
  const andel = Math.max(0, Math.min(1, kmIgjen / kmIntervall));
  const el = document.createElement("div");
  el.className = "stolpe";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `${Math.round(andel * 100)} prosent igjen`);
  const fyll = document.createElement("div");
  fyll.className = "fyll";
  fyll.style.width = `${Math.round(andel * 100)}%`;
  el.append(fyll);
  return el;
}

function tegnSlitasje(node, bil) {
  const ul = node.querySelector(".slitasjeliste");
  const kmNaa = bil.kilometerstand ?? null;
  const linjer = slitasjeLinjer({
    bil,
    rader: bil.vedlikehold ?? [],
    utsettelser: bil.utsettelser ?? [],
    kmNaa,
    idag: new Date(),
  });
  for (const l of linjer) {
    const li = document.createElement("li");
    li.className = `servicelinje ${l.status}`;
    li.append(span("navn", l.navn), span("status", l.label));
    if (l.frist) li.append(span("frist", l.frist));
    if (l.kmIgjen != null && l.kmIntervall) {
      li.append(stolpe(l.kmIgjen, l.kmIntervall), span("km-igjen", l.kmIgjen > 0 ? `${formaterKm(l.kmIgjen)} igjen` : `${formaterKm(-l.kmIgjen)} over`));
    }
    if (l.kanUtsette) {
      const knapp = document.createElement("button");
      knapp.type = "button";
      knapp.className = "knapp sekundaer utsett";
      knapp.textContent = l.utsettTekst;
      knapp.addEventListener("click", () => utsett(bil, l.id, kmNaa));
      li.append(knapp);
    }
    ul.append(li);
  }

  node.querySelector(".dekk-lenke").href = `/dekk?bil=${encodeURIComponent(bil.id)}`;
}

async function utsett(bil, punktId, kmNaa) {
  if (punktId === "bremseklosser" && kmNaa == null) {
    return alert("Legg inn kilometerstanden på bilen først, så vi vet når vi skal minne deg på igjen.");
  }
  const rad = utsettelseFor(punktId, { kmNaa, idag: new Date().toISOString().slice(0, 10) });
  if (!rad) return;
  const { error } = await supabase.from("utsettelser").insert({ ...rad, bil_id: bil.id });
  if (error) return alert("Kunne ikke utsette. Prøv igjen.");
  lastBiler();
}

async function visKjoretoydata(skilt, mal) {
  try {
    const res = await fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(skilt)}`);
    const svar = await res.json();
    if (!res.ok) throw new Error(svar.feil);
    const seksjoner = kjoretoyDetaljer(svar);
    if (!seksjoner.length) throw new Error("Ingen data fra Statens vegvesen for denne bilen.");

    mal.replaceChildren(...seksjoner.map((s) => {
      const blokk = document.createElement("section");
      blokk.className = "datablokk";
      const h = document.createElement("h3");
      h.textContent = s.tittel;
      const dl = document.createElement("dl");
      for (const [navn, verdi] of s.rader) {
        const rad = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = navn;
        const dd = document.createElement("dd");
        dd.textContent = verdi;
        rad.append(dt, dd);
        dl.append(rad);
      }
      blokk.append(h, dl);
      return blokk;
    }));
    const kilde = document.createElement("p");
    kilde.className = "liten";
    kilde.textContent = "Kilde: Statens vegvesen. Sjekk alltid vognkortet ved tvil.";
    mal.append(kilde);
  } catch (feil) {
    const p = document.createElement("p");
    p.className = "melding feil";
    p.textContent = feil.message || "Kunne ikke hente kjøretøydata. Prøv igjen senere.";
    mal.replaceChildren(p);
    mal.closest("details").dataset.hentet = ""; // prøv igjen neste gang
  }
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
    h.dokumenter?.length ? `📎 ${h.dokumenter.length} vedlegg` : null,
  ].filter(Boolean).join(" · ");
  tekst.append(tittel, detaljer);

  const slett = document.createElement("button");
  slett.className = "ikon-knapp";
  slett.type = "button";
  slett.setAttribute("aria-label", "Slett");
  slett.textContent = "✕";
  slett.addEventListener("click", async () => {
    if (!confirm(h.dokumenter?.length ? "Slette denne registreringen og vedleggene?" : "Slette denne registreringen?")) return;
    await slettFilerForVedlikehold(supabase, [h.id]);
    const { error } = await supabase.from("vedlikehold").delete().eq("id", h.id);
    if (error) return alert("Kunne ikke slette. Prøv igjen.");
    lastBiler();
  });

  li.append(tekst, punktRad(h), slett);
  return li;
}

// Deler på besøket: fargede merker (kan fjernes med ×), og en liste som åpnes under knappen.
function punktRad(h) {
  const wrap = document.createElement("div");
  wrap.className = "punkt-rad";
  const merker = document.createElement("div");
  merker.className = "punkt-valg";
  wrap.append(merker);
  tegnMerker(h, merker);

  const gjettet = h.servicepunkter?.length ? [] : gjettServicepunkter(h.komponent, h.notat);
  if (gjettet.length) {
    const knapp = document.createElement("button");
    knapp.type = "button";
    knapp.className = "knapp sekundaer bekreft";
    knapp.textContent = `Bekreft: ${gjettet.map(navnPå).join(", ")}`;
    knapp.addEventListener("click", () => bekreftGjettet(h, gjettet));
    wrap.append(knapp);
  }
  wrap.append(velgerMeny(h, merker));
  return wrap;
}

function navnPå(id) {
  return alleServicepunkter().find((p) => p.id === id)?.navn ?? id;
}

function tegnMerker(h, merker) {
  const deler = h.servicepunkter ?? [];
  if (!deler.length) {
    const tom = document.createElement("span");
    tom.className = "punkt-tom";
    tom.textContent = "Ingen deler valgt";
    merker.replaceChildren(tom);
    return;
  }
  merker.replaceChildren(...deler.map((id) => punktMerke(id, h, merker)));
}

function punktMerke(id, h, merker) {
  const stil = stilFor(id);
  const el = document.createElement("span");
  el.className = `punkt-chip gruppe-${stil.gruppe}`;
  el.textContent = `${stil.ikon} ${navnPå(id)}`;
  const fjern = document.createElement("button");
  fjern.type = "button";
  fjern.className = "punkt-fjern";
  fjern.setAttribute("aria-label", `Fjern ${navnPå(id)}`);
  fjern.textContent = "×";
  fjern.addEventListener("click", () => endreDeler(h, (h.servicepunkter ?? []).filter((d) => d !== id), merker));
  el.append(fjern);
  return el;
}

// Listen åpnes under knappen (full bredde, større knapper for mobil).
// Hver avkryssing lagres med én gang, uten å tegne historikken på nytt.
function velgerMeny(h, merker) {
  const dd = document.createElement("div");
  dd.className = "punkt-dropdown";
  const knapp = document.createElement("button");
  knapp.type = "button";
  knapp.className = "punkt-knapp";
  knapp.setAttribute("aria-expanded", "false");
  knapp.textContent = "+ Legg til del";
  const panel = document.createElement("div");
  panel.className = "punkt-panel";
  panel.hidden = true;

  const avkryss = new Map();
  for (const p of alleServicepunkter()) {
    const stil = stilFor(p.id);
    const lab = document.createElement("label");
    lab.className = `punkt-option gruppe-${stil.gruppe}`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = p.id;
    cb.addEventListener("change", () => {
      const gjeldende = h.servicepunkter ?? [];
      const deler = cb.checked
        ? utvidDeler([...gjeldende, p.id])
        : gjeldende.filter((d) => d !== p.id);
      endreDeler(h, deler, merker, synkroniser);
    });
    avkryss.set(p.id, cb);
    lab.append(cb, document.createTextNode(` ${stil.ikon} ${p.navn}`));
    panel.append(lab);
  }
  const synkroniser = () => {
    for (const [id, cb] of avkryss) cb.checked = (h.servicepunkter ?? []).includes(id);
  };
  synkroniser();

  knapp.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    knapp.setAttribute("aria-expanded", String(!panel.hidden));
  });
  dd.append(knapp, panel);
  return dd;
}

async function bekreftGjettet(h, deler) {
  const { error } = await supabase.from("vedlikehold").update({ servicepunkter: utvidDeler(deler) }).eq("id", h.id);
  if (error) return alert("Kunne ikke lagre. Prøv igjen.");
  lastBiler();
}

// Lagrer nye deler og oppdaterer merkene der, uten å tegne historikken på nytt.
async function endreDeler(h, deler, merker, etterpaa) {
  const { error } = await supabase.from("vedlikehold").update({ servicepunkter: deler }).eq("id", h.id);
  if (error) return alert("Kunne ikke lagre. Prøv igjen.");
  h.servicepunkter = deler;
  if (merker) tegnMerker(h, merker);
  etterpaa?.();
}

// ---------------------------------------------------------------------------
// Skiltoppslag hos Statens vegvesen (via vår proxy)
// ---------------------------------------------------------------------------

/** Slår opp et skilt og returnerer bilen. Kaster feil med norsk tekst. */
async function slaOppBil(skilt) {
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

const bilNavn = (k) => [k.merke, k.modell].filter(Boolean).join(" ") || "bilen";

/** Lagrer en oppslått bil på innlogget bruker. */
async function lagreBil(skilt, k) {
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
}

/**
 * Første innlogging: bilen fra registreringen ligger på brukeren (forste_bil).
 * Legg den inn i databasen og fjern merket, så det bare skjer én gang.
 */
async function leggInnForsteBil(bruker) {
  const skilt = normaliserSkilt(bruker?.user_metadata?.forste_bil);
  if (!skilt) return;
  try {
    await lagreBil(skilt, await slaOppBil(skilt));
  } catch (feil) {
    // Finnes den allerede er alt i orden; andre feil vises, men stopper ikke siden
    if (!/allerede/.test(feil.message)) melding($("ny-bil-melding"), `Kunne ikke legge inn ${skilt}: ${feil.message}`, "feil");
  }
  await supabase.auth.updateUser({ data: { forste_bil: null } });
}

// Legg til flere biler fra Min side
$("ny-bil-skjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const m = $("ny-bil-melding");
  const skilt = normaliserSkilt($("nytt-skilt").value);
  if (!skilt) return melding(m, "Skriv et gyldig skiltnummer, f.eks. AB 12345.", "feil");

  e.submitter.disabled = true;
  melding(m, "Henter bilen …");
  try {
    const k = await slaOppBil(skilt);
    await lagreBil(skilt, k);
    $("nytt-skilt").value = "";
    melding(m, `${bilNavn(k)} er lagt til.`, "ok");
    lastBiler();
  } catch (feil) {
    melding(m, feil.message, "feil");
  } finally {
    e.submitter.disabled = false;
  }
});

// «Tilbake»: gå til forrige side på Mekkoo hvis brukeren kom derfra, ellers til forsiden
$("tilbake").addEventListener("click", (e) => {
  let fraOss = false;
  try {
    const forrige = new URL(document.referrer);
    fraOss = forrige.origin === location.origin && !forrige.pathname.startsWith("/min-side");
  } catch { /* ingen forrige side */ }
  if (fraOss && history.length > 1) {
    e.preventDefault();
    history.back();
  }
});

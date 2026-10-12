// «Dekk»: dekksettene til én bil (?bil=<id>), hva som står på nå og når det bør byttes.
// Reglene ligger i dekk.js (ren og testet). Her tegnes siden og lagres endringer.
import { formaterDato } from "./bilstatus.js";
import { normaliserStatus } from "./dashboard.js";
import { $, el, lastBil } from "./dashboard-side.js";
import {
  REGIONER, dekkPaBilen, dekkskift, settNavn, settType, typeFraValg, valgFraType, vurderSett,
} from "./dekk.js";

let bil;
let supabase;

/** Dagens dato i norsk tid som YYYY-MM-DD. */
function iDag() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function melding(tekst, type = "") {
  $("melding").textContent = tekst;
  $("melding").className = `melding ${type}`;
}

function flis({ etikett, verdi, under, status }) {
  const d = el("article", `flis ${status}`);
  d.append(el("p", "flis-etikett", etikett), el("p", "flis-verdi", verdi));
  if (under) d.append(el("p", "flis-under", under));
  return d;
}

function tegnFliser(paa) {
  const tilstand = paa ? vurderSett(paa, iDag()) : null;
  const skift = dekkskift({ type: paa?.type ?? null, pigg: paa?.pigg, region: bil.dekk_region ?? "sor", idag: iDag() });

  const paaFlis = paa
    ? flis({
      etikett: "På bilen nå",
      verdi: settType(paa),
      under: tilstand.tekst || [paa.dimensjon, paa.montert && `Montert ${formaterDato(paa.montert)}`].filter(Boolean).join(" · ")
        || "Mønster og alder ser bra ut",
      status: normaliserStatus(tilstand.status),
    })
    : flis({ etikett: "På bilen nå", verdi: "Ikke valgt", under: "Legg til dekksett og kryss av for det som står på", status: "ukjent" });

  const skiftFlis = flis({
    etikett: "Neste dekkskift",
    verdi: skift.bytteTil === "vinter" ? "Vinterdekk" : skift.bytteTil === "sommer" ? "Sommerdekk" : "Ukjent",
    under: skift.tekst,
    status: skift.status,
  });

  $("fliser").replaceChildren(skiftFlis, paaFlis);
}

function rad(navn, verdi) {
  const d = el("div");
  d.append(el("dt", null, navn), el("dd", null, verdi));
  return d;
}

function tegnSett(sett) {
  const vurdering = vurderSett(sett, iDag());
  const li = el("li", `sett-kort ${normaliserStatus(vurdering.status)}${sett.pa_bilen ? " pa-bilen" : ""}`);
  const hode = el("div", "sett-hode");
  hode.append(el("h3", null, settType(sett)), el("span", "merke", sett.pa_bilen ? "På bilen" : "Lagret"));
  li.append(hode);

  const dl = el("dl", "sett-fakta");
  if (sett.dimensjon) dl.append(rad("Dimensjon", sett.dimensjon));
  if (sett.produksjonsaar) {
    const alder = Number(iDag().slice(0, 4)) - sett.produksjonsaar;
    dl.append(rad("Produksjonsår", `${sett.produksjonsaar} (${alder} år)`));
  }
  if (sett.monsterdybde_mm != null) {
    dl.append(rad("Mønsterdybde", `${String(sett.monsterdybde_mm).replace(".", ",")} mm${sett.maalt ? ` (målt ${formaterDato(sett.maalt)})` : ""}`));
  }
  if (sett.pa_bilen && sett.montert) dl.append(rad("Montert", formaterDato(sett.montert)));
  if (!sett.pa_bilen && sett.lagring) dl.append(rad("Lagret", sett.lagring));
  if (dl.children.length) li.append(dl);
  if (vurdering.tekst) li.append(el("p", "sett-status", vurdering.tekst));
  if (sett.notat) li.append(el("p", "sett-notat", sett.notat));

  const knapper = el("div", "sett-knapper");
  const endre = el("button", "knapp sekundaer", "Endre");
  endre.type = "button";
  endre.addEventListener("click", () => visSettSkjema(sett));
  const slett = el("button", "knapp sekundaer", "Slett");
  slett.type = "button";
  slett.addEventListener("click", () => slettSett(sett));
  knapper.append(endre, slett);
  li.append(knapper);
  return li;
}

function tegn() {
  const sett = bil.dekksett ?? [];
  const paa = dekkPaBilen(sett);
  tegnFliser(paa);
  $("ingen-sett").hidden = sett.length > 0;
  // På bilen først, så sommer før vinter
  const sortert = [...sett].sort((a, b) => Number(b.pa_bilen) - Number(a.pa_bilen) || a.type.localeCompare(b.type));
  $("sett-liste").replaceChildren(...sortert.map(tegnSett));
  $("vis-bytte").hidden = !sett.some((s) => !s.pa_bilen);
}

// ---------------------------------------------------------------------------
// Skjemaer
// ---------------------------------------------------------------------------

function skjulSkjemaer() {
  $("bytte-skjema").hidden = true;
  $("sett-skjema").hidden = true;
}

function visBytteSkjema() {
  skjulSkjemaer();
  const f = $("bytte-skjema");
  const paa = dekkPaBilen(bil.dekksett);
  const kandidater = bil.dekksett.filter((s) => !s.pa_bilen);
  // Foreslå motsatt type av det som står på
  const forslag = kandidater.find((s) => s.type !== paa?.type) ?? kandidater[0];
  f.sett.replaceChildren(...kandidater.map((s) => {
    const o = new Option(settNavn(s), s.id);
    o.selected = s === forslag;
    return o;
  }));
  f.dato.value = iDag();
  f.km.value = bil.kilometerstand ?? "";
  f.av_mm.value = "";
  f.kostnad.value = "";
  f.utfort_av.value = "";
  $("av-mm-felt").hidden = !paa;
  f.hidden = false;
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

let redigerer = null;

function visSettSkjema(sett = null) {
  skjulSkjemaer();
  redigerer = sett;
  const f = $("sett-skjema");
  $("sett-tittel").textContent = sett ? "Endre dekksett" : "Legg til dekksett";
  const harPaa = dekkPaBilen(bil.dekksett);
  // Nytt sett: foreslå typen som mangler
  const forslag = !sett && bil.dekksett.some((s) => s.type === "sommer") ? "vinter" : "sommer";
  f.valg.value = sett ? valgFraType(sett) : forslag;
  f.dimensjon.value = sett?.dimensjon ?? harPaa?.dimensjon ?? "";
  f.produksjonsaar.value = sett?.produksjonsaar ?? "";
  f.monsterdybde_mm.value = sett?.monsterdybde_mm ?? "";
  f.maalt.value = sett?.maalt ?? "";
  f.lagring.value = sett?.lagring ?? "";
  f.pa_bilen.checked = sett ? sett.pa_bilen : !harPaa;
  f.notat.value = sett?.notat ?? "";
  f.hidden = false;
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}

const tallEllerNull = (v) => (v === "" ? null : Number(v));

/** Tar av dekksettet som står på nå (hvis det ikke er `unntak`). Kun ett sett kan stå på. */
async function taAvNaavaerende(unntak, ekstra = {}) {
  const paa = dekkPaBilen(bil.dekksett);
  if (!paa || paa.id === unntak) return null;
  return (await supabase.from("dekksett").update({ pa_bilen: false, ...ekstra }).eq("id", paa.id)).error;
}

async function lagreSett(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const knapp = f.querySelector("button[type=submit]");
  const mm = tallEllerNull(f.monsterdybde_mm.value);
  const endring = {
    ...typeFraValg(f.valg.value),
    dimensjon: f.dimensjon.value.trim() || null,
    produksjonsaar: tallEllerNull(f.produksjonsaar.value),
    monsterdybde_mm: mm,
    // Ny mønsterdybde uten dato: målt i dag
    maalt: f.maalt.value || (mm != null && mm !== Number(redigerer?.monsterdybde_mm ?? NaN) ? iDag() : null),
    lagring: f.lagring.value.trim() || null,
    pa_bilen: f.pa_bilen.checked,
    notat: f.notat.value.trim() || null,
  };

  knapp.disabled = true;
  try {
    if (endring.pa_bilen) {
      const feil = await taAvNaavaerende(redigerer?.id);
      if (feil) throw feil;
    }
    const { error } = redigerer
      ? await supabase.from("dekksett").update(endring).eq("id", redigerer.id)
      : await supabase.from("dekksett").insert({ ...endring, bil_id: bil.id });
    if (error) throw error;
    location.reload();
  } catch (err) {
    console.error("Dekksett: kunne ikke lagre", err);
    melding("Kunne ikke lagre dekksettet. Prøv igjen.", "feil");
    knapp.disabled = false;
  }
}

async function slettSett(sett) {
  if (!confirm(`Slette ${settNavn(sett).toLowerCase()}?`)) return;
  const { error } = await supabase.from("dekksett").delete().eq("id", sett.id);
  if (error) return melding("Kunne ikke slette dekksettet. Prøv igjen.", "feil");
  location.reload();
}

async function lagreBytte(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const knapp = f.querySelector("button[type=submit]");
  const ny = bil.dekksett.find((s) => s.id === f.sett.value);
  if (!ny) return;
  const dato = f.dato.value;
  const km = tallEllerNull(f.km.value);
  const avMm = tallEllerNull(f.av_mm.value);

  knapp.disabled = true;
  try {
    // 1. Ta av de gamle (og lagre mønsterdybden hvis den ble målt)
    const feil = await taAvNaavaerende(ny.id, avMm != null ? { monsterdybde_mm: avMm, maalt: dato } : {});
    if (feil) throw feil;
    // 2. Sett på de nye
    const { error: feil2 } = await supabase.from("dekksett").update({ pa_bilen: true, montert: dato }).eq("id", ny.id);
    if (feil2) throw feil2;
    // 3. I vedlikeholdshistorikken (og biløkonomien)
    const { error: feil3 } = await supabase.from("vedlikehold").insert({
      bil_id: bil.id,
      komponent: "dekk",
      dato,
      kilometerstand: km,
      kostnad: tallEllerNull(f.kostnad.value),
      utfort_av: f.utfort_av.value.trim() || null,
      notat: `Dekkskift: ${settNavn(ny).toLowerCase()} på`,
    });
    if (feil3) throw feil3;
    // 4. Nyere kilometerstand på bilen
    if (km != null && km > (bil.kilometerstand ?? -1)) {
      await supabase.from("biler").update({ kilometerstand: km, kilometerstand_dato: dato }).eq("id", bil.id);
    }
    location.reload();
  } catch (err) {
    console.error("Dekkskift: kunne ikke lagre", err);
    melding("Kunne ikke lagre dekkskiftet. Prøv igjen.", "feil");
    knapp.disabled = false;
  }
}

async function lagreRegion() {
  const region = $("region").value;
  const { error } = await supabase.from("biler").update({ dekk_region: region }).eq("id", bil.id);
  if (error) {
    console.error("Dekk: kunne ikke lagre region", error);
    return melding("Kunne ikke lagre hvor du kjører. Prøv igjen.", "feil");
  }
  bil.dekk_region = region;
  tegn();
  melding("Lagret.", "ok");
}

// ---------------------------------------------------------------------------

async function start() {
  const res = await lastBil();
  if (!res?.bil) return;
  ({ bil, supabase } = res);
  document.title = `Mekkoo – dekk ${bil.kjennemerke}`;
  if (!res.dekksettOk) {
    $("mangler-tabell").hidden = false;
    return;
  }

  for (const [verdi, navn] of Object.entries(REGIONER)) $("region").append(new Option(navn, verdi));
  $("region").value = bil.dekk_region ?? "sor";
  $("region").addEventListener("change", lagreRegion);

  $("vis-bytte").addEventListener("click", visBytteSkjema);
  $("vis-nytt-sett").addEventListener("click", () => visSettSkjema());
  for (const k of document.querySelectorAll(".avbryt")) k.addEventListener("click", skjulSkjemaer);
  $("sett-skjema").addEventListener("submit", lagreSett);
  $("bytte-skjema").addEventListener("submit", lagreBytte);

  tegn();
  $("innhold").hidden = false;
}

start();

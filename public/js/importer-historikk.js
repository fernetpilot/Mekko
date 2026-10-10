// Importer servicehistorikk: regneark (Excel/CSV) og dokumenter samtidig.
// Alt vises som redigerbare forslag; ingenting lagres før brukeren trykker «Importer».
import { supabase } from "./supabase.js";
import { KOMPONENT_NAVN, formaterDato } from "./bilstatus.js";
import { FELTER, finnKobling, raderTilForslag, erDublett } from "./import-historikk.js";
import { lastOppDokumenter, erPdf, MAKS_BYTES } from "./dokumenter.js";

const $ = (id) => document.getElementById(id);
const lag = (tag, egenskaper = {}, ...barn) => {
  const el = Object.assign(document.createElement(tag), egenskaper);
  el.append(...barn.filter((b) => b != null));
  return el;
};

let brukerId = null;
let biler = [];
let eksisterende = []; // hendelser som allerede finnes på valgt bil (for dubletter)
let ark = [];          // { id, navn, rader, overskriftRad, kobling }
let forslag = [];      // { id, arkId?, med, dato, komponent, kilometerstand, kostnad, utfort_av, notat, filer: File[] }
let nesteId = 1;

const erRegneark = (f) => /\.(xlsx|xls|csv)$/i.test(f.name) || /spreadsheet|excel|csv/.test(f.type);

function melding(el, tekst, type = "") {
  el.textContent = tekst;
  el.className = `melding ${type}`;
}

// ---------------------------------------------------------------------------
// Oppstart
// ---------------------------------------------------------------------------
async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  brukerId = session.user.id;

  const { data, error } = await supabase.from("biler")
    .select("id, kjennemerke, kallenavn, merke, modell, kilometerstand").order("opprettet");
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
    $("bil-valg").append(lag("option", {
      value: bil.id,
      textContent: `${bil.kjennemerke} – ${bil.kallenavn || [bil.merke, bil.modell].filter(Boolean).join(" ")}`,
    }));
  }
  const forvalgt = new URLSearchParams(location.search).get("bil");
  if (biler.some((b) => b.id === forvalgt)) $("bil-valg").value = forvalgt;
  $("innhold").hidden = false;
  await hentEksisterende();
}

async function hentEksisterende() {
  const { data } = await supabase.from("vedlikehold")
    .select("dato, komponent, kilometerstand").eq("bil_id", $("bil-valg").value);
  eksisterende = data ?? [];
  tegnForslag();
}
$("bil-valg").addEventListener("change", hentEksisterende);

// ---------------------------------------------------------------------------
// Filer inn
// ---------------------------------------------------------------------------
let XLSX = null;
async function lesRegneark(fil) {
  XLSX ??= await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
  // CSV leses som tekst (UTF-8) og med rå verdier, så norske datoer ikke tolkes som amerikanske
  const bok = /\.csv$/i.test(fil.name) || fil.type === "text/csv"
    ? XLSX.read(await fil.text(), { type: "string", raw: true })
    : XLSX.read(await fil.arrayBuffer(), { cellDates: true });
  // Første arkfane med innhold
  for (const navn of bok.SheetNames) {
    const rader = XLSX.utils.sheet_to_json(bok.Sheets[navn], { header: 1, raw: true, defval: "" });
    if (rader.some((r) => r.some((c) => String(c).trim() !== ""))) return rader;
  }
  return [];
}

async function taImotFiler(filer) {
  const m = $("fil-melding");
  const feil = [];
  let antallDok = 0;
  for (const fil of filer) {
    if (erRegneark(fil)) {
      try {
        melding(m, `Leser ${fil.name} …`);
        const rader = await lesRegneark(fil);
        if (!rader.length) throw new Error();
        const nytt = { id: nesteId++, navn: fil.name, rader, ...finnKobling(rader) };
        ark.push(nytt);
        lagForslagFraArk(nytt);
      } catch {
        feil.push(`${fil.name}: kunne ikke lese regnearket.`);
      }
    } else if (erPdf(fil) || fil.type.startsWith("image/") || /\.(heic|heif)$/i.test(fil.name)) {
      if (erPdf(fil) && fil.size > MAKS_BYTES) { feil.push(`${fil.name} er større enn 10 MB.`); continue; }
      forslag.unshift(nyttForslag({ filer: [fil] }));
      antallDok++;
    } else {
      feil.push(`${fil.name}: bare regneark, PDF og bilder kan importeres.`);
    }
  }
  melding(m, feil.join(" "), feil.length ? "feil" : "");
  tegnArk();
  tegnForslag();
  if (antallDok) document.querySelector(".forslag")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function nyttForslag(felter = {}) {
  return { id: nesteId++, med: true, dato: null, komponent: "service", kilometerstand: null, kostnad: null, utfort_av: null, notat: null, filer: [], ...felter };
}

function lagForslagFraArk(a) {
  // Dokumenter som var lagt på rader fra dette arket beholdes som egne forslag
  const gamle = forslag.filter((f) => f.arkId === a.id);
  const lose = gamle.flatMap((f) => f.filer.map((fil) => nyttForslag({ filer: [fil] })));
  forslag = forslag.filter((f) => f.arkId !== a.id);
  const nye = raderTilForslag(a.rader, a).map((f) => nyttForslag({ ...f, arkId: a.id }));
  nye.sort((x, y) => (y.dato ?? "").localeCompare(x.dato ?? ""));
  forslag.push(...lose, ...nye);
}

$("filer").addEventListener("change", (e) => {
  taImotFiler([...e.target.files]);
  e.target.value = "";
});

// Dra og slipp (PC)
const sone = $("slippsone");
for (const t of ["dragenter", "dragover"]) sone.addEventListener(t, (e) => { e.preventDefault(); sone.classList.add("aktiv"); });
for (const t of ["dragleave", "drop"]) sone.addEventListener(t, (e) => { e.preventDefault(); sone.classList.remove("aktiv"); });
sone.addEventListener("drop", (e) => taImotFiler([...e.dataTransfer.files]));

// ---------------------------------------------------------------------------
// Kolonnekobling per regneark
// ---------------------------------------------------------------------------
function tegnArk() {
  $("regneark").replaceChildren(...ark.map((a) => {
    const overskrifter = a.rader[a.overskriftRad] ?? [];
    const antall = forslag.filter((f) => f.arkId === a.id).length;
    const rader = overskrifter.map((o, i) => {
      const valg = lag("select", { ariaLabel: `Felt for kolonnen ${o || i + 1}` },
        lag("option", { value: "", textContent: "Ikke bruk" }),
        ...Object.entries(FELTER).map(([felt, navn]) => lag("option", { value: felt, textContent: navn })));
      valg.value = a.kobling[i] ?? "";
      valg.addEventListener("change", () => {
        // Hvert felt kan bare brukes av én kolonne
        a.kobling = a.kobling.map((f, j) => (j !== i && f === valg.value ? null : f));
        a.kobling[i] = valg.value || null;
        lagForslagFraArk(a);
        tegnArk();
        tegnForslag();
      });
      return lag("div", { className: "kobling-rad" }, lag("span", { className: "kolonne", textContent: String(o || `Kolonne ${i + 1}`) }), valg);
    });
    const fjern = lag("button", { type: "button", className: "ikon-knapp", ariaLabel: `Fjern ${a.navn}`, textContent: "✕" });
    fjern.addEventListener("click", () => {
      ark = ark.filter((x) => x !== a);
      const lose = forslag.filter((f) => f.arkId === a.id).flatMap((f) => f.filer.map((fil) => nyttForslag({ filer: [fil] })));
      forslag = [...lose, ...forslag.filter((f) => f.arkId !== a.id)];
      tegnArk();
      tegnForslag();
    });
    return lag("details", { className: "kort ark", open: !a.kobling.includes("dato") },
      lag("summary", {}, lag("span", { textContent: `📊 ${a.navn} · ${antall} rader` }), fjern),
      lag("p", { className: "liten", textContent: a.kobling.includes("dato")
        ? "Kolonnene er koblet automatisk. Rett opp her hvis noe er feil."
        : "Fant ingen datokolonne. Velg hvilken kolonne som inneholder dato." }),
      ...rader);
  }));
}

// ---------------------------------------------------------------------------
// Forslagene
// ---------------------------------------------------------------------------
function etikett(f) {
  return [f.dato ? formaterDato(f.dato) : "Uten dato", KOMPONENT_NAVN[f.komponent]].join(" · ");
}

function tegnForslag() {
  const ol = $("forslag-liste");
  $("forslag-seksjon").hidden = !forslag.length;
  $("importer-bar").hidden = !forslag.length;
  const urler = []; // forhåndsvisninger ryddes ved neste tegning
  for (const u of tegnForslag.urler ?? []) URL.revokeObjectURL(u);
  tegnForslag.urler = urler;

  ol.replaceChildren(...forslag.map((f) => {
    const dublett = erDublett(f, eksisterende);
    const li = lag("li", { className: `kort forslag${f.med ? "" : " av"}${f.med && !f.dato ? " mangler" : ""}` });

    const med = lag("input", { type: "checkbox", checked: f.med });
    med.addEventListener("change", () => { f.med = med.checked; tegnForslag(); });
    const kilde = f.arkId ? "📊 Fra regneark" : "📎 Fra dokument";
    li.append(lag("div", { className: "forslag-topp" },
      lag("label", { className: "ta-med" }, med, lag("span", { textContent: "Ta med" })),
      lag("span", { className: "liten", textContent: kilde }),
      dublett ? lag("span", { className: "merke-dublett", textContent: "Finnes kanskje allerede" }) : null));

    // Felt
    const felt = (navn, el) => { el.name = navn; return lag("label", {}, FELTER[navn], el); };
    const dato = lag("input", { type: "date", value: f.dato ?? "", required: f.med });
    const type = lag("select", {}, ...Object.entries(KOMPONENT_NAVN).map(([k, n]) => lag("option", { value: k, textContent: n })));
    type.value = f.komponent;
    const km = lag("input", { type: "number", min: 0, inputMode: "numeric", value: f.kilometerstand ?? "" });
    const kost = lag("input", { type: "number", min: 0, step: "any", inputMode: "decimal", value: f.kostnad ?? "" });
    const av = lag("input", { maxLength: 100, value: f.utfort_av ?? "" });
    const notat = lag("textarea", { maxLength: 1000, rows: 2, value: f.notat ?? "" });

    const tall = (v) => (v === "" ? null : Number(v));
    dato.addEventListener("change", () => { f.dato = dato.value || null; tegnForslag(); });
    type.addEventListener("change", () => { f.komponent = type.value; });
    km.addEventListener("input", () => { f.kilometerstand = tall(km.value); });
    kost.addEventListener("input", () => { f.kostnad = tall(kost.value); });
    av.addEventListener("input", () => { f.utfort_av = av.value.trim() || null; });
    notat.addEventListener("input", () => { f.notat = notat.value.trim() || null; });

    const skjemafelt = [
      lag("div", { className: "to-kolonner" }, felt("dato", dato), felt("komponent", type)),
      lag("div", { className: "to-kolonner" }, felt("kilometerstand", km), felt("kostnad", kost)),
      felt("utfort_av", av),
      felt("notat", notat),
    ];

    // Dokumenter på forslaget
    if (f.filer.length) {
      const liste = lag("ul", { className: "forslag-filer" });
      for (const fil of f.filer) {
        const url = URL.createObjectURL(fil);
        urler.push(url);
        const vis = fil.type.startsWith("image/")
          ? lag("img", { src: url, alt: fil.name, loading: "lazy" })
          : lag("span", { className: "pdf-ikon", textContent: "PDF" });
        const flytt = lag("select", { ariaLabel: `Flytt ${fil.name}` },
          lag("option", { value: "", textContent: "Flytt til …" }),
          lag("option", { value: "ny", textContent: "Egen ny hendelse" }),
          ...forslag.filter((x) => x !== f).map((x) => lag("option", { value: x.id, textContent: etikett(x) })));
        flytt.addEventListener("change", () => {
          if (!flytt.value) return;
          f.filer = f.filer.filter((x) => x !== fil);
          const mal = flytt.value === "ny" ? nyttForslag() : forslag.find((x) => String(x.id) === flytt.value);
          mal.filer.push(fil);
          if (flytt.value === "ny") forslag.splice(forslag.indexOf(f) + 1, 0, mal);
          // Et dokumentforslag uten dokumenter og uten innhold fjernes
          if (!f.arkId && !f.filer.length && !f.dato && !f.notat && f.kostnad == null && f.kilometerstand == null) {
            forslag = forslag.filter((x) => x !== f);
          }
          tegnForslag();
        });
        const fjern = lag("button", { type: "button", className: "ikon-knapp", ariaLabel: `Fjern ${fil.name}`, textContent: "✕" });
        fjern.addEventListener("click", () => {
          f.filer = f.filer.filter((x) => x !== fil);
          if (!f.arkId && !f.filer.length && !f.dato) forslag = forslag.filter((x) => x !== f);
          tegnForslag();
        });
        liste.append(lag("li", {},
          lag("a", { href: url, target: "_blank", rel: "noopener", className: "forhandsvisning", title: "Åpne" }, vis),
          lag("div", { className: "fil-info" }, lag("span", { className: "navn", textContent: fil.name }), flytt),
          fjern));
      }
      // Fra dokument: vis dokumentet først, så brukeren kan lese av det mens feltene fylles ut
      if (f.arkId) li.append(...skjemafelt, liste);
      else li.append(liste, ...skjemafelt);
    } else {
      li.append(...skjemafelt);
    }
    return li;
  }));

  const valgte = forslag.filter((f) => f.med);
  const vedlegg = valgte.reduce((n, f) => n + f.filer.length, 0);
  $("antall-forslag").textContent = `(${valgte.length} av ${forslag.length} valgt)`;
  $("importer").textContent = `Importer ${valgte.length} ${valgte.length === 1 ? "hendelse" : "hendelser"}${vedlegg ? ` med ${vedlegg} vedlegg` : ""}`;
  $("importer").disabled = !valgte.length;
  const uten = valgte.filter((f) => !f.dato).length;
  melding($("melding"), uten ? `${uten} av de valgte mangler dato.` : "", uten ? "feil" : "");
}

$("velg-alle").addEventListener("click", () => {
  const alle = forslag.every((f) => f.med);
  forslag.forEach((f) => { f.med = !alle; });
  $("velg-alle").textContent = alle ? "Velg alle" : "Velg ingen";
  tegnForslag();
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
$("importer").addEventListener("click", async () => {
  const valgte = forslag.filter((f) => f.med);
  const m = $("melding");
  if (valgte.some((f) => !f.dato)) {
    document.querySelector(".forslag.mangler")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return melding(m, "Fyll inn dato på alle valgte hendelser, eller fjern haken på dem.", "feil");
  }

  const knapp = $("importer");
  knapp.disabled = true;
  const bilId = $("bil-valg").value;
  const feil = [];
  let ferdig = 0;

  for (const f of valgte) {
    melding(m, `Importerer ${ferdig + 1} av ${valgte.length} …`);
    const { data, error } = await supabase.from("vedlikehold").insert({
      bil_id: bilId,
      komponent: f.komponent,
      dato: f.dato,
      kilometerstand: f.kilometerstand == null ? null : Math.round(f.kilometerstand),
      kostnad: f.kostnad,
      utfort_av: f.utfort_av,
      notat: f.notat,
    }).select("id").single();
    if (error) { feil.push(`${etikett(f)}: kunne ikke lagres`); continue; }
    if (f.filer.length) {
      const r = await lastOppDokumenter(supabase, {
        eierId: brukerId, vedlikeholdId: data.id, filer: f.filer,
        framdrift: (t) => melding(m, `Hendelse ${ferdig + 1} av ${valgte.length}: ${t}`),
      });
      feil.push(...r.feil);
    }
    ferdig++;
    f.importert = true;
  }

  // Oppdater bilens kilometerstand hvis importen har en høyere
  const bil = biler.find((b) => b.id === bilId);
  const hoyest = valgte.filter((f) => f.importert && f.kilometerstand != null)
    .sort((a, b) => b.kilometerstand - a.kilometerstand)[0];
  if (hoyest && hoyest.kilometerstand > (bil?.kilometerstand ?? -1)) {
    await supabase.from("biler").update({ kilometerstand: Math.round(hoyest.kilometerstand), kilometerstand_dato: hoyest.dato }).eq("id", bilId);
  }

  if (feil.length) {
    // Behold det som ikke ble importert, så brukeren kan prøve igjen
    forslag = forslag.filter((f) => !f.importert);
    tegnForslag();
    knapp.disabled = false;
    alert(`${ferdig} av ${valgte.length} hendelser er importert.\n\nNoe gikk galt:\n${feil.join("\n")}`);
    return;
  }
  melding(m, `${ferdig} hendelser er importert.`, "ok");
  location.assign(`/servicehefte?bil=${encodeURIComponent(bilId)}`);
});

// Advar før brukeren forlater siden med forslag som ikke er importert
addEventListener("beforeunload", (e) => {
  if (forslag.some((f) => f.med && !f.importert) && !$("importer").disabled) e.preventDefault();
});

start();

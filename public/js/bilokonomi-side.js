// Biløkonomi-siden: kjøpsopplysninger, nøkkeltall, diagrammer og verdianslag.
import { supabase } from "./supabase.js";
import { formaterDato, KOMPONENT_NAVN } from "./bilstatus.js";
import { oppsummer, estimerVerdi } from "./bilokonomi.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attr = {}) => {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v);
  return el;
};
const lag = (tag, egenskaper = {}, ...barn) => {
  const el = Object.assign(document.createElement(tag), egenskaper);
  el.append(...barn.filter((b) => b != null));
  return el;
};

const kr = (n) => `${Math.round(n).toLocaleString("nb-NO")} kr`;
const krKort = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} mill.`
  : Math.abs(n) >= 1000 ? `${Math.round(n / 1000).toLocaleString("nb-NO")}k` : String(Math.round(n)));
const farge = (k) => `var(--serie-${k})`;

let biler = [];
let bil = null;
let hendelser = [];

// ---------------------------------------------------------------------------
// Oppstart og data
// ---------------------------------------------------------------------------
async function start() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace(`/min-side?neste=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  const { data, error } = await supabase.from("biler")
    .select("id, kjennemerke, kallenavn, merke, modell, kilometerstand, forstegangsregistrert, kjopspris, kjopsdato, kjops_km")
    .order("opprettet");
  $("laster").hidden = true;
  if (error) {
    $("laster").hidden = false;
    $("laster").textContent = "Kunne ikke hente bilene dine. Last siden på nytt.";
    return;
  }
  biler = data;
  if (!biler.length) { $("ingen-biler").hidden = false; return; }

  for (const b of biler) {
    $("bil-valg").append(new Option(`${b.kjennemerke} – ${b.kallenavn || [b.merke, b.modell].filter(Boolean).join(" ")}`, b.id));
  }
  $("bilvalg-felt").hidden = biler.length < 2;
  const forvalgt = new URLSearchParams(location.search).get("bil");
  if (biler.some((b) => b.id === forvalgt)) $("bil-valg").value = forvalgt;
  $("innhold").hidden = false;
  await velgBil();
}

async function velgBil() {
  bil = biler.find((b) => b.id === $("bil-valg").value);
  history.replaceState(null, "", `?bil=${encodeURIComponent(bil.id)}`);
  const { data } = await supabase.from("vedlikehold")
    .select("dato, komponent, kostnad, kilometerstand").eq("bil_id", bil.id);
  hendelser = data ?? [];
  fyllKjopsskjema();
  tegnAlt();
}
$("bil-valg").addEventListener("change", velgBil);

// ---------------------------------------------------------------------------
// Kjøpsopplysninger
// ---------------------------------------------------------------------------
function fyllKjopsskjema() {
  const f = $("kjop-skjema");
  f.kjopspris.value = bil.kjopspris ?? "";
  f.kjopsdato.value = bil.kjopsdato ?? "";
  f.kjops_km.value = bil.kjops_km ?? "";
  const harKjop = bil.kjopspris && bil.kjopsdato;
  $("kjop").open = !harKjop;
  $("kjop-sammendrag").textContent = harKjop ? `${kr(bil.kjopspris)} · ${formaterDato(bil.kjopsdato)}` : "Ikke fylt ut";
}

$("kjop-skjema").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const tall = (v) => (v === "" ? null : Number(v));
  const endring = { kjopspris: tall(f.kjopspris.value), kjopsdato: f.kjopsdato.value || null, kjops_km: tall(f.kjops_km.value) };
  e.submitter.disabled = true;
  const { error } = await supabase.from("biler").update(endring).eq("id", bil.id);
  e.submitter.disabled = false;
  const m = $("kjop-melding");
  if (error) {
    m.textContent = "Kunne ikke lagre. Har dere kjørt supabase/06-bilokonomi.sql i Supabase?";
    m.className = "melding feil";
    return;
  }
  Object.assign(bil, endring);
  m.textContent = "";
  fyllKjopsskjema();
  tegnAlt();
});

// ---------------------------------------------------------------------------
// Tegning
// ---------------------------------------------------------------------------
function tegnAlt() {
  const idag = new Date();
  const o = oppsummer(hendelser, { kjopsdato: bil.kjopsdato, kjopsKm: bil.kjops_km, kmNaa: bil.kilometerstand, idag });
  const verdi = estimerVerdi({
    kjopspris: bil.kjopspris, kjopsdato: bil.kjopsdato, kjopsKm: bil.kjops_km,
    kmNaa: bil.kilometerstand, forstegangsregistrert: bil.forstegangsregistrert, hendelser, idag,
  });
  tegnNokkeltall(o, verdi);
  tegnKake(o);
  tegnStolper(o);
  tegnKurve(o, idag);
  tegnTabeller(o);

  const periode = bil.kjopsdato ? `siden kjøp ${formaterDato(bil.kjopsdato)}` : o.start ? `siden ${formaterDato(o.start)} (første registrerte kostnad)` : "";
  $("fordeling-undertittel").textContent = o.total ? `${kr(o.total)} ${periode}` : "";
  $("akkumulert-undertittel").textContent = bil.kjopsdato ? "" : "Legg inn kjøpsdato for å starte kurven ved kjøpet.";
  $("datakvalitet").textContent = o.antallUtenKostnad
    ? `${o.antallUtenKostnad} av ${o.antallUtenKostnad + o.antallMedKostnad} registrerte hendelser i perioden mangler kostnad og er ikke med i tallene.`
    : "";
}

function tall(navn, verdi, under, ekstraKlasse = "") {
  return lag("div", { className: `tall ${ekstraKlasse}` },
    lag("span", { className: "navn", textContent: navn }),
    lag("span", { className: "verdi", textContent: verdi }),
    under ? lag("span", { className: "under", textContent: under }) : null);
}

function tegnNokkeltall(o, verdi) {
  const fliser = [];

  // Forventet markedsverdi
  if (verdi) {
    const flis = tall("Forventet markedsverdi", `ca. ${kr(verdi.verdi)}`, `Intervall ${kr(verdi.lav)} – ${kr(verdi.hoy)}`, "hoved");
    const steg = lag("ul", { className: "verdisteg" },
      ...verdi.steg.map((s, i) => lag("li", {},
        lag("span", { textContent: s.tekst }),
        lag("span", { textContent: i === 0 ? kr(s.verdi) : `${s.verdi >= 0 ? "+" : "−"} ${kr(Math.abs(s.verdi))}` }))),
      lag("li", { className: "sum" }, lag("span", { textContent: "Anslag (avrundet)" }), lag("span", { textContent: kr(verdi.verdi) })));
    flis.append(lag("details", {}, lag("summary", { textContent: "Slik er det regnet" }), steg));
    fliser.push(flis);
  } else {
    fliser.push(tall("Forventet markedsverdi", "Legg inn kjøpspris og kjøpsdato", null, "hoved tom"));
  }

  fliser.push(tall(bil.kjopsdato ? "Brukt siden kjøp" : "Brukt totalt", kr(o.total), `${o.antallMedKostnad} poster`));
  fliser.push(o.snittPerAr != null
    ? tall("Per år", kr(o.snittPerAr), `snitt over ${o.ar.toFixed(1).replace(".", ",")} år`)
    : tall("Per år", "–", "trenger minst et halvt år", "tom"));
  fliser.push(o.perKm != null
    ? tall("Per kilometer", `${o.perKm.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`, `${o.kmKjort.toLocaleString("nb-NO")} km kjørt`)
    : tall("Per kilometer", "–", "trenger kilometerstand", "tom"));

  // Totalkostnad: verditap + vedlikehold
  if (verdi) {
    const verditap = bil.kjopspris - verdi.verdi;
    const totalt = verditap + o.total;
    fliser.push(tall("Totalkostnad inkl. verditap", kr(totalt),
      o.ar >= 0.5 ? `${kr(totalt / o.ar)} per år` : `verditap ${kr(verditap)}`));
    fliser.push(tall("Investert totalt", kr(Number(bil.kjopspris) + o.total), "kjøpspris + vedlikehold"));
  }
  $("nokkeltall").replaceChildren(...fliser);
}

// ---------- Verktøytips (hover på PC, trykk på mobil) ----------
const tips = $("tips");
function visTips(e, html) {
  tips.innerHTML = html;
  tips.hidden = false;
  const x = e.clientX ?? 0, y = e.clientY ?? 0;
  const b = tips.offsetWidth, h = tips.offsetHeight;
  tips.style.left = `${Math.min(innerWidth - b - 8, Math.max(8, x - b / 2))}px`;
  tips.style.top = `${Math.max(8, y - h - 14)}px`;
}
const skjulTips = () => { tips.hidden = true; };
addEventListener("scroll", skjulTips, { passive: true });
document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.(".treff")) skjulTips(); });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function medTips(el, html) {
  el.classList.add("treff");
  el.setAttribute("tabindex", "0");
  const vis = (e) => visTips(e, html);
  el.addEventListener("pointerenter", vis);
  el.addEventListener("pointermove", vis);
  el.addEventListener("pointerdown", vis);
  el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") skjulTips(); });
  el.addEventListener("focus", () => { const r = el.getBoundingClientRect(); visTips({ clientX: r.x + r.width / 2, clientY: r.y }, html); });
  el.addEventListener("blur", skjulTips);
}

function tomt(svgEl, tekst) {
  svgEl.replaceChildren();
  svgEl.setAttribute("aria-label", tekst);
  svgEl.style.display = "none";
  const forrige = svgEl.previousElementSibling;
  if (forrige?.classList.contains("tom-diagram")) forrige.textContent = tekst;
  else svgEl.before(lag("p", { className: "tom-diagram", textContent: tekst }));
}
function visSvg(svgEl) {
  svgEl.style.display = "";
  if (svgEl.previousElementSibling?.classList.contains("tom-diagram")) svgEl.previousElementSibling.remove();
}

// ---------- Kakediagram (smultring) ----------
function tegnKake(o) {
  const el = $("kake");
  const liste = $("tegnforklaring");
  if (!o.total) {
    liste.replaceChildren();
    $("kake").closest(".kake-oppsett").hidden = true;
    $("fordeling-kort").querySelector(".tom-diagram")?.remove();
    $("fordeling-kort").append(lag("p", { className: "tom-diagram", textContent: "Ingen kostnader registrert ennå. Legg inn kostnad når du registrerer vedlikehold." }));
    return;
  }
  $("fordeling-kort").querySelector(".tom-diagram")?.remove();
  $("kake").closest(".kake-oppsett").hidden = false;
  el.replaceChildren();
  el.setAttribute("aria-label", `Fordeling: ${o.kategorier.map((k) => `${k.navn} ${Math.round(k.andel * 100)} %`).join(", ")}`);

  const cx = 100, cy = 100, r = 80, tykkelse = 26;
  let vinkel = -Math.PI / 2;
  for (const k of o.kategorier) {
    const bue = k.andel * Math.PI * 2;
    let sti;
    if (o.kategorier.length === 1) {
      sti = svg("circle", { cx, cy, r: r - tykkelse / 2, fill: "none", "stroke-width": tykkelse, stroke: farge(k.nokkel) });
    } else {
      const ytre = r, indre = r - tykkelse;
      const p = (rad, v) => [cx + rad * Math.cos(v), cy + rad * Math.sin(v)];
      const [x1, y1] = p(ytre, vinkel), [x2, y2] = p(ytre, vinkel + bue);
      const [x3, y3] = p(indre, vinkel + bue), [x4, y4] = p(indre, vinkel);
      const stor = bue > Math.PI ? 1 : 0;
      sti = svg("path", {
        d: `M${x1},${y1} A${ytre},${ytre} 0 ${stor} 1 ${x2},${y2} L${x3},${y3} A${indre},${indre} 0 ${stor} 0 ${x4},${y4} Z`,
        fill: farge(k.nokkel), stroke: "#16171a", "stroke-width": 2, "stroke-linejoin": "round",
      });
    }
    medTips(sti, `<strong>${esc(k.navn)}</strong>${kr(k.sum)} · ${Math.round(k.andel * 100)} %`);
    el.append(sti);
    vinkel += bue;
  }
  const midt = svg("text", { x: cx, y: cy + 2, "text-anchor": "middle", "dominant-baseline": "middle", class: "kake-midt-tall" });
  midt.textContent = krKort(o.total);
  const under = svg("text", { x: cx, y: cy + 20, "text-anchor": "middle" });
  under.textContent = "kr totalt";
  el.append(midt, under);

  liste.replaceChildren(...o.kategorier.map((k) => lag("li", {},
    lag("span", { className: "prikk", style: `background:${farge(k.nokkel)}` }),
    lag("span", { textContent: k.navn }),
    lag("span", { className: "belop", textContent: `${kr(k.sum)} · ${Math.round(k.andel * 100)} %` }))));
}

// ---------- Felles akser ----------
function fineSteg(maks) {
  if (maks <= 0) return [0, 1];
  const grov = maks / 3;
  const potens = 10 ** Math.floor(Math.log10(grov));
  const steg = [1, 2, 2.5, 5, 10].map((m) => m * potens).find((s) => s >= grov);
  return Array.from({ length: Math.ceil(maks / steg) + 1 }, (_, i) => i * steg);
}

const PLOT = { v: 40, h: 8, t: 10, b: 24, B: 340, H: 200 };
function tegnYakse(el, ticks, y) {
  for (const t of ticks) {
    el.append(svg("line", { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: y(t), y2: y(t), stroke: "var(--rutenett)", "stroke-width": 1 }));
    const tekst = svg("text", { x: PLOT.v - 6, y: y(t) + 3, "text-anchor": "end" });
    tekst.textContent = krKort(t);
    el.append(tekst);
  }
}

// ---------- Stolper per år ----------
function tegnStolper(o) {
  const el = $("stolper");
  if (!o.perAr.length || !o.total) return tomt(el, "Ingen kostnader per år å vise ennå.");
  visSvg(el);
  el.replaceChildren();
  el.setAttribute("aria-label", `Kostnader per år: ${o.perAr.map((p) => `${p.ar}: ${kr(p.sum)}`).join(", ")}`);

  const ticks = fineSteg(Math.max(...o.perAr.map((p) => p.sum)));
  const ymaks = ticks[ticks.length - 1];
  const bunn = PLOT.H - PLOT.b, topp = PLOT.t;
  const y = (v) => bunn - (v / ymaks) * (bunn - topp);
  tegnYakse(el, ticks, y);

  const n = o.perAr.length;
  const bredde = (PLOT.B - PLOT.h - PLOT.v) / n;
  const stolpe = Math.min(28, bredde - 2); // minst 2 px mellomrom
  const visHvert = Math.ceil(n / 8); // ikke flere enn ~8 årstall under aksen
  o.perAr.forEach((p, i) => {
    const x = PLOT.v + i * bredde + (bredde - stolpe) / 2;
    if (p.sum > 0) {
      const h = bunn - y(p.sum);
      const r = Math.min(4, h, stolpe / 2);
      // Avrundet topp, rett bunn mot grunnlinjen
      el.append(svg("path", {
        d: `M${x},${bunn} V${y(p.sum) + r} Q${x},${y(p.sum)} ${x + r},${y(p.sum)} H${x + stolpe - r} Q${x + stolpe},${y(p.sum)} ${x + stolpe},${y(p.sum) + r} V${bunn} Z`,
        fill: "var(--serie-hoved)",
      }));
    }
    // Treffflate i hele kolonnens høyde, større enn stolpen
    const treff = svg("rect", { x: PLOT.v + i * bredde, y: topp, width: bredde, height: bunn - topp, fill: "transparent" });
    medTips(treff, `<strong>${p.ar}</strong>${kr(p.sum)}`);
    el.append(treff);
    if (i % visHvert === 0 || i === n - 1) {
      const t = svg("text", { x: x + stolpe / 2, y: bunn + 14, "text-anchor": "middle" });
      t.textContent = n > 8 ? `’${String(p.ar).slice(2)}` : String(p.ar);
      el.append(t);
    }
  });
  el.append(svg("line", { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: bunn, y2: bunn, stroke: "var(--akse)", "stroke-width": 1 }));
}

// ---------- Akkumulert kurve ----------
function tegnKurve(o, idag) {
  const el = $("kurve");
  if (o.akkumulert.length < 2) return tomt(el, "Kurven vises når det er registrert kostnader.");
  visSvg(el);
  el.replaceChildren();
  const tid = (d) => new Date(d).getTime();
  const punkter = [...o.akkumulert, { dato: idag.toISOString().slice(0, 10), sum: o.total, idag: true }];
  const t0 = tid(punkter[0].dato), t1 = Math.max(tid(punkter[punkter.length - 1].dato), t0 + 86400000);
  const ticks = fineSteg(o.total);
  const ymaks = ticks[ticks.length - 1];
  const bunn = PLOT.H - PLOT.b, topp = PLOT.t;
  const x = (d) => PLOT.v + ((tid(d) - t0) / (t1 - t0)) * (PLOT.B - PLOT.h - PLOT.v);
  const y = (v) => bunn - (v / ymaks) * (bunn - topp);
  el.setAttribute("aria-label", `Akkumulerte kostnader fra ${formaterDato(punkter[0].dato)}: ${kr(o.total)} i dag`);
  tegnYakse(el, ticks, y);

  // Årstall langs x-aksen
  const forste = new Date(t0).getFullYear(), siste = new Date(t1).getFullYear();
  const hver = Math.ceil((siste - forste + 1) / 6);
  for (let ar = forste + 1; ar <= siste; ar += hver) {
    const t = svg("text", { x: x(`${ar}-01-01`), y: bunn + 14, "text-anchor": "middle" });
    t.textContent = String(ar);
    el.append(t);
  }

  // Trappekurve: kostnaden kommer på datoen, så linjen går flatt til neste post
  let d = `M${x(punkter[0].dato)},${y(punkter[0].sum)}`;
  for (let i = 1; i < punkter.length; i++) d += ` H${x(punkter[i].dato)} V${y(punkter[i].sum)}`;
  el.append(svg("path", { d: `${d} V${bunn} H${x(punkter[0].dato)} Z`, fill: "var(--serie-hoved)", opacity: 0.12 }));
  el.append(svg("path", { d, fill: "none", stroke: "var(--serie-hoved)", "stroke-width": 2, "stroke-linejoin": "round" }));
  el.append(svg("line", { x1: PLOT.v, x2: PLOT.B - PLOT.h, y1: bunn, y2: bunn, stroke: "var(--akse)", "stroke-width": 1 }));

  // Sluttpunkt med etikett
  const sx = x(punkter[punkter.length - 1].dato), sy = y(o.total);
  el.append(svg("circle", { cx: sx, cy: sy, r: 4, fill: "var(--serie-hoved)", stroke: "#16171a", "stroke-width": 2 }));

  // Siktelinje og verktøytips: nærmeste punkt langs x-aksen
  const sikte = svg("line", { y1: topp, y2: bunn, stroke: "var(--akse)", "stroke-width": 1, visibility: "hidden" });
  const markor = svg("circle", { r: 5, fill: "var(--serie-hoved)", stroke: "#16171a", "stroke-width": 2, visibility: "hidden" });
  el.append(sikte, markor);
  const flate = svg("rect", { x: PLOT.v, y: topp, width: PLOT.B - PLOT.h - PLOT.v, height: bunn - topp, fill: "transparent", class: "treff" });
  const finn = (e) => {
    const r = el.getBoundingClientRect();
    const sx2 = ((e.clientX - r.left) / r.width) * PLOT.B;
    let best = punkter[0];
    for (const p of punkter) if (Math.abs(x(p.dato) - sx2) < Math.abs(x(best.dato) - sx2)) best = p;
    sikte.setAttribute("x1", x(best.dato)); sikte.setAttribute("x2", x(best.dato));
    markor.setAttribute("cx", x(best.dato)); markor.setAttribute("cy", y(best.sum));
    sikte.setAttribute("visibility", "visible"); markor.setAttribute("visibility", "visible");
    visTips(e, `<strong>${best.idag ? "I dag" : esc(formaterDato(best.dato))}</strong>${kr(best.sum)} totalt`);
  };
  flate.addEventListener("pointermove", finn);
  flate.addEventListener("pointerdown", finn);
  flate.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") { skjulTips(); sikte.setAttribute("visibility", "hidden"); markor.setAttribute("visibility", "hidden"); }
  });
  el.append(flate);
}

// ---------- Tabeller ----------
function tegnTabeller(o) {
  const tabell = (tittel, hoder, rader) => lag("table", {},
    lag("caption", { textContent: tittel }),
    lag("thead", {}, lag("tr", {}, ...hoder.map((h) => lag("th", { textContent: h })))),
    lag("tbody", {}, ...rader.map((r) => lag("tr", {}, ...r.map((c) => lag("td", { textContent: c }))))));
  $("tabeller").replaceChildren(
    tabell("Per utgiftspost", ["Post", "Beløp"], [
      ...o.kategorier.map((k) => [k.navn, `${kr(k.sum)} (${Math.round(k.andel * 100)} %)`]),
      ["Totalt", kr(o.total)],
    ]),
    tabell("Per år", ["År", "Beløp"], o.perAr.map((p) => [String(p.ar), kr(p.sum)])),
  );
}

// Tegn diagrammene på nytt ved rotasjon (tekststørrelsen følger bredden)
let forrigeBredde = innerWidth;
addEventListener("resize", () => {
  if (bil && Math.abs(innerWidth - forrigeBredde) > 40) { forrigeBredde = innerWidth; tegnAlt(); }
});

start();

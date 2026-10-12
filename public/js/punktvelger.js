// Velger for deler på et besøk: én sammenleggbar seksjon per kategori i servicekatalogen.
// Brukes på «Registrer vedlikehold» og i historikken under Mine biler.
// Punkter med perPosisjon (bærearmer) får én avkrysning per hjul: FV, FH, BV, BH.
// Med settBil() vises bare deler som passer bilen. «Vis alle deler» viser resten.
// Deler som allerede er valgt, vises alltid.

const egenskapsCache = new Map();

/** Henter egenskapene til bilen fra Vegvesenet én gang per skilt. Gir null hvis oppslaget feiler. */
export function hentBilEgenskaper(kjennemerke) {
  if (!kjennemerke) return Promise.resolve(null);
  if (!egenskapsCache.has(kjennemerke)) {
    egenskapsCache.set(kjennemerke, fetch(`/api/kjoretoy?kjennemerke=${encodeURIComponent(kjennemerke)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((svar) => (svar ? bilEgenskaper(svar) : null))
      .catch(() => null)
      .then((e) => {
        if (!e) egenskapsCache.delete(kjennemerke); // prøv igjen neste gang
        return e;
      }));
  }
  return egenskapsCache.get(kjennemerke);
}

import { KATALOG, POSISJONER, passerBil } from "./servicekatalog.js";
import { stilFor } from "./punktstil.js";
import { bilEgenskaper } from "./kjoretoy.js";

const lag = (tag, egenskaper = {}, ...barn) => {
  const el = Object.assign(document.createElement(tag), egenskaper);
  el.append(...barn);
  return el;
};

/**
 * @param {object} o
 * @param {string} o.klasse  CSS-klasse på hvert valg, "punkt-chip" eller "punkt-option"
 * @param {(id: string, valgt: boolean) => void} o.vedEndring
 * @returns {{ el: HTMLElement, sett: (ider: string[]) => void, settBil: (egenskaper: object|null) => void }}
 */
export function lagPunktvelger({ klasse, vedEndring }) {
  const bokser = new Map();   // id → checkbox
  const seksjoner = [];       // { details, antall, ider }
  const elementer = [];       // { el, punkt, ider } for å skjule deler som ikke passer bilen
  let egenskaper = null;
  let visAlle = false;
  let valgt = new Set();

  const boks = (id) => {
    const cb = lag("input", { type: "checkbox", name: "servicepunkt", value: id });
    cb.addEventListener("change", () => vedEndring(id, cb.checked));
    bokser.set(id, cb);
    return cb;
  };

  const el = lag("div", { className: "punktvelger" });
  for (const k of KATALOG) {
    const antall = lag("span", { className: "punkt-antall" });
    const innhold = lag("div", { className: "punkt-valg" });
    const ider = [];
    let underkategori = null;

    for (const p of k.punkter) {
      const stil = stilFor(p.id);
      if (p.underkategori && p.underkategori !== underkategori) {
        underkategori = p.underkategori;
        innhold.append(lag("p", { className: "punkt-underkategori", textContent: underkategori }));
      }
      if (p.perPosisjon) {
        const rad = lag("div", { className: `punkt-posisjon gruppe-${stil.gruppe}` },
          lag("span", { className: "punkt-posisjon-navn", textContent: p.navn }));
        for (const pos of POSISJONER) {
          const id = `${p.id}@${pos.id}`;
          ider.push(id);
          const lab = lag("label", { title: `${p.navn}, ${pos.navn}` }, boks(id), ` ${pos.kort}`);
          lab.setAttribute("aria-label", `${p.navn}, ${pos.navn}`);
          rad.append(lab);
        }
        innhold.append(rad);
        elementer.push({ el: rad, punkt: p, ider: POSISJONER.map((pos) => `${p.id}@${pos.id}`) });
      } else {
        ider.push(p.id);
        const lab = lag("label", { className: `${klasse} gruppe-${stil.gruppe}` },
          boks(p.id), ` ${stil.ikon} ${p.navn}`);
        innhold.append(lab);
        elementer.push({ el: lab, punkt: p, ider: [p.id] });
      }
    }

    const details = lag("details", { className: "punkt-kategori" },
      lag("summary", {}, `${k.ikon} ${k.navn} `, antall), innhold);
    seksjoner.push({ details, antall, ider, innhold });
    el.append(details);
  }

  const visAlleKnapp = lag("button", { type: "button", className: "punkt-vis-alle", hidden: true });
  visAlleKnapp.addEventListener("click", () => { visAlle = !visAlle; oppdaterSynlighet(); });
  el.append(visAlleKnapp);

  function oppdaterSynlighet() {
    let skjulte = 0;
    for (const { el: e, punkt, ider } of elementer) {
      const passer = passerBil(punkt, egenskaper) || ider.some((id) => valgt.has(id));
      e.hidden = !visAlle && !passer;
      if (!passer) skjulte++;
    }
    for (const { details, innhold } of seksjoner) {
      details.hidden = ![...innhold.children].some((c) => !c.hidden && !c.classList.contains("punkt-underkategori"));
    }
    visAlleKnapp.hidden = skjulte === 0;
    visAlleKnapp.textContent = visAlle ? "Vis bare deler som passer bilen" : `Vis alle deler (${skjulte} passer ikke bilen)`;
  }

  function sett(valgte) {
    valgt = new Set(valgte ?? []);
    for (const [id, cb] of bokser) cb.checked = valgt.has(id);
    for (const { details, antall, ider } of seksjoner) {
      const n = ider.filter((id) => valgt.has(id)).length;
      antall.textContent = n ? `(${n} valgt)` : "";
      if (n) details.open = true;
    }
    oppdaterSynlighet();
  }

  function settBil(e) {
    egenskaper = e ?? null;
    oppdaterSynlighet();
  }

  return { el, sett, settBil };
}


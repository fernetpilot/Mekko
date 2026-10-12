// Velger for deler på et besøk: én sammenleggbar seksjon per kategori i servicekatalogen.
// Brukes på «Registrer vedlikehold» og i historikken under Mine biler.
// Punkter med perPosisjon (bærearmer) får én avkrysning per hjul: FV, FH, BV, BH.

import { KATALOG, POSISJONER } from "./servicekatalog.js";
import { stilFor } from "./punktstil.js";

const lag = (tag, egenskaper = {}, ...barn) => {
  const el = Object.assign(document.createElement(tag), egenskaper);
  el.append(...barn);
  return el;
};

/**
 * @param {object} o
 * @param {string} o.klasse  CSS-klasse på hvert valg, "punkt-chip" eller "punkt-option"
 * @param {(id: string, valgt: boolean) => void} o.vedEndring
 * @returns {{ el: HTMLElement, sett: (ider: string[]) => void }}
 */
export function lagPunktvelger({ klasse, vedEndring }) {
  const bokser = new Map();   // id → checkbox
  const seksjoner = [];       // { details, antall, ider }

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
      } else {
        ider.push(p.id);
        innhold.append(lag("label", { className: `${klasse} gruppe-${stil.gruppe}` },
          boks(p.id), ` ${stil.ikon} ${p.navn}`));
      }
    }

    const details = lag("details", { className: "punkt-kategori" },
      lag("summary", {}, `${k.ikon} ${k.navn} `, antall), innhold);
    seksjoner.push({ details, antall, ider });
    el.append(details);
  }

  function sett(valgte) {
    const s = new Set(valgte ?? []);
    for (const [id, cb] of bokser) cb.checked = s.has(id);
    for (const { details, antall, ider } of seksjoner) {
      const n = ider.filter((id) => s.has(id)).length;
      antall.textContent = n ? `(${n} valgt)` : "";
      if (n) details.open = true;
    }
  }

  return { el, sett };
}


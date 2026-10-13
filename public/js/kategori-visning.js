// Viser kategoriene og delene på én vedlikeholdshendelse. Felles for fanen Vedlikehold,
// Mine biler og serviceheftet, så hendelsene ser like ut overalt. Stil: /css/kategorier.css.
import { kategorierFor, delerFor } from "./kategorier.js";

const lag = (tag, klasse, tekst) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst != null) e.textContent = tekst;
  return e;
};

/**
 * Liste med én linje per kategori: «🛑 Bremser» og delene under.
 * Gir et tomt fragment når hendelsen ikke har deler (da sier tittelen alt).
 */
export function kategoriListe(h, { gjettetTekst = "Delene er gjettet ut fra notatet. Trykk «Endre» for å rette." } = {}) {
  const kategorier = kategorierFor(h);
  if (!kategorier.some((k) => k.delNavn.length)) return document.createDocumentFragment();
  const ul = lag("ul", "kat-liste");
  for (const k of kategorier) {
    const li = lag("li", `kat-rad kat-${k.gruppe}`);
    li.append(lag("span", "kat-navn", `${k.ikon} ${k.navn}`));
    if (k.delNavn.length) li.append(lag("span", "kat-deler", k.delNavn.join(", ")));
    ul.append(li);
  }
  if (delerFor(h).gjettet && gjettetTekst) ul.append(lag("li", "kat-gjettet", gjettetTekst));
  return ul;
}

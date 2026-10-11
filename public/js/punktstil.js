// Ikon og farge per servicepunkt, så man ser hva som er byttet på et besøk.
// Ren logikk. Fargene settes i CSS (klassen gruppe-<gruppe>).

const STIL = {
  motorolje: { ikon: "🛢️", gruppe: "olje" },
  oljefilter: { ikon: "🧽", gruppe: "filter" },
  dieselfilter: { ikon: "⛽", gruppe: "filter" },
  automatgir: { ikon: "⚙️", gruppe: "olje" },
  "manuelt-gir": { ikon: "⚙️", gruppe: "olje" },
  overforing: { ikon: "⚙️", gruppe: "olje" },
  "diff-foran": { ikon: "⚙️", gruppe: "olje" },
  "diff-bak": { ikon: "⚙️", gruppe: "olje" },
  servostyring: { ikon: "🛞", gruppe: "olje" },
  kjolevaeske: { ikon: "💧", gruppe: "vaeske" },
  bremsevaeske: { ikon: "💧", gruppe: "bremse" },
  bremseklosser: { ikon: "🛑", gruppe: "bremse" },
  luftfilter: { ikon: "🌬️", gruppe: "filter" },
  pollenfilter: { ikon: "🌼", gruppe: "filter" },
  registerreim: { ikon: "🔗", gruppe: "motor" },
  "ekstra-service": { ikon: "🧰", gruppe: "annet" },
  "annet-arbeid": { ikon: "📝", gruppe: "annet" },
};

/** @returns {{ ikon: string, gruppe: string }} */
export function stilFor(punktId) {
  return STIL[punktId] ?? { ikon: "•", gruppe: "annet" };
}

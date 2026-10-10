// Beregner neste servicefrist for ett servicepunkt.
// Ren funksjon: ingen DOM, ingen nettverkskall. Datoer er ISO-strenger (YYYY-MM-DD).
// Regel: det som kommer først (km eller måned) gjelder.

export const SNART_KM = 5000;
export const SNART_DAGER = 90;

const dagMs = 24 * 60 * 60 * 1000;

function tilUtc(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function tilIso(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// Legger til måneder. Hvis dagen ikke finnes i målmåneden, brukes siste dag i måneden.
export function leggTilMåneder(iso, mnd) {
  const [y, m, d] = iso.split("-").map(Number);
  const totalt = y * 12 + (m - 1) + mnd;
  const år = Math.floor(totalt / 12);
  const mnr = totalt % 12;
  const sisteDag = new Date(Date.UTC(år, mnr + 1, 0)).getUTCDate();
  return tilIso(Date.UTC(år, mnr, Math.min(d, sisteDag)));
}

// punkt:  { id, navn, kmIntervall, manederIntervall }  (null = ingen grense på den enheten)
// sist:   { dato: "YYYY-MM-DD", km } eller null hvis aldri registrert
// idag:   "YYYY-MM-DD"
// kmNaa:  dagens kilometerstand, eller null hvis ukjent
export function beregnServicefrist({ punkt, sist, idag, kmNaa = null }) {
  if (!sist || !sist.dato) {
    return { id: punkt.id, status: "ukjent", forklaring: "Ingen registrert service ennå." };
  }

  const frister = [];
  if (punkt.manederIntervall != null) {
    const dato = leggTilMåneder(sist.dato, punkt.manederIntervall);
    frister.push({ type: "dato", dato, dagerIgjen: Math.round((tilUtc(dato) - tilUtc(idag)) / dagMs) });
  }
  if (punkt.kmIntervall != null && sist.km != null) {
    const km = sist.km + punkt.kmIntervall;
    frister.push({ type: "km", km, kmIgjen: kmNaa == null ? null : km - kmNaa });
  }
  if (frister.length === 0) {
    return { id: punkt.id, status: "ukjent", forklaring: "Mangler intervall eller kilometerstand." };
  }

  const datoFrist = frister.find((f) => f.type === "dato");
  const kmFrist = frister.find((f) => f.type === "km");

  // Hvilken frist gjelder først?
  const forfalt =
    (datoFrist && datoFrist.dagerIgjen <= 0) || (kmFrist && kmFrist.kmIgjen != null && kmFrist.kmIgjen <= 0);
  const snart =
    (datoFrist && datoFrist.dagerIgjen <= SNART_DAGER) ||
    (kmFrist && kmFrist.kmIgjen != null && kmFrist.kmIgjen <= SNART_KM);

  const status = forfalt ? "forfalt" : snart ? "snart" : "ok";

  return {
    id: punkt.id,
    status,
    neste: { dato: datoFrist?.dato ?? null, km: kmFrist?.km ?? null },
    gjenstaar: { dager: datoFrist?.dagerIgjen ?? null, km: kmFrist?.kmIgjen ?? null },
  };
}

// Lesbar kortform av en dato og et km-tall, for varselteksten.
export function fmtDato(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtKm(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Proxy mot Statens vegvesens kjøretøydata-API.
// Nettsiden kaller /api/kjoretoy?kjennemerke=AB12345 – API-nøkkelen forblir på serveren.

const SVV_URL =
  "https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata";

const svar = (data, status = 200, ekstraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...ekstraHeaders },
  });

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const kjennemerke = (params.get("kjennemerke") || "")
    .toUpperCase()
    .replace(/[\s-]/g, "");

  if (!/^[A-ZÆØÅ0-9]{2,7}$/.test(kjennemerke)) {
    return svar({ feil: "Ugyldig skiltnummer. Bruk 2–7 bokstaver og tall." }, 400);
  }

  const nokkel = process.env.SVV_API_KEY;
  if (!nokkel) {
    return svar({ feil: "Serveren mangler API-nøkkel (SVV_API_KEY)." }, 500);
  }

  let res;
  try {
    res = await fetch(`${SVV_URL}?kjennemerke=${encodeURIComponent(kjennemerke)}`, {
      headers: { "SVV-Authorization": `Apikey ${nokkel}` },
    });
  } catch {
    return svar({ feil: "Fikk ikke kontakt med Statens vegvesen. Prøv igjen." }, 502);
  }

  if (res.status === 200) {
    const data = await res.json();
    if (!data?.kjoretoydataListe?.length) {
      return svar({ feil: "Fant ingen kjøretøy med dette skiltnummeret." }, 404);
    }
    // Kjøretøydata endres sjelden – cache i én time for å spare kvoten.
    return svar(data, 200, { "Cache-Control": "public, max-age=3600" });
  }

  const feilmeldinger = {
    400: "Ugyldig forespørsel til Vegvesenet.",
    403: "API-nøkkelen ble avvist av Vegvesenet.",
    429: "Dagens kvote med oppslag er brukt opp. Prøv igjen i morgen.",
  };
  return svar(
    { feil: feilmeldinger[res.status] || "Opplysningene er ikke tilgjengelige." },
    res.status === 429 ? 429 : 502
  );
};

export const config = { path: "/api/kjoretoy" };

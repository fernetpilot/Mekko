// Hvilken 3D-modell som skal vises for en bil. Ren logikk, testet.
// Bilen kommer fra tabellen `biler` (merke, modell og førstegangsregistrering fra Vegvesenet).
// null betyr at vi ikke har en egen modell, og da vises standardbilen.

// Vegvesenet skriver som regel «DISCOVERY 3» / «DISCOVERY 4». Står det bare «DISCOVERY»,
// skiller vi på førstegangsregistrering: Discovery 4 kom høsten 2009 og ble avløst av
// Discovery 5 i 2017.
const D4_FRA = "2009-09-01";
const D5_FRA = "2017-01-01";

/**
 * @param {{ merke?: string|null, modell?: string|null, forstegangsregistrert?: string|null }} bil
 * @returns {"discovery3"|"discovery4"|null}
 */
export function velgBilmodell(bil) {
  const merke = String(bil?.merke ?? "").toUpperCase();
  const modell = String(bil?.modell ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!/LAND ?ROVER/.test(merke) && !/DISCOVERY|LR[34]\b/.test(modell)) return null;
  if (/SPORT/.test(modell)) return null;                     // Discovery Sport er en helt annen bil
  if (/DISCOVERY ?3|\bLR3\b/.test(modell)) return "discovery3";
  if (/DISCOVERY ?4|\bLR4\b/.test(modell)) return "discovery4";
  if (/DISCOVERY ?\d/.test(modell) || !/DISCOVERY/.test(modell)) return null;
  // Bare «DISCOVERY»: årstallet avgjør
  const dato = String(bil?.forstegangsregistrert ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) return null;
  if (dato < "2004-06-01" || dato >= D5_FRA) return null;
  return dato < D4_FRA ? "discovery3" : "discovery4";
}

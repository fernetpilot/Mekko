// Lakkfarge på 3D-bilen ut fra fargen bilen er registrert med hos Statens vegvesen.
// API-et gir bare grunnfargen («Grå», «Blå» …), så hver grunnfarge får en litt dempet tone.
// Ren logikk, testet.

const TONER = [
  [/sølv/, 0xb4b7bb],
  [/hvit/, 0xe6e6e2],
  [/svart/, 0x202226],
  [/grå/, 0x7d8187],
  [/turkis/, 0x3c7d7f],
  [/blå/, 0x2e4d78],
  [/rosa/, 0xc08893],
  [/rød/, 0x8c2b27],
  [/grønn/, 0x3e5a44],
  [/gull/, 0xb39a5c],
  [/oransje/, 0xbd6a2e],
  [/gul/, 0xc8a540],
  [/beige/, 0xc6b896],
  [/brun/, 0x5d4636],
  [/lilla|fiolett/, 0x5a4a72],
];

/** Fargenavnet fra API-svaret (`rFarge` på tekniske data), eller null. */
export function registrertFarge(apiSvar) {
  const td = apiSvar?.kjoretoydataListe?.[0]?.godkjenning?.tekniskGodkjenning?.tekniskeData;
  const f = td?.karosseriOgLasteplan?.rFarge;
  const forste = Array.isArray(f) ? f[0] : f;
  const navn = typeof forste === "string" ? forste : forste?.kodeNavn ?? forste?.kodeBeskrivelse;
  return navn ? String(navn) : null;
}

/** Tone (heltall 0xRRGGBB) for et fargenavn, eller null hvis fargen er ukjent. */
export function lakkFor(fargenavn) {
  const navn = String(fargenavn ?? "").toLowerCase();
  if (!navn) return null;
  for (const [monster, tone] of TONER) if (monster.test(navn)) return tone;
  return null;
}

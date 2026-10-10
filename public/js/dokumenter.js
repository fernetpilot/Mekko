// Dokumenter (kvitteringer, serviceordrer, bilder) knyttet til vedlikehold.
// Filene ligger i Supabase Storage, bucket «dokumenter», mappe <bruker-id>/<vedlikehold-id>/.
// Tabellen public.dokumenter holder oversikten. Se supabase/02-dokumenter.sql.

export const BUCKET = "dokumenter";
export const MAKS_BYTES = 10 * 1024 * 1024; // samme grense som i Supabase
const MAKS_PIKSLER = 2400; // lengste side på bilder etter nedskalering

/** «Kvittering Bilxtra (1).heic» → «Kvittering_Bilxtra_1_.heic» – trygt i filstier */
export function tryggFilnavn(navn) {
  const ren = String(navn || "fil")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/æ/g, "ae").replace(/Æ/g, "Ae").replace(/ø/g, "o").replace(/Ø/g, "O")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (ren || "fil").slice(-80);
}

export function erPdf(fil) {
  return fil.type === "application/pdf" || /\.pdf$/i.test(fil.name);
}

/**
 * Gjør en valgt fil klar for opplasting:
 * - PDF sendes som den er
 * - bilder (også HEIC fra iPhone der nettleseren kan lese dem) gjøres om til JPEG,
 *   skalert ned til maks 2400 px – mindre filer, og alle kan legges inn i PDF-en senere
 * @returns {Promise<{ blob: Blob, navn: string, mimetype: string }>}
 */
export async function forberedFil(fil) {
  if (erPdf(fil)) {
    if (fil.size > MAKS_BYTES) throw new Error(`${fil.name} er større enn 10 MB.`);
    return { blob: fil, navn: fil.name, mimetype: "application/pdf" };
  }
  if (!fil.type.startsWith("image/") && !/\.(heic|heif)$/i.test(fil.name)) {
    throw new Error(`${fil.name}: bare bilder og PDF kan lastes opp.`);
  }

  let bilde;
  try {
    bilde = await createImageBitmap(fil);
  } catch {
    throw new Error(`${fil.name}: bildeformatet kan ikke leses av denne nettleseren. Prøv JPEG eller PDF.`);
  }
  const skala = Math.min(1, MAKS_PIKSLER / Math.max(bilde.width, bilde.height));
  const lerret = document.createElement("canvas");
  lerret.width = Math.round(bilde.width * skala);
  lerret.height = Math.round(bilde.height * skala);
  const ctx = lerret.getContext("2d");
  ctx.fillStyle = "#fff"; // gjennomsiktige PNG-er får hvit bakgrunn
  ctx.fillRect(0, 0, lerret.width, lerret.height);
  ctx.drawImage(bilde, 0, 0, lerret.width, lerret.height);
  bilde.close?.();

  const blob = await new Promise((ok) => lerret.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error(`${fil.name}: kunne ikke behandle bildet.`);
  if (blob.size > MAKS_BYTES) throw new Error(`${fil.name} er for stort selv etter nedskalering.`);
  return { blob, navn: fil.name.replace(/\.[^.]+$/, "") + ".jpg", mimetype: "image/jpeg" };
}

/**
 * Laster opp filer til en vedlikeholdsregistrering.
 * @returns {Promise<{ antallOk: number, feil: string[] }>}
 */
export async function lastOppDokumenter(supabase, { eierId, vedlikeholdId, filer, framdrift = () => {} }) {
  const feil = [];
  let antallOk = 0;
  for (const [i, fil] of [...filer].entries()) {
    framdrift(`Laster opp ${i + 1} av ${filer.length}: ${fil.name}`);
    try {
      const klar = await forberedFil(fil);
      const filsti = `${eierId}/${vedlikeholdId}/${Date.now()}-${i}-${tryggFilnavn(klar.navn)}`;
      const opp = await supabase.storage.from(BUCKET).upload(filsti, klar.blob, { contentType: klar.mimetype });
      if (opp.error) throw new Error(`${fil.name}: opplastingen feilet.`);
      const rad = await supabase.from("dokumenter").insert({
        vedlikehold_id: vedlikeholdId,
        filsti,
        filnavn: klar.navn.slice(0, 200),
        mimetype: klar.mimetype,
        storrelse: klar.blob.size,
      });
      if (rad.error) {
        await supabase.storage.from(BUCKET).remove([filsti]);
        throw new Error(`${fil.name}: kunne ikke lagre dokumentet.`);
      }
      antallOk++;
    } catch (e) {
      feil.push(e.message);
    }
  }
  return { antallOk, feil };
}

/** Midlertidige lenker (1 time) til private filer: { [filsti]: url } */
export async function signerteLenker(supabase, filstier) {
  if (!filstier.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(filstier, 3600);
  if (error) throw error;
  return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

/** Sletter filene i lagringen for gitte registreringer (radene slettes via cascade). */
export async function slettFilerForVedlikehold(supabase, vedlikeholdIder) {
  if (!vedlikeholdIder.length) return;
  const { data } = await supabase.from("dokumenter").select("filsti").in("vedlikehold_id", vedlikeholdIder);
  const stier = (data ?? []).map((d) => d.filsti);
  if (stier.length) await supabase.storage.from(BUCKET).remove(stier);
}

/** Sletter alle brukerens filer (før kontoen slettes). */
export async function slettAlleMineFiler(supabase) {
  const { data } = await supabase.from("dokumenter").select("filsti");
  const stier = (data ?? []).map((d) => d.filsti);
  for (let i = 0; i < stier.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(stier.slice(i, i + 100));
  }
}

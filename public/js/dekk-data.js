// Henter brukerens dekksett og legger dem på bilene som `bil.dekksett`.
// Tåler at tabellen mangler (07-dekksett.sql ikke kjørt ennå): da får bilene en tom liste.

/** @returns {Promise<boolean>} false hvis dekksettene ikke kunne hentes */
export async function leggPaDekksett(supabase, biler) {
  const { data, error } = await supabase.from("dekksett").select("*").order("opprettet");
  if (error) console.error("Dekksett: kunne ikke hente", error);
  for (const bil of biler ?? []) bil.dekksett = (data ?? []).filter((s) => s.bil_id === bil.id);
  return !error;
}

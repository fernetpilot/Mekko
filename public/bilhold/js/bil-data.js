// Henter brukerens biler med vedlikehold, dokumenter, utsettelser og dekksett.
// Brukes av «Bilen din» og av kortene på forsiden. Valgt bil huskes i nettleseren.
import { supabase } from '/js/supabase.js';
import { leggPaDekksett } from '/js/dekk-data.js';

const LAGRET_BIL = 'mekko-valgt-bil';

/** @returns {Promise<{ biler: object[], dekksettOk: boolean }>} */
export async function hentBiler() {
  const { data, error } = await supabase
    .from('biler')
    .select('*, vedlikehold(*, dokumenter(*)), utsettelser(*)')
    .order('opprettet')
    .order('dato', { referencedTable: 'vedlikehold', ascending: false });
  if (error) throw error;
  const dekksettOk = await leggPaDekksett(supabase, data);
  return { biler: data, dekksettOk };
}

export function lagretBil() {
  try { return localStorage.getItem(LAGRET_BIL); } catch { return null; }
}
export function lagreBil(id) {
  try { localStorage.setItem(LAGRET_BIL, id); } catch { /* bare en snarvei */ }
}

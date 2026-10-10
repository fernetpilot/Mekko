// Tilkobling til Supabase (innlogging og database).
// URL og publishable key er laget for å ligge åpent i nettsiden – dataene
// beskyttes av tilgangsreglene (RLS) i supabase/schema.sql.
// Secret key / service_role skal ALDRI inn her.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://pwihbhlnskaysbxzoqwu.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SHqOIzbuy_9SS-luJ_U39A_IG_1Ua5y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

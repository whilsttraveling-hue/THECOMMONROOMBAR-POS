import { createClient } from "@supabase/supabase-js";

// ---- Paste your Supabase project values here ----
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
// ---------------------------------------------------

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Each of these tables has exactly one row (id = 'singleton') holding
// the whole JSON blob for that piece of state — menu, tabs, or history.
// This keeps the app logic identical to the artifact version: one
// get/set per data type, no per-row queries to manage.

export async function cloudGet(table, fallback) {
  const { data, error } = await supabase
    .from(table)
    .select("value")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) {
    console.error(`[cloudGet] ${table} failed:`, error.message, error);
    return fallback;
  }
  if (!data) return fallback;
  return data.value;
}

export async function cloudSet(table, value) {
  const { error } = await supabase
    .from(table)
    .upsert({ id: "singleton", value, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    console.error(`[cloudSet] ${table} failed:`, error.message, error);
  }
  return !error;
}

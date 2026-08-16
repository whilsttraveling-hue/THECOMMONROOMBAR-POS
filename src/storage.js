import { createClient } from "@supabase/supabase-js";

// ---- Paste your Supabase project values here ----
const SUPABASE_URL = "https://iwnzrtbborjniplruuzc.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bnpydGJib3JqbmlwbHJ1dXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzMwMTIsImV4cCI6MjEwMjQ0OTAxMn0.asUmHpSq2sppAiLDt3YSwkgkNR6pDzOTypAEtKaim80";
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
  if (error || !data) return fallback;
  return data.value;
}

export async function cloudSet(table, value) {
  const { error } = await supabase
    .from(table)
    .upsert({ id: "singleton", value, updated_at: new Date().toISOString() });
  return !error;
}

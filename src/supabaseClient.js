import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mstvtqwialblbsuajpjb.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdHZ0cXdpYWxibGJzdWFqcGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDAzNTAsImV4cCI6MjA5NTMxNjM1MH0.Mrz6xqXpAXHU4kV_tK6hmm6yXg5d-hrramr8uzfKa00";

// Always configured on the web app (hardcoded credentials)
export const isSupabaseConfigured = true;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

export function requireSupabase() {
  return supabase;
}

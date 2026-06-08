import { createClient } from "@supabase/supabase-js";

const HARDCODED_SUPABASE_URL = "https://rjoifchpocteabrquqqi.supabase.co";
const HARDCODED_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqb2lmY2hwb2N0ZWFicnF1cXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjIwMzMsImV4cCI6MjA5NjQzODAzM30.6GAurkdy0C8bQQ8QFjSk-MKaXST0cRjPWaKQPkkeOwU";

function readRuntimeConfig() {
  if (typeof window !== "undefined" && window.tuxCashierConfig) {
    return window.tuxCashierConfig;
  }
  return {};
}

function readEnvValue(name) {
  const env =
    typeof process !== "undefined" && process && process.env ? process.env : {};
  return env[name] || "";
}

const runtimeConfig = readRuntimeConfig();

const supabaseUrl =
  runtimeConfig.supabaseUrl ||
  readEnvValue("VITE_SUPABASE_URL") ||
  readEnvValue("REACT_APP_SUPABASE_URL") ||
  HARDCODED_SUPABASE_URL;

const supabaseAnonKey =
  runtimeConfig.supabaseAnonKey ||
  readEnvValue("VITE_SUPABASE_ANON_KEY") ||
  readEnvValue("REACT_APP_SUPABASE_ANON_KEY") ||
  HARDCODED_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Check the hardcoded Supabase URL and anon key."
    );
  }
  return supabase;
}

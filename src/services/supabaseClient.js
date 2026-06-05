import { createClient } from "@supabase/supabase-js";

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
  readEnvValue("REACT_APP_SUPABASE_URL");

const supabaseAnonKey =
  runtimeConfig.supabaseAnonKey ||
  readEnvValue("VITE_SUPABASE_ANON_KEY") ||
  readEnvValue("REACT_APP_SUPABASE_ANON_KEY");

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
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync."
    );
  }
  return supabase;
}

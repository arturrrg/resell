import type { SupabaseClient } from "@supabase/supabase-js";
const env = (import.meta as any).env || {};
export const cloudConfigured = !!(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
);
let client: Promise<SupabaseClient> | undefined;
let viewerClient: Promise<SupabaseClient> | undefined;
export function getViewerSupabase() {
  if (!cloudConfigured) return Promise.reject(Error("Inventory viewing is unavailable."));
  return viewerClient ||= import("@supabase/supabase-js").then(({ createClient }) => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(20000) }) } }));
}
export function getSupabase() {
  if (!cloudConfigured)
    return Promise.reject(
      Error("Cloud sync is not configured for this build."),
    );
  return (client ||= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal || AbortSignal.timeout(20000),
          }),
      },
    }),
  ));
}

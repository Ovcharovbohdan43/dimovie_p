import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseBrowserKey } from "./env";

export function createClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const { supabaseUrl, supabaseKey } = getSupabaseBrowserKey();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // refreshes sessions.
        }
      },
    },
  });
}

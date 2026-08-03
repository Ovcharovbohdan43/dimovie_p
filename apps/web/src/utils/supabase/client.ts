import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseBrowserKey } from "./env";

export function createClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseBrowserKey();
  return createBrowserClient(supabaseUrl, supabaseKey);
}

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Browser-safe client — uses @supabase/ssr so the session is stored in cookies,
 * not localStorage. This keeps it in sync with the server proxy which reads cookies.
 */
export const supabase = createBrowserClient<Database>(url, anon);

/** Server-only client (service role, bypasses RLS). Only import in API routes / server components. */
export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}

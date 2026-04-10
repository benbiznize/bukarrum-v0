import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cookie-less Supabase client for anonymous, cacheable reads.
 *
 * Used inside `"use cache"` functions where `next/headers` cookies/headers
 * cannot be read. Relies on RLS policies that allow anonymous access to the
 * public tables (tenants, locations, resources, resource_locations).
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

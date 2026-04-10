import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO } from './ids';

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      '[seed] SUPABASE_SERVICE_ROLE_KEY is required. Is it set in .env.local?',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Idempotent: creates the demo auth user if missing, otherwise
 * updates the password/id to match DEMO. This is called BEFORE the
 * main pg transaction because the admin API doesn't share our
 * connection.
 *
 * `supabase db reset --no-seed` wipes auth.users, so in the normal
 * flow we always hit the "create" branch. The "already exists" branch
 * exists purely for safety when someone runs `db:seed` alone.
 */
export async function ensureDemoAuthUser(): Promise<void> {
  const admin = adminClient();

  // Supabase's admin API has no "get by id" that returns missing as null,
  // so we check by listing and filtering. 1000 is more than enough for dev.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const already = existing.users.find((u) => u.email === DEMO.email);
  if (already) {
    if (already.id !== DEMO.authUserId) {
      throw new Error(
        `[seed] ${DEMO.email} exists with id ${already.id}, expected ${DEMO.authUserId}. Run \`supabase db reset\` first.`,
      );
    }
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    id: DEMO.authUserId,
    email: DEMO.email,
    password: DEMO.password,
    email_confirm: true,
    user_metadata: { seeded: true },
  });
  if (error) throw error;
}

/**
 * Create a thin-tenant owner. Not idempotent — callers must run against
 * an empty auth.users table (i.e., immediately after `db reset`).
 *
 * Returns the newly-minted user id, which the caller stores in tenants.user_id.
 */
export async function createThinTenantOwner(index: number): Promise<string> {
  const admin = adminClient();
  const email = `owner+${index}@bukarrum.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO.password,
    email_confirm: true,
    user_metadata: { seeded: true, thin_index: index },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`[seed] createUser returned no user for ${email}`);
  return data.user.id;
}

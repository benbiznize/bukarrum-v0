import postgres from 'postgres';

/**
 * Default points at the Supabase local dev DB.
 * Override with SUPABASE_DB_URL if you've changed the port.
 *
 * Uses the `postgres` superuser connection string — this bypasses
 * RLS, which is exactly what we want for seeding.
 */
const DEFAULT_LOCAL_URL = 'postgres://postgres:postgres@127.0.0.1:54322/postgres';

export function getDatabaseUrl(): string {
  return process.env.SUPABASE_DB_URL ?? DEFAULT_LOCAL_URL;
}

/**
 * Safety rail: refuse to seed anything that isn't localhost.
 * Throws synchronously before any connection is opened.
 */
export function assertLocalhost(url: string): void {
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('host.docker.internal');
  if (!isLocal) {
    throw new Error(
      `[seed] Refusing to run against non-local database: ${url.replace(/:[^:@]*@/, ':***@')}`,
    );
  }
}

/**
 * Opens a short-lived `postgres` client. Callers are responsible for
 * closing it via `await sql.end()` in a finally block.
 */
export function createSqlClient() {
  const url = getDatabaseUrl();
  assertLocalhost(url);
  return postgres(url, {
    // Fail fast: we want a hard error in dev, not a 30s wait.
    connect_timeout: 5,
    // Raw error messages are more useful than masked ones.
    onnotice: () => {},
  });
}

export type Sql = ReturnType<typeof createSqlClient>;

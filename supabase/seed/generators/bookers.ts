import type { Sql } from '../lib/db';
import { fakerEs, chileanPhone } from '../lib/faker';

// Module-level counter: `bookers.email` has a global unique index, so
// we must never emit the same local-part across *calls* either. Per-call
// counters (reset to 1) could collide when faker re-rolls the same
// first+last within the first N picks on a separate invocation.
let bookerCounter = 0;

/**
 * Inserts N unique bookers and returns their ids. Uses a running
 * counter in email local-part to guarantee uniqueness even under
 * faker collisions.
 */
export async function seedBookers(sql: Sql, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, () => {
    const firstName = fakerEs.person.firstName();
    const lastName = fakerEs.person.lastName();
    const name = `${firstName} ${lastName}`;
    bookerCounter += 1;
    const email = `${slug(firstName)}.${slug(lastName)}.${bookerCounter}@example.cl`;
    return {
      email,
      name,
      phone: chileanPhone(),
    };
  });

  const inserted = await sql<{ id: string }[]>`
    insert into public.bookers ${sql(rows)}
    returning id
  `;
  return inserted.map((r) => r.id);
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

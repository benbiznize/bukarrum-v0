import type { Sql } from '../lib/db';
import { fakerEs, chileanPhone } from '../lib/faker';

/**
 * Inserts N unique bookers and returns their ids. Uses a running
 * counter in email local-part to guarantee uniqueness even under
 * faker collisions.
 */
export async function seedBookers(sql: Sql, count: number): Promise<string[]> {
  const rows = Array.from({ length: count }, (_, i) => {
    const firstName = fakerEs.person.firstName();
    const lastName = fakerEs.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = `${slug(firstName)}.${slug(lastName)}.${i + 1}@example.cl`;
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

import { Faker, es } from '@faker-js/faker';

/**
 * Deterministic faker for seed data.
 *
 * `faker.seed(n)` makes every generator call reproducible, which means
 * every `db:reset` produces the exact same tenants, bookers, notes, etc.
 * Override with FAKER_SEED=... when you want fresh variety.
 */
const seedEnv = process.env.FAKER_SEED;
const SEED = seedEnv ? Number.parseInt(seedEnv, 10) : 42;

export const fakerEs = new Faker({ locale: [es] });
fakerEs.seed(Number.isFinite(SEED) ? SEED : 42);

/**
 * Chilean mobile number generator. The faker `es` locale produces
 * Spain-style numbers, so we roll our own to keep bookers realistic
 * and consistent with the CL domain.
 */
export function chileanPhone(): string {
  const block1 = String(fakerEs.number.int({ min: 1000, max: 9999 })).padStart(4, '0');
  const block2 = String(fakerEs.number.int({ min: 1000, max: 9999 })).padStart(4, '0');
  return `+569${block1}${block2}`;
}

/**
 * Slugify helper. Lowercases, strips accents, replaces non-alphanumeric
 * runs with `-`, trims leading/trailing hyphens. Matches the slug format
 * constraint enforced by the DB.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

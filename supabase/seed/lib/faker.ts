import { Faker, es, en, base } from '@faker-js/faker';

/**
 * Deterministic faker for seed data.
 *
 * `faker.seed(n)` makes every generator call reproducible, which means
 * every `db:reset` produces the exact same tenants, bookers, notes, etc.
 * Override with FAKER_SEED=... when you want fresh variety.
 */
const seedEnv = process.env.FAKER_SEED;
const SEED = seedEnv ? Number.parseInt(seedEnv, 10) : 42;

// Locale fallback chain: es-first, falling through to en, then base.
// Required because faker's `es` locale lacks some modules (notably
// `lorem`), and the loader throws instead of silently falling back.
export const fakerEs = new Faker({ locale: [es, en, base] });
fakerEs.seed(Number.isFinite(SEED) ? SEED : 42);

/**
 * Frozen "now" for the seed run.
 *
 * Booking status distributions depend on whether the start time is in
 * the past or future. If we used `new Date()` everywhere, every reset
 * would roll a different past/future split and a different status mix
 * — silently breaking the reproducibility promise above.
 *
 * Default anchor is 2026-04-10T12:00:00Z (the plan's authoring date).
 * Override with SEED_NOW_ISO=YYYY-MM-DDTHH:MM:SSZ when you want a
 * different temporal slice (e.g. to populate a fresh "next week").
 */
const nowEnv = process.env.SEED_NOW_ISO;
const parsedNow = nowEnv ? new Date(nowEnv) : new Date('2026-04-10T12:00:00Z');
export const SEED_NOW: Date = Number.isNaN(parsedNow.getTime())
  ? new Date('2026-04-10T12:00:00Z')
  : parsedNow;

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

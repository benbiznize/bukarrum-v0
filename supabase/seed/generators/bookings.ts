import { fakerEs, SEED_NOW } from '../lib/faker';
import type { Sql } from '../lib/db';
import type {
  BookingOptions,
  SeededAddOn,
  SeededResource,
  SeededTenant,
} from '../lib/types';

// ------------------------------------------------------------------
// Pure decision helpers (no DB). Separating these makes the logic easy
// to reason about and would let us unit-test later if bugs appear.
// ------------------------------------------------------------------

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

interface SlotCandidate {
  resourceId: string;
  locationId: string;
  start: Date;
  end: Date;
  durationHours: number;
}

interface ExistingSlot {
  resourceId: string;
  start: number;
  end: number;
}

interface PaymentPlan {
  status: PaymentStatus;
  /** Entries to insert into booking_payments. Empty for unpaid. */
  entries: Array<{ amount: number; entryType: 'payment' | 'refund'; method: 'cash' | 'transfer' | 'card' | 'mercadopago' | 'other' }>;
}

const DAY_INDEX_TO_NAME = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const;

/**
 * Pick a candidate slot for a booking.
 *
 * Strategy: pick a random day in the window, a random resource, read
 * the resource's availability for that day, pick a random start hour
 * inside the window, pick a duration between min/max. Bail out if the
 * slot collides with any existing booking (checked in-memory).
 *
 * Returns null when we fail to find a non-colliding slot after a few
 * attempts — caller advances and tries again.
 */
export function pickSlot(
  tenant: SeededTenant,
  windowDays: number,
  now: Date,
  existing: ExistingSlot[],
): SlotCandidate | null {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const resource = fakerEs.helpers.arrayElement(tenant.resources);
    const locationId = fakerEs.helpers.arrayElement(resource.locationIds);

    // Past:future split roughly 1/3 : 2/3
    const pastDays = Math.floor(windowDays / 3);
    const futureDays = windowDays - pastDays;
    const dayOffset = fakerEs.number.int({ min: -pastDays, max: futureDays });

    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    day.setUTCHours(0, 0, 0, 0);
    const dayName = DAY_INDEX_TO_NAME[day.getUTCDay()];

    const availability = resource.availability.find((a) => a.dayOfWeek === dayName);
    if (!availability) continue;

    const [startH, startM] = availability.startTime.split(':').map((v) => Number.parseInt(v, 10));
    const [endH, endM] = availability.endTime.split(':').map((v) => Number.parseInt(v, 10));
    const windowStartMinutes = startH * 60 + startM;
    const windowEndMinutes = endH * 60 + endM;

    const duration = fakerEs.number.int({
      min: resource.minDurationHours,
      max: resource.maxDurationHours,
    });
    const durationMinutes = duration * 60;
    if (windowEndMinutes - windowStartMinutes < durationMinutes) continue;

    // Align to whole hours for realism.
    const latestStartMinutes = windowEndMinutes - durationMinutes;
    const startHourCandidate = fakerEs.number.int({
      min: Math.ceil(windowStartMinutes / 60),
      max: Math.floor(latestStartMinutes / 60),
    });

    const start = new Date(day);
    start.setUTCHours(startHourCandidate, 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const collision = existing.some(
      (e) =>
        e.resourceId === resource.id &&
        e.start < end.getTime() &&
        e.end > start.getTime(),
    );
    if (collision) continue;

    return {
      resourceId: resource.id,
      locationId,
      start,
      end,
      durationHours: duration,
    };
  }
  return null;
}

/**
 * Roll a realistic booking status based on when the booking starts
 * relative to `now`. Distributions come from the design spec.
 */
export function assignStatus(start: Date, now: Date): BookingStatus {
  const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const roll = fakerEs.number.float({ min: 0, max: 1 });

  if (diffDays < 0) {
    // Past
    if (roll < 0.70) return 'completed';
    if (roll < 0.82) return 'cancelled';
    if (roll < 0.92) return 'no_show';
    return 'confirmed';
  }
  if (diffDays <= 7) {
    // Near future
    if (roll < 0.85) return 'confirmed';
    return 'pending';
  }
  // Far future
  if (roll < 0.60) return 'confirmed';
  return 'pending';
}

/**
 * Decide payment rows given a status + the booking's total price.
 * Matches the distributions in the design spec.
 */
export function assignPaymentState(
  status: BookingStatus,
  totalPrice: number,
  start: Date,
  now: Date,
): PaymentPlan {
  const roll = fakerEs.number.float({ min: 0, max: 1 });
  const method = fakerEs.helpers.arrayElement(['cash', 'transfer', 'card', 'mercadopago'] as const);
  const isPast = start.getTime() < now.getTime();

  if (status === 'pending' || status === 'cancelled' || status === 'no_show') {
    return { status: 'unpaid', entries: [] };
  }

  if (status === 'completed') {
    if (roll < 0.75) {
      return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
    }
    if (roll < 0.90) {
      const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
      return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
    }
    if (roll < 0.98) {
      return { status: 'unpaid', entries: [] };
    }
    // refunded — insert payment + matching refund
    return {
      status: 'refunded',
      entries: [
        { amount: totalPrice, entryType: 'payment', method },
        { amount: totalPrice, entryType: 'refund', method },
      ],
    };
  }

  // status === 'confirmed'
  if (isPast) {
    if (roll < 0.60) return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
    if (roll < 0.80) {
      const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
      return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
    }
    return { status: 'unpaid', entries: [] };
  }
  // confirmed future
  if (roll < 0.30) return { status: 'paid', entries: [{ amount: totalPrice, entryType: 'payment', method }] };
  if (roll < 0.45) {
    const partial = Math.max(1, Math.round(totalPrice * fakerEs.number.float({ min: 0.25, max: 0.75 })));
    return { status: 'partial', entries: [{ amount: partial, entryType: 'payment', method }] };
  }
  return { status: 'unpaid', entries: [] };
}

/**
 * 40% chance the booking has add-ons. Pick 1-2 random add-ons from
 * the resource's catalog. Returns priced line items ready to insert.
 */
export function pickAddOns(
  resource: SeededResource,
  durationHours: number,
): Array<{ addOnId: string; price: number }> {
  if (resource.addOns.length === 0) return [];
  const chance = fakerEs.number.float({ min: 0, max: 1 });
  if (chance > 0.4) return [];

  const pickCount = Math.min(
    resource.addOns.length,
    fakerEs.number.int({ min: 1, max: 2 }),
  );
  const picks = fakerEs.helpers.arrayElements(resource.addOns, pickCount);
  return picks.map((a: SeededAddOn) => ({
    addOnId: a.id,
    price: a.pricingMode === 'hourly' ? a.unitPrice * durationHours : a.unitPrice,
  }));
}

// Export types downstream callers need
export type { BookingStatus, PaymentStatus, PaymentPlan, SlotCandidate, ExistingSlot };

// ------------------------------------------------------------------
// DB functions — dumb, predictable inserts.
// ------------------------------------------------------------------

interface BookingRowData {
  resourceId: string;
  locationId: string;
  bookerId: string;
  start: Date;
  end: Date;
  durationHours: number;
  totalPrice: number;
  status: BookingStatus;
  notes: string | null;
}

async function insertBooking(sql: Sql, data: BookingRowData): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into public.bookings (
      resource_id, location_id, booker_id,
      start_time, end_time, duration_hours,
      total_price, status, notes
    ) values (
      ${data.resourceId}, ${data.locationId}, ${data.bookerId},
      ${data.start.toISOString()}, ${data.end.toISOString()}, ${data.durationHours},
      ${data.totalPrice}, ${data.status}, ${data.notes}
    )
    returning id
  `;
  return row.id;
}

async function insertBookingAddOns(
  sql: Sql,
  bookingId: string,
  picks: Array<{ addOnId: string; price: number }>,
): Promise<void> {
  if (picks.length === 0) return;
  const rows = picks.map((p) => ({
    booking_id: bookingId,
    add_on_service_id: p.addOnId,
    price: p.price,
  }));
  await sql`insert into public.booking_add_ons ${sql(rows)}`;
}

async function insertPayments(
  sql: Sql,
  bookingId: string,
  plan: PaymentPlan,
): Promise<void> {
  if (plan.entries.length === 0) return;
  const rows = plan.entries.map((e) => ({
    booking_id: bookingId,
    amount: e.amount,
    entry_type: e.entryType,
    method: e.method,
  }));
  await sql`insert into public.booking_payments ${sql(rows)}`;
}

// ------------------------------------------------------------------
// Orchestrator: seeds bookers, then a batch of bookings with realistic
// status, payment, and add-on distributions. Collision detection is
// in-memory.
// ------------------------------------------------------------------

/**
 * Top-level booking generator. Creates ~target bookings across the
 * tenant's resources over `windowDays`. Actual count may be lower if
 * collisions exhaust our slot-picking attempts.
 *
 * `bookerIds` is passed in (not created here) so multiple tenants can
 * share the same booker pool where that makes sense. For thin tenants
 * the caller passes a small per-tenant pool.
 */
export async function seedBookingsForTenant(
  sql: Sql,
  tenant: SeededTenant,
  bookerIds: string[],
  opts: BookingOptions,
): Promise<{ created: number; skipped: number }> {
  if (bookerIds.length === 0) {
    throw new Error(`[seed] no bookers supplied for tenant ${tenant.slug}`);
  }
  if (tenant.resources.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const now = SEED_NOW;
  const existing: ExistingSlot[] = [];
  let created = 0;
  let skipped = 0;

  // We attempt up to target * 2 picks so we don't give up too early
  // when collisions happen on the hotter resources.
  const maxAttempts = opts.target * 2;
  for (let i = 0; i < maxAttempts && created < opts.target; i++) {
    const slot = pickSlot(tenant, opts.windowDays, now, existing);
    if (!slot) {
      skipped++;
      continue;
    }

    const resource = tenant.resources.find((r) => r.id === slot.resourceId);
    if (!resource) {
      skipped++;
      continue;
    }

    const addOns = pickAddOns(resource, slot.durationHours);
    const addOnTotal = addOns.reduce((sum, a) => sum + a.price, 0);
    const totalPrice = resource.hourlyRate * slot.durationHours + addOnTotal;

    const status = assignStatus(slot.start, now);
    const paymentPlan = assignPaymentState(status, totalPrice, slot.start, now);

    const bookerId = fakerEs.helpers.arrayElement(bookerIds);
    const notes =
      fakerEs.number.float({ min: 0, max: 1 }) < 0.15
        ? fakerEs.lorem.sentence({ min: 4, max: 10 })
        : null;

    const bookingId = await insertBooking(sql, {
      resourceId: slot.resourceId,
      locationId: slot.locationId,
      bookerId,
      start: slot.start,
      end: slot.end,
      durationHours: slot.durationHours,
      totalPrice,
      status,
      notes,
    });

    await insertBookingAddOns(sql, bookingId, addOns);
    await insertPayments(sql, bookingId, paymentPlan);

    existing.push({
      resourceId: slot.resourceId,
      start: slot.start.getTime(),
      end: slot.end.getTime(),
    });
    created++;
  }

  return { created, skipped };
}

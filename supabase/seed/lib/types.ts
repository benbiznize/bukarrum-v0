/**
 * Minimal shapes used by the generators. These are narrower than the
 * full row types because the seed only needs the columns it reads back.
 */

export type DayOfWeek =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
  | 'friday' | 'saturday' | 'sunday';

export interface SeededAvailability {
  dayOfWeek: DayOfWeek;
  /** 24h "HH:MM" */
  startTime: string;
  /** 24h "HH:MM" */
  endTime: string;
}

export interface SeededAddOn {
  id: string;
  name: string;
  pricingMode: 'hourly' | 'flat';
  unitPrice: number;
}

export interface SeededResource {
  id: string;
  name: string;
  type: 'room' | 'equipment';
  hourlyRate: number;
  minDurationHours: number;
  maxDurationHours: number;
  /** location ids this resource is available at */
  locationIds: string[];
  availability: SeededAvailability[];
  addOns: SeededAddOn[];
}

export interface SeededLocation {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  timezone: string;
}

export interface SeededTenant {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  planSlug: 'starter' | 'pro' | 'enterprise';
  locations: SeededLocation[];
  resources: SeededResource[];
}

export interface BookingOptions {
  /** Total window in days, split roughly 1/3 past, 2/3 future. */
  windowDays: number;
  /** Target booking count (best-effort — collisions may reduce this). */
  target: number;
}

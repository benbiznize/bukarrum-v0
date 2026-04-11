import type { Database } from "@/lib/supabase/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type PaymentStatus =
  Database["public"]["Enums"]["booking_payment_status"];

export const BOOKING_TABS = [
  "all",
  "pending",
  "unpaid",
  "upcoming",
  "past_due",
  "archived",
] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export const PAGE_SIZE = 50;

export type HasAddOnsFilter = true | false | null;

export type BookingsFilters = {
  tab: BookingTab;
  q: string;
  locationId: string | null;
  resourceId: string | null;
  /** ISO date (YYYY-MM-DD) in tenant local time, inclusive start. */
  fromDate: string | null;
  /** ISO date (YYYY-MM-DD) in tenant local time, inclusive end. */
  toDate: string | null;
  hasAddOns: HasAddOnsFilter;
  page: number;
};

export type CountsByTab = Record<BookingTab, number | null>;

/**
 * Row shape rendered in the list. Keep this in sync with ROW_SELECT in
 * `queries.ts` — any change there should reflect here.
 */
export type BookingRow = {
  id: string;
  booking_number: number;
  start_time: string;
  duration_hours: number;
  total_price: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  has_add_ons: boolean;
  resource: { id: string; name: string; tenant_id: string };
  location: { id: string; name: string; timezone: string } | null;
  booker: { id: string; name: string; email: string; phone: string | null };
};

export type ActionResult =
  | { success: true; affectedCount: number }
  | { success: false; error: string };

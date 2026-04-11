export const CUSTOMERS_SORTS = ["spend", "recent", "name"] as const;
export type CustomersSort = (typeof CUSTOMERS_SORTS)[number];

export const CUSTOMERS_PAGE_SIZE = 25;

export type CustomersFilters = {
  q: string;
  sort: CustomersSort;
  page: number;
};

/**
 * Aggregated per-customer row rendered in the list. Cancelled bookings are
 * excluded from every metric: a booker who only ever cancelled appears with
 * zero counts and zero spend, and ranks at the bottom by "spend".
 */
export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Non-cancelled bookings count. */
  bookingsCount: number;
  /** Sum of `paid_amount` (CLP) across non-cancelled bookings. */
  totalPaid: number;
  /** ISO timestamp of the earliest non-cancelled booking's `start_time`. */
  firstBookingAt: string;
  /** ISO timestamp of the latest non-cancelled booking's `start_time`. */
  lastBookingAt: string;
};

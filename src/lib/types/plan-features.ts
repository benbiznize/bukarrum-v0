/**
 * Typed interface for the `plans.features` JSONB column.
 * Used across the app to validate and read plan limits.
 */
export interface PlanFeatures {
  /** Maximum number of locations a tenant can create. -1 = unlimited. */
  locations: number;
  /** Maximum resources per location. -1 = unlimited. */
  resources_per_location: number;
  /** Maximum bookings per month across all locations. -1 = unlimited. */
  bookings_per_month: number;
  /** Whether add-on services are enabled. */
  add_ons: boolean;
  /** Whether analytics dashboard is enabled. */
  analytics: boolean;
}

import { eachDayOfInterval, getDay, parseISO } from "date-fns";
import type { AnalyticsBooking } from "./queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailabilityRow = {
  resource_id: string;
  day_of_week: string;
  start_time: string; // "10:00:00"
  end_time: string; // "22:00:00"
};

export type ResourceInfo = {
  id: string;
  name: string;
};

export type ResourceUtilization = {
  resourceName: string;
  availableHours: number;
  bookedHours: number;
  utilization: number;
};

// ---------------------------------------------------------------------------
// Day mapping: JS getDay() → DB day_of_week enum
// ---------------------------------------------------------------------------

const DAY_MAP: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a time string like "10:00:00" into total minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const parts = time.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// Main utilization calculation
// ---------------------------------------------------------------------------

/**
 * Calculate utilization for each resource over a date range.
 *
 * For each resource:
 * 1. Sum available hours from the availability schedule within the range
 * 2. Sum booked hours from non-cancelled bookings
 * 3. Utilization = (booked / available) * 100, capped at 100
 */
export function calculateUtilization(
  resources: ResourceInfo[],
  availability: AvailabilityRow[],
  bookings: AnalyticsBooking[],
  from: string,
  to: string
): ResourceUtilization[] {
  // Pre-index availability rows by resource_id
  const availByResource = new Map<string, AvailabilityRow[]>();
  for (const row of availability) {
    const existing = availByResource.get(row.resource_id);
    if (existing) {
      existing.push(row);
    } else {
      availByResource.set(row.resource_id, [row]);
    }
  }

  // Pre-index booked hours by resource_id (exclude cancelled)
  const bookedByResource = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    bookedByResource.set(
      b.resource_id,
      (bookedByResource.get(b.resource_id) ?? 0) + b.duration_hours
    );
  }

  // Generate all days in the range
  const days = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  });

  const results: ResourceUtilization[] = [];

  for (const resource of resources) {
    const resourceAvail = availByResource.get(resource.id) ?? [];

    // Index availability slots by day_of_week for fast lookup
    const slotsByDay = new Map<string, AvailabilityRow[]>();
    for (const slot of resourceAvail) {
      const existing = slotsByDay.get(slot.day_of_week);
      if (existing) {
        existing.push(slot);
      } else {
        slotsByDay.set(slot.day_of_week, [slot]);
      }
    }

    // Sum available minutes across all days
    let availableMinutes = 0;
    for (const day of days) {
      const dayName = DAY_MAP[getDay(day)];
      const slots = slotsByDay.get(dayName);
      if (!slots) continue;

      for (const slot of slots) {
        const startMin = timeToMinutes(slot.start_time);
        const endMin = timeToMinutes(slot.end_time);
        availableMinutes += endMin - startMin;
      }
    }

    const availableHours = availableMinutes / 60;
    const bookedHours = bookedByResource.get(resource.id) ?? 0;
    const utilization =
      availableHours > 0
        ? Math.min((bookedHours / availableHours) * 100, 100)
        : 0;

    results.push({
      resourceName: resource.name,
      availableHours,
      bookedHours,
      utilization,
    });
  }

  return results.sort((a, b) => b.utilization - a.utilization);
}

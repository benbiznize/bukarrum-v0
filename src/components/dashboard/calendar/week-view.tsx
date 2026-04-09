"use client";

import { useMemo } from "react";
import {
  startOfWeek,
  addDays,
  isToday,
  format,
  parseISO,
  getHours,
  getMinutes,
} from "date-fns";
import { es, enUS, type Locale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DATE_LOCALES: Record<string, Locale> = { es, en: enUS };
import type { CalendarBooking } from "@/components/dashboard/calendar/calendar-types";
import type { RESOURCE_COLORS } from "@/components/dashboard/calendar/resource-colors";
import { BookingBlock } from "@/components/dashboard/calendar/booking-block";

const START_HOUR = 7;
const END_HOUR = 23;
const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = END_HOUR - START_HOUR;

interface WeekViewProps {
  bookings: CalendarBooking[];
  currentDate: Date;
  resourceColorMap: Map<string, (typeof RESOURCE_COLORS)[number]>;
  dict: Record<string, unknown>;
  locale: string;
}

/**
 * Pack overlapping bookings into columns to avoid visual overlap.
 * Returns each booking with its column index and total columns in its group.
 */
function packColumns(dayBookings: CalendarBooking[]) {
  if (dayBookings.length === 0) return [];

  // Sort by start time, then by duration (longer first)
  const sorted = [...dayBookings].sort((a, b) => {
    const diff = a.start_time.localeCompare(b.start_time);
    if (diff !== 0) return diff;
    return b.duration_hours - a.duration_hours;
  });

  const columns: CalendarBooking[][] = [];

  for (const booking of sorted) {
    const startA = new Date(booking.start_time).getTime();

    let placed = false;
    for (let col = 0; col < columns.length; col++) {
      const lastInCol = columns[col][columns[col].length - 1];
      const endB = new Date(lastInCol.end_time).getTime();
      if (startA >= endB) {
        columns[col].push(booking);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([booking]);
    }
  }

  const totalColumns = columns.length;
  const result: {
    booking: CalendarBooking;
    column: number;
    totalColumns: number;
  }[] = [];

  columns.forEach((col, colIndex) => {
    for (const booking of col) {
      result.push({ booking, column: colIndex, totalColumns });
    }
  });

  return result;
}

export function WeekView({
  bookings,
  currentDate,
  resourceColorMap,
  dict,
  locale,
}: WeekViewProps) {
  const calendarView = dict.calendarView as Record<string, string>;
  const dayLabels = dict.dayLabels as Record<string, string>;
  const dateFnsLocale = DATE_LOCALES[locale] ?? es;

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate]
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Short day name keys for dict
  const dayKeys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i),
    []
  );

  // Group bookings by day (YYYY-MM-DD)
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const dayKey = b.start_time.split("T")[0];
      const arr = map.get(dayKey) ?? [];
      arr.push(b);
      map.set(dayKey, arr);
    }
    return map;
  }, [bookings]);

  // Current time indicator position
  const now = new Date();
  const nowMinutes = getHours(now) * 60 + getMinutes(now);
  const nowTop = (nowMinutes - START_HOUR * 60) * (HOUR_HEIGHT / 60);
  const showNowLine =
    nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b">
        <div className="border-r" />
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col items-center py-2 text-xs border-r last:border-r-0",
              isToday(day) && "bg-primary/5"
            )}
          >
            <span className="text-muted-foreground font-medium uppercase">
              {dayLabels[dayKeys[i]]?.slice(0, 3) ?? format(day, "EEE", { locale: dateFnsLocale })}
            </span>
            <span
              className={cn(
                "mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) && "bg-primary text-primary-foreground"
              )}
            >
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: `${HOUR_HEIGHT * 10}px` }}
      >
        <div
          className="grid grid-cols-[4rem_repeat(7,1fr)] relative"
          style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
        >
          {/* Time gutter */}
          <div className="border-r">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative border-b text-[10px] text-muted-foreground pr-2 text-right"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="absolute -top-2 right-2">
                  {format(new Date(2000, 0, 1, hour), "HH:mm")}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayBookings = bookingsByDay.get(dateKey) ?? [];
            const packed = packColumns(dayBookings);

            return (
              <div
                key={dayIndex}
                className={cn(
                  "relative border-r last:border-r-0",
                  isToday(day) && "bg-accent/5"
                )}
              >
                {/* Hour grid lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Current time indicator */}
                {showNowLine && isToday(day) && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="relative">
                      <div className="absolute -left-1 -top-[3px] size-[7px] rounded-full bg-destructive" />
                      <div className="h-[1.5px] bg-destructive w-full" />
                    </div>
                  </div>
                )}

                {/* Booking blocks */}
                {packed.map(({ booking, column, totalColumns }) => {
                  const start = parseISO(booking.start_time);
                  const startMinutes =
                    getHours(start) * 60 + getMinutes(start);
                  const durationMinutes = booking.duration_hours * 60;

                  const top =
                    (startMinutes - START_HOUR * 60) * (HOUR_HEIGHT / 60);
                  const height = durationMinutes * (HOUR_HEIGHT / 60);
                  const width = `${100 / totalColumns}%`;
                  const left = `${(column * 100) / totalColumns}%`;

                  const color = resourceColorMap.get(booking.resource_id);

                  return (
                    <BookingBlock
                      key={booking.id}
                      booking={booking}
                      color={color}
                      style={{ top, height, left, width }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {bookings.length === 0 && (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {calendarView.noBookings}
        </div>
      )}
    </div>
  );
}

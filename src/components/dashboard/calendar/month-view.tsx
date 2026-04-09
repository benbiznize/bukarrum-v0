"use client";

import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarBooking } from "@/components/dashboard/calendar/calendar-types";
import type { RESOURCE_COLORS } from "@/components/dashboard/calendar/resource-colors";

const MAX_DOTS = 3;

interface MonthViewProps {
  bookings: CalendarBooking[];
  currentDate: Date;
  resourceColorMap: Map<string, (typeof RESOURCE_COLORS)[number]>;
  onDayClick: (date: Date) => void;
  dict: Record<string, unknown>;
}

export function MonthView({
  bookings,
  currentDate,
  resourceColorMap,
  onDayClick,
  dict,
}: MonthViewProps) {
  const calendarView = dict.calendarView as Record<string, string>;
  const dayLabels = dict.dayLabels as Record<string, string>;

  const dayKeys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // Generate all days in the grid
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentDate]);

  // Group bookings by date string for O(1) lookup
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const dateKey = b.start_time.split("T")[0];
      const arr = map.get(dateKey) ?? [];
      arr.push(b);
      map.set(dateKey, arr);
    }
    return map;
  }, [bookings]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b">
        {dayKeys.map((key) => (
          <div
            key={key}
            className="py-2 text-center text-xs font-medium text-muted-foreground uppercase border-r last:border-r-0"
          >
            {dayLabels[key]?.slice(0, 3)}
          </div>
        ))}
      </div>

      {/* Day cells grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayBookings = bookingsByDate.get(dateKey) ?? [];
          const hasBookings = dayBookings.length > 0;
          const inCurrentMonth = isSameMonth(day, currentDate);

          // Collect unique resource colors for dots
          const uniqueResourceColors = new Map<
            string,
            (typeof RESOURCE_COLORS)[number]
          >();
          for (const b of dayBookings) {
            if (uniqueResourceColors.size >= MAX_DOTS) break;
            const color = resourceColorMap.get(b.resource_id);
            if (color && !uniqueResourceColors.has(b.resource_id)) {
              uniqueResourceColors.set(b.resource_id, color);
            }
          }
          const dots = Array.from(uniqueResourceColors.values());
          const overflowCount = dayBookings.length - dots.length;

          return (
            <div
              key={i}
              className={cn(
                "relative min-h-[80px] border-r border-b last:border-r-0 p-1.5 text-sm transition-colors",
                !inCurrentMonth && "text-muted-foreground/50 bg-muted/30",
                hasBookings && "cursor-pointer hover:bg-accent/10"
              )}
              onClick={() => {
                if (hasBookings) onDayClick(day);
              }}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isToday(day) &&
                    "ring-2 ring-primary bg-primary text-primary-foreground",
                  !isToday(day) && inCurrentMonth && "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Resource dots */}
              {dots.length > 0 && (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                  {dots.map((color, idx) => (
                    <span
                      key={idx}
                      className={cn("size-2 rounded-full", color.dot)}
                    />
                  ))}
                  {overflowCount > 0 && (
                    <span className="text-[9px] text-muted-foreground font-medium">
                      +{overflowCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
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

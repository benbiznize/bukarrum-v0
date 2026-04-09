"use client";

import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarBooking } from "@/components/dashboard/calendar/calendar-types";
import type { RESOURCE_COLORS } from "@/components/dashboard/calendar/resource-colors";

interface BookingBlockProps {
  booking: CalendarBooking;
  color: (typeof RESOURCE_COLORS)[number] | undefined;
  style: { top: number; height: number; left: string; width: string };
}

export function BookingBlock({
  booking,
  color,
  style,
}: BookingBlockProps) {
  const startTime = format(parseISO(booking.start_time), "HH:mm");
  const endTime = format(parseISO(booking.end_time), "HH:mm");

  const isPending = booking.status === "pending";
  const isCancelled = booking.status === "cancelled";
  const isCompleted = booking.status === "completed";

  return (
    <div
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-[10px] leading-tight cursor-default",
        color?.bg ?? "bg-muted",
        color?.text ?? "text-foreground",
        isPending && "border-dashed",
        !isPending && "border-solid",
        isCancelled && "opacity-50",
        isCompleted && "opacity-75",
        color?.border ?? "border-l-border"
      )}
      style={{
        top: `${style.top}px`,
        height: `${style.height}px`,
        left: style.left,
        width: style.width,
        minHeight: "20px",
      }}
      title={`${booking.resource_name} — ${booking.booker_name} (${startTime}–${endTime})`}
    >
      <div className="font-medium truncate">
        {startTime}–{endTime}
      </div>
      {style.height >= 36 && (
        <div className="truncate">{booking.resource_name}</div>
      )}
      {style.height >= 52 && (
        <div className="truncate text-[9px] opacity-80">
          {booking.booker_name}
        </div>
      )}
    </div>
  );
}

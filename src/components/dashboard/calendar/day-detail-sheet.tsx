"use client";

import { format, parseISO } from "date-fns";
import { es, enUS, type Locale } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarBooking } from "@/components/dashboard/calendar/calendar-types";
import type { RESOURCE_COLORS } from "@/components/dashboard/calendar/resource-colors";

const DATE_LOCALES: Record<string, Locale> = { es, en: enUS };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  bookings: CalendarBooking[];
  resourceColorMap: Map<string, (typeof RESOURCE_COLORS)[number]>;
  dict: Record<string, unknown>;
  locale: string;
}

export function DayDetailSheet({
  open,
  onOpenChange,
  date,
  bookings,
  resourceColorMap,
  dict,
  locale,
}: DayDetailSheetProps) {
  const statusLabels = dict.statusLabels as Record<string, string>;
  const dateFnsLocale = DATE_LOCALES[locale] ?? es;

  const sortedBookings = [...bookings].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {date
              ? format(date, locale === "es" ? "EEEE d 'de' MMMM yyyy" : "EEEE, MMMM d, yyyy", { locale: dateFnsLocale })
              : ""}
          </SheetTitle>
          <SheetDescription>
            {sortedBookings.length}{" "}
            {sortedBookings.length === 1
              ? (dict.bookings as string)?.slice(0, -1) ?? "reserva"
              : (dict.bookings as string) ?? "reservas"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {sortedBookings.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {(dict.calendarView as Record<string, string>).noBookings}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const color = resourceColorMap.get(booking.resource_id);
                const startTime = format(
                  parseISO(booking.start_time),
                  "HH:mm"
                );
                const endTime = format(parseISO(booking.end_time), "HH:mm");

                return (
                  <div
                    key={booking.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    {/* Time + Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {startTime} – {endTime}
                      </span>
                      <Badge
                        variant={
                          STATUS_VARIANT[booking.status] ?? "outline"
                        }
                      >
                        {statusLabels[booking.status] ?? booking.status}
                      </Badge>
                    </div>

                    {/* Resource */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          color?.dot ?? "bg-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-medium">
                        {booking.resource_name}
                      </span>
                    </div>

                    {/* Booker */}
                    <div className="text-sm text-muted-foreground">
                      <div>{booking.booker_name}</div>
                      <div className="text-xs">{booking.booker_email}</div>
                    </div>

                    {/* Duration + Price */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {booking.duration_hours}h
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCLP(booking.total_price)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

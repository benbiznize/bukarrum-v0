"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { getAvailableDates } from "@/app/(booking)/[tenantSlug]/actions";
import { es } from "react-day-picker/locale";
import { useDict } from "@/lib/i18n/dict-context";

export function StepDate({
  resourceId,
  timezone,
  dispatch,
}: {
  resourceId: string;
  timezone: string;
  dispatch: React.Dispatch<{ type: "SELECT_DATE"; date: string }>;
}) {
  const { booking } = useDict();
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAvailableDates(resourceId, timezone).then((dates) => {
      setAvailableDates(new Set(dates));
      setLoading(false);
    });
  }, [resourceId, timezone]);

  if (loading) {
    return <Skeleton className="h-[300px] w-full rounded-xl" />;
  }

  if (availableDates.size === 0) {
    return <p className="text-muted-foreground text-center py-8">{booking.noAvailability}</p>;
  }

  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{booking.selectDate}</h2>
      <div className="flex justify-center">
        <Calendar
          mode="single"
          locale={es}
          disabled={(date) => {
            const dateStr = date.toLocaleDateString("sv-SE");
            return !availableDates.has(dateStr);
          }}
          fromDate={today}
          toDate={maxDate}
          onSelect={(date) => {
            if (date) {
              const dateStr = date.toLocaleDateString("sv-SE");
              dispatch({ type: "SELECT_DATE", date: dateStr });
            }
          }}
        />
      </div>
    </div>
  );
}

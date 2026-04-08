"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTimeSlots } from "@/app/(booking)/[tenantSlug]/actions";

type TimeSlot = {
  startTime: string;
  availableUntil: string;
};

export function StepTime({
  resourceId,
  date,
  timezone,
  dispatch,
}: {
  resourceId: string;
  date: string;
  timezone: string;
  dispatch: React.Dispatch<{ type: "SELECT_TIME"; startTime: string; availableUntil: string }>;
}) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTimeSlots(resourceId, date, timezone).then((data) => {
      setSlots(data);
      setLoading(false);
    });
  }, [resourceId, date, timezone]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return <p className="text-muted-foreground text-center py-8">No hay horarios disponibles para esta fecha</p>;
  }

  // Format date for display
  const dateDisplay = new Date(date + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Selecciona una hora</h2>
      <p className="text-sm text-muted-foreground mb-4 capitalize">{dateDisplay}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {slots.map((slot) => (
          <Button
            key={slot.startTime}
            variant="outline"
            className="h-10"
            onClick={() =>
              dispatch({
                type: "SELECT_TIME",
                startTime: slot.startTime,
                availableUntil: slot.availableUntil,
              })
            }
          >
            {slot.startTime}
          </Button>
        ))}
      </div>
    </div>
  );
}

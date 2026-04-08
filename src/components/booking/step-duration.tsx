"use client";

import { Button } from "@/components/ui/button";
import type { BookingState } from "./booking-flow";

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function StepDuration({
  state,
  dispatch,
}: {
  state: BookingState;
  dispatch: React.Dispatch<{ type: "SELECT_DURATION"; durationHours: number }>;
}) {
  const { startTime, availableUntil, minDuration, maxDuration, hourlyRate } = state;

  if (!startTime || !availableUntil || !minDuration || !maxDuration || !hourlyRate) return null;

  const [startH] = startTime.split(":").map(Number);
  const [untilH] = availableUntil.split(":").map(Number);
  const maxAvailable = untilH - startH;

  const effectiveMin = Math.max(minDuration, 1);
  const effectiveMax = Math.min(maxDuration, maxAvailable);

  const options: number[] = [];
  for (let h = effectiveMin; h <= effectiveMax; h++) {
    options.push(h);
  }

  if (options.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Selecciona la duración</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {fmt.format(hourlyRate)} por hora
      </p>
      <div className="grid gap-2">
        {options.map((h) => (
          <Button
            key={h}
            variant="outline"
            className="justify-between h-auto py-3 px-4"
            onClick={() => dispatch({ type: "SELECT_DURATION", durationHours: h })}
          >
            <span>{h} {h === 1 ? "hora" : "horas"}</span>
            <span className="font-semibold text-primary">{fmt.format(hourlyRate * h)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

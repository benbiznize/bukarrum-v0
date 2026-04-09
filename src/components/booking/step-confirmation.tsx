"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";
import type { BookingState } from "./booking-flow";

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function StepConfirmation({ state }: { state: BookingState }) {
  const resourcePrice = (state.hourlyRate ?? 0) * (state.durationHours ?? 0);
  const addOnsPrice = state.selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const totalPrice = resourcePrice + addOnsPrice;

  const dateDisplay = state.date
    ? new Date(state.date + "T12:00:00").toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      </div>
      <h2 className="text-xl font-bold mb-1">¡Reserva creada!</h2>
      <p className="text-muted-foreground mb-6">
        Te contactaremos para confirmar tu reserva.
      </p>

      <Card>
        <CardContent className="p-4 space-y-2 text-sm text-left">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Local</span>
            <span className="font-medium">{state.locationName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recurso</span>
            <span className="font-medium">{state.resourceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fecha</span>
            <span className="font-medium capitalize">{dateDisplay}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Hora</span>
            <span className="font-medium">{state.startTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duración</span>
            <span className="font-medium">
              {state.durationHours} {state.durationHours === 1 ? "hora" : "horas"}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recurso</span>
            <span className="font-medium">{fmt.format(resourcePrice)}</span>
          </div>
          {state.selectedAddOns.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span className="text-muted-foreground">{a.name}</span>
              <span className="font-medium">{fmt.format(a.price)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="text-primary">{fmt.format(totalPrice)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

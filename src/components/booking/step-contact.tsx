"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createBooking } from "@/app/(booking)/[tenantSlug]/actions";
import type { BookingState } from "./booking-flow";

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function StepContact({
  state,
  dispatch,
}: {
  state: BookingState;
  dispatch: React.Dispatch<
    | { type: "BOOKING_COMPLETE" }
    | { type: "SET_ERROR"; error: string }
    | { type: "GO_BACK" }
  >;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = (state.hourlyRate ?? 0) * (state.durationHours ?? 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("resourceId", state.resourceId!);
    formData.set("locationId", state.locationId!);
    formData.set("date", state.date!);
    formData.set("startTime", state.startTime!);
    formData.set("durationHours", String(state.durationHours));
    formData.set("timezone", state.locationTimezone!);

    const result = await createBooking(formData);

    setLoading(false);

    if (result.error) {
      if (result.error === "BOOKING_CONFLICT") {
        setError("Este horario ya no está disponible. Elige otro.");
      } else {
        setError(result.error);
      }
      return;
    }

    dispatch({ type: "BOOKING_COMPLETE" });
  }

  // Format date for display
  const dateDisplay = state.date
    ? new Date(state.date + "T12:00:00").toLocaleDateString("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Confirmar reserva</h2>

      <Card className="mb-6">
        <CardContent className="p-4 space-y-2 text-sm">
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
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="text-primary">{fmt.format(totalPrice)}</span>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            name="name"
            placeholder="Tu nombre completo"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@correo.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+56 9 1234 5678"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Reservando..." : "Confirmar reserva"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFirstLocation } from "@/app/(auth)/onboarding/location/actions";

export function OnboardingLocationForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string }, formData: FormData) => {
      const result = await createFirstLocation(formData);
      return result ?? { error: "" };
    },
    { error: "" }
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Agrega tu primera ubicación</CardTitle>
        <CardDescription>
          ¿Dónde se encuentra tu estudio o local?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre de la ubicación</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Sede Providencia"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              name="address"
              placeholder="Ej: Av. Providencia 1234"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                name="city"
                placeholder="Ej: Santiago"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando..." : "Continuar"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Paso 2 de 3
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

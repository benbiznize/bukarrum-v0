"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFirstResource } from "@/app/(auth)/onboarding/resource/actions";

export function OnboardingResourceForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string }, formData: FormData) => {
      const result = await createFirstResource(formData);
      return result ?? { error: "" };
    },
    { error: "" }
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Agrega tu primer recurso</CardTitle>
        <CardDescription>
          ¿Qué pueden reservar tus clientes?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del recurso</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Sala de Ensayo DJ"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Equipamiento, dimensiones, detalles..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue="room">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room" label="Sala">Sala</SelectItem>
                <SelectItem value="equipment" label="Equipamiento">Equipamiento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hourly_rate">Tarifa por hora (CLP)</Label>
            <Input
              id="hourly_rate"
              name="hourly_rate"
              type="number"
              min="0"
              step="1000"
              placeholder="15000"
              required
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando..." : "Finalizar configuración"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Paso 3 de 3
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

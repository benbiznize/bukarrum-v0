"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "./image-upload";

type LocationData = {
  id?: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  timezone: string;
  image_url: string | null;
  is_active: boolean;
};

export function LocationForm({
  location,
  tenantId,
  action,
}: {
  location?: LocationData;
  tenantId: string;
  action: (
    prev: { error: string },
    formData: FormData
  ) => Promise<{ error: string }>;
}) {
  const isEditing = !!location;
  const [state, formAction, isPending] = useActionState(action, { error: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(location?.image_url ?? null);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{isEditing ? "Editar ubicación" : "Nueva ubicación"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Imagen</Label>
            <ImageUpload
              tenantId={tenantId}
              value={imageUrl}
              onChange={setImageUrl}
              folder="locations"
            />
            <input type="hidden" name="image_url" value={imageUrl ?? ""} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Sede Providencia"
              defaultValue={location?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              name="address"
              placeholder="Ej: Av. Providencia 1234"
              defaultValue={location?.address ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                name="city"
                placeholder="Santiago"
                defaultValue={location?.city ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+56 9 1234 5678"
                defaultValue={location?.phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="timezone">Zona horaria</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={location?.timezone ?? "America/Santiago"}
              readOnly
              className="text-muted-foreground"
            />
          </div>

          {isEditing && (
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={location?.is_active ?? true}
              />
              <Label htmlFor="is_active">Ubicación activa</Label>
            </div>
          )}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Guardando..."
              : isEditing
                ? "Guardar cambios"
                : "Crear ubicación"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

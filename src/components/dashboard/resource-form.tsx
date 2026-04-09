"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "./image-upload";

type ResourceData = {
  id?: string;
  name: string;
  description: string | null;
  type: "room" | "equipment";
  hourly_rate: number;
  min_duration_hours: number;
  max_duration_hours: number;
  image_url: string | null;
  is_active: boolean;
};

export function ResourceForm({
  resource,
  tenantId,
  action,
}: {
  resource?: ResourceData;
  tenantId: string;
  action: (
    prev: { error: string },
    formData: FormData
  ) => Promise<{ error: string }>;
}) {
  const isEditing = !!resource;
  const [state, formAction, isPending] = useActionState(action, { error: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(resource?.image_url ?? null);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{isEditing ? "Editar recurso" : "Nuevo recurso"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Imagen</Label>
            <ImageUpload
              tenantId={tenantId}
              value={imageUrl}
              onChange={setImageUrl}
              folder="resources"
            />
            <input type="hidden" name="image_url" value={imageUrl ?? ""} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Sala de Ensayo DJ"
              defaultValue={resource?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Equipamiento, dimensiones, detalles..."
              defaultValue={resource?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue={resource?.type ?? "room"}>
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
              defaultValue={resource?.hourly_rate ?? ""}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="min_duration_hours">Duración mínima (h)</Label>
              <Input
                id="min_duration_hours"
                name="min_duration_hours"
                type="number"
                min="1"
                max="24"
                defaultValue={resource?.min_duration_hours ?? 1}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="max_duration_hours">Duración máxima (h)</Label>
              <Input
                id="max_duration_hours"
                name="max_duration_hours"
                type="number"
                min="1"
                max="24"
                defaultValue={resource?.max_duration_hours ?? 8}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                name="is_active"
                defaultChecked={resource?.is_active ?? true}
              />
              <Label htmlFor="is_active">Recurso activo</Label>
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
                : "Crear recurso"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

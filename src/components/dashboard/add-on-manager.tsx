"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createAddOn,
  updateAddOn,
  deleteAddOn,
} from "@/app/(dashboard)/dashboard/[tenantSlug]/[locationSlug]/add-ons/actions";

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  hourly_rate: number;
  is_active: boolean;
};

const fmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

export function AddOnManager({
  addOns,
  tenantSlug,
  locationSlug,
  locationId,
  enabled,
}: {
  addOns: AddOn[];
  tenantSlug: string;
  locationSlug: string;
  locationId: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editing
      ? await updateAddOn(tenantSlug, locationSlug, editing.id, formData)
      : await createAddOn(tenantSlug, locationSlug, locationId, formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este servicio adicional?")) return;
    await deleteAddOn(tenantSlug, locationSlug, id);
  }

  function openCreate() {
    setEditing(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(addOn: AddOn) {
    setEditing(addOn);
    setError(null);
    setOpen(true);
  }

  if (!enabled) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Los servicios adicionales están disponibles en el plan Pro o superior.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Servicios adicionales</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar servicio" : "Nuevo servicio adicional"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addon-name">Nombre</Label>
                <Input
                  id="addon-name"
                  name="name"
                  placeholder="Ej: Ingeniero de Sonido"
                  defaultValue={editing?.name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addon-desc">Descripción</Label>
                <Textarea
                  id="addon-desc"
                  name="description"
                  placeholder="Detalles del servicio..."
                  defaultValue={editing?.description ?? ""}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addon-rate">Tarifa por hora (CLP)</Label>
                <Input
                  id="addon-rate"
                  name="hourly_rate"
                  type="number"
                  min="0"
                  step="1000"
                  defaultValue={editing?.hourly_rate ?? ""}
                  required
                />
              </div>
              {editing && (
                <div className="flex items-center gap-3">
                  <Switch
                    id="addon-active"
                    name="is_active"
                    defaultChecked={editing.is_active}
                  />
                  <Label htmlFor="addon-active">Activo</Label>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : editing ? "Guardar" : "Crear"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {addOns.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tarifa/hora</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {addOns.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{a.name}</span>
                      {a.description && (
                        <p className="text-xs text-muted-foreground">
                          {a.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{fmt.format(a.hourly_rate)}</TableCell>
                  <TableCell>
                    <Badge variant={a.is_active ? "default" : "secondary"}>
                      {a.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Agrega servicios como ingenieros de sonido, fotógrafos, etc.
          </p>
        </div>
      )}
    </div>
  );
}

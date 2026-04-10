"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/app/(dashboard)/dashboard/[tenantSlug]/[locationSlug]/resources/[resourceId]/actions";
import { useDict } from "@/lib/i18n/dict-context";

type PricingMode = "hourly" | "flat";

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  pricing_mode: PricingMode;
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
  resourceId,
  enabled,
}: {
  addOns: AddOn[];
  tenantSlug: string;
  locationSlug: string;
  resourceId: string;
  enabled: boolean;
}) {
  const { dashboard, common } = useDict();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Local state so the unit label (per-hour vs flat) tracks the user's
  // current mode selection before they submit.
  const [mode, setMode] = useState<PricingMode>("hourly");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = editing
      ? await updateAddOn(tenantSlug, locationSlug, resourceId, editing.id, formData)
      : await createAddOn(tenantSlug, locationSlug, resourceId, formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(dashboard.addOns.deleteConfirm)) return;
    await deleteAddOn(tenantSlug, locationSlug, resourceId, id);
  }

  function openCreate() {
    setEditing(null);
    setMode("hourly");
    setError(null);
    setOpen(true);
  }

  function openEdit(addOn: AddOn) {
    setEditing(addOn);
    setMode(addOn.pricing_mode);
    setError(null);
    setOpen(true);
  }

  function formatPrice(a: AddOn) {
    const base = fmt.format(a.unit_price);
    return a.pricing_mode === "hourly"
      ? `${base}${dashboard.addOns.perHourSuffix}`
      : `${base} · ${dashboard.addOns.flatSuffix}`;
  }

  if (!enabled) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center">
        <p className="text-muted-foreground text-sm">
          {dashboard.addOns.proRequired}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{dashboard.addOns.title}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            {dashboard.addOns.add}
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? dashboard.addOns.editService : dashboard.addOns.newService}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addon-name">{common.name}</Label>
                <Input
                  id="addon-name"
                  name="name"
                  placeholder={dashboard.addOnNamePlaceholder}
                  defaultValue={editing?.name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addon-desc">{common.description}</Label>
                <Textarea
                  id="addon-desc"
                  name="description"
                  placeholder={dashboard.addOnDescPlaceholder}
                  defaultValue={editing?.description ?? ""}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addon-mode">{dashboard.addOns.pricingMode}</Label>
                <Select
                  name="pricing_mode"
                  value={mode}
                  onValueChange={(v) => setMode(v as PricingMode)}
                >
                  <SelectTrigger id="addon-mode">
                    <SelectValue>
                      {(value: string) =>
                        value === "flat"
                          ? dashboard.addOns.modeFlat
                          : dashboard.addOns.modeHourly
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">
                      {dashboard.addOns.modeHourly}
                    </SelectItem>
                    <SelectItem value="flat">
                      {dashboard.addOns.modeFlat}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addon-price">
                  {dashboard.addOns.unitPriceCLP}
                </Label>
                <Input
                  id="addon-price"
                  name="unit_price"
                  type="number"
                  min="0"
                  step="500"
                  defaultValue={editing?.unit_price ?? ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {mode === "hourly"
                    ? dashboard.addOns.unitPriceHintHourly
                    : dashboard.addOns.unitPriceHintFlat}
                </p>
              </div>
              {editing && (
                <div className="flex items-center gap-3">
                  <Switch
                    id="addon-active"
                    name="is_active"
                    defaultChecked={editing.is_active}
                  />
                  <Label htmlFor="addon-active">{common.active}</Label>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? common.saving : editing ? common.save : common.creating}
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
                <TableHead>{common.name}</TableHead>
                <TableHead>{dashboard.addOns.price}</TableHead>
                <TableHead>{common.status}</TableHead>
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
                  <TableCell className="whitespace-nowrap">
                    {formatPrice(a)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.is_active ? "default" : "secondary"}>
                      {a.is_active ? common.active : common.inactive}
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
            {dashboard.addOns.emptyHint}
          </p>
        </div>
      )}
    </div>
  );
}

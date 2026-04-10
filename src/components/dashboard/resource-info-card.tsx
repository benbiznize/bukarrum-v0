"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResourceForm } from "./resource-form";
import { useDict } from "@/lib/i18n/dict-context";

type Resource = {
  id: string;
  name: string;
  description: string | null;
  type: "room" | "equipment";
  hourly_rate: number;
  min_duration_hours: number;
  max_duration_hours: number;
  image_url: string | null;
  is_active: boolean;
};

export function ResourceInfoCard({
  resource,
  tenantId,
  action,
}: {
  resource: Resource;
  tenantId: string;
  action: (
    prev: { error: string; success?: boolean },
    formData: FormData
  ) => Promise<{ error: string; success?: boolean }>;
}) {
  const { dashboard, common, auth, booking } = useDict();
  const [open, setOpen] = useState(false);

  const fmt = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  });

  return (
    <>
      <div className="space-y-4">
        {resource.image_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-md border">
            <Image
              src={resource.image_url}
              alt={resource.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </div>
        )}

        {resource.description && (
          <p className="text-sm text-muted-foreground">{resource.description}</p>
        )}

        <dl className="grid gap-2 text-sm">
          <InfoRow label={auth.type} value={resource.type === "room" ? common.room : common.equipment} />
          <InfoRow label={common.hourlyRateCLP} value={fmt.format(resource.hourly_rate)} />
          <InfoRow
            label={booking.duration}
            value={`${resource.min_duration_hours}–${resource.max_duration_hours}h`}
          />
          <InfoRow
            label={common.status}
            value={resource.is_active ? common.active : common.inactive}
          />
        </dl>
      </div>

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1"
        >
          <Pencil className="h-3.5 w-3.5" />
          {dashboard.editResource}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dashboard.editResource}</DialogTitle>
          </DialogHeader>
          <ResourceForm
            resource={resource}
            tenantId={tenantId}
            action={action}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

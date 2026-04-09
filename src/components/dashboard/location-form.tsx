"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "./image-upload";
import { useDict } from "@/lib/i18n/dict-context";

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
  const { dashboard, common } = useDict();
  const isEditing = !!location;
  const [state, formAction, isPending] = useActionState(action, { error: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(location?.image_url ?? null);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{isEditing ? dashboard.editLocation : dashboard.createLocation}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{common.image}</Label>
            <ImageUpload
              tenantId={tenantId}
              value={imageUrl}
              onChange={setImageUrl}
              folder="locations"
            />
            <input type="hidden" name="image_url" value={imageUrl ?? ""} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">{common.name}</Label>
            <Input
              id="name"
              name="name"
              placeholder={dashboard.namePlaceholder}
              defaultValue={location?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">{common.address}</Label>
            <Input
              id="address"
              name="address"
              placeholder={dashboard.addressPlaceholder}
              defaultValue={location?.address ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">{common.city}</Label>
              <Input
                id="city"
                name="city"
                placeholder={dashboard.cityPlaceholder}
                defaultValue={location?.city ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">{common.phone}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder={dashboard.phonePlaceholder}
                defaultValue={location?.phone ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="timezone">{dashboard.timezone}</Label>
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
              <Label htmlFor="is_active">{dashboard.locationActive}</Label>
            </div>
          )}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending
              ? common.saving
              : isEditing
                ? dashboard.saveChanges
                : dashboard.createLocation}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

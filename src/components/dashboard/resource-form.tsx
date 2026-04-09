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
import { useDict } from "@/lib/i18n/dict-context";

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
  const { dashboard, common, auth } = useDict();
  const isEditing = !!resource;
  const [state, formAction, isPending] = useActionState(action, { error: "" });
  const [imageUrl, setImageUrl] = useState<string | null>(resource?.image_url ?? null);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{isEditing ? dashboard.editResource : dashboard.createResource}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{common.image}</Label>
            <ImageUpload
              tenantId={tenantId}
              value={imageUrl}
              onChange={setImageUrl}
              folder="resources"
            />
            <input type="hidden" name="image_url" value={imageUrl ?? ""} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">{common.name}</Label>
            <Input
              id="name"
              name="name"
              placeholder={dashboard.resourceNamePlaceholder}
              defaultValue={resource?.name ?? ""}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{common.description}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={dashboard.descriptionPlaceholder}
              defaultValue={resource?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">{auth.type}</Label>
            <Select name="type" defaultValue={resource?.type ?? "room"}>
              <SelectTrigger>
                <SelectValue>
                  {(value: string) => value === "equipment" ? common.equipment : common.room}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room">{common.room}</SelectItem>
                <SelectItem value="equipment">{common.equipment}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="hourly_rate">{common.hourlyRateCLP}</Label>
            <Input
              id="hourly_rate"
              name="hourly_rate"
              type="number"
              min="0"
              step="1000"
              placeholder={dashboard.ratePlaceholder}
              defaultValue={resource?.hourly_rate ?? ""}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="min_duration_hours">{dashboard.minDuration}</Label>
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
              <Label htmlFor="max_duration_hours">{dashboard.maxDuration}</Label>
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
              <Label htmlFor="is_active">{dashboard.resourceActive}</Label>
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
                : dashboard.createResource}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

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
import { useDict } from "@/lib/i18n/dict-context";

export function OnboardingResourceForm() {
  const { auth, common } = useDict();
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
        <CardTitle className="text-2xl">{auth.onboardingResourceTitle}</CardTitle>
        <CardDescription>
          {auth.onboardingResourceSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{auth.resourceName}</Label>
            <Input
              id="name"
              name="name"
              placeholder={auth.resourceNamePlaceholder}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{common.description}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={auth.descriptionPlaceholder}
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">{auth.type}</Label>
            <Select name="type" defaultValue="room">
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
              placeholder={auth.ratePlaceholder}
              required
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? common.creating : auth.finishSetup}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {auth.step3of3}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

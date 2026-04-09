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
import { useDict } from "@/lib/i18n/dict-context";

export function OnboardingLocationForm() {
  const { auth, common } = useDict();
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
        <CardTitle className="text-2xl">{auth.onboardingLocationTitle}</CardTitle>
        <CardDescription>
          {auth.onboardingLocationSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{auth.locationName}</Label>
            <Input
              id="name"
              name="name"
              placeholder={auth.locationNamePlaceholder}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">{common.address}</Label>
            <Input
              id="address"
              name="address"
              placeholder={auth.addressPlaceholder}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="city">{common.city}</Label>
              <Input
                id="city"
                name="city"
                placeholder={auth.cityPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">{common.phone}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder={auth.phonePlaceholder}
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? common.creating : auth.continue}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {auth.step2of3}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

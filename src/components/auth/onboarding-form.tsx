"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createTenant } from "@/app/(auth)/onboarding/actions";
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
import type { PlanFeatures } from "@/lib/types/plan-features";
import type { Json } from "@/lib/supabase/database.types";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_annual: number;
  features: Json;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function OnboardingForm({ plans }: { plans: Plan[] }) {
  const [name, setName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(plans[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string }, formData: FormData) => {
      const result = await createTenant(formData);
      // If createTenant succeeds, it redirects — we only get here on error
      return result ?? { error: "" };
    },
    { error: "" }
  );

  const slug = slugify(name);

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Crea tu negocio</CardTitle>
        <CardDescription>Configura tu espacio en Bukarrum</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-6">
          {/* Business name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre del negocio</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Estudio Sónico"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                Tu URL será:{" "}
                <span className="font-mono text-foreground">
                  bukarrum.com/{slug}
                </span>
              </p>
            )}
          </div>

          {/* Plan selection */}
          <div className="grid gap-3">
            <Label>Selecciona tu plan</Label>
            <div className="grid gap-3">
              {plans.map((plan) => {
                const features = plan.features as unknown as PlanFeatures;
                return (
                  <label
                    key={plan.id}
                    className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
                      selectedPlan === plan.id
                        ? "border-primary bg-accent/50"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="planId"
                      value={plan.id}
                      checked={selectedPlan === plan.id}
                      onChange={() => setSelectedPlan(plan.id)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-sm font-semibold">
                          {formatCLP(plan.price_monthly)}/mes
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {features.locations === -1
                          ? "Locales ilimitados"
                          : `${features.locations} ${features.locations === 1 ? "local" : "locales"}`}
                        {" · "}
                        {features.resources_per_location === -1
                          ? "Recursos ilimitados"
                          : `${features.resources_per_location} recursos/local`}
                        {features.add_ons && " · Add-ons"}
                        {features.analytics && " · Analytics"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending || !name.trim()}>
            {isPending ? "Creando..." : "Crear negocio"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

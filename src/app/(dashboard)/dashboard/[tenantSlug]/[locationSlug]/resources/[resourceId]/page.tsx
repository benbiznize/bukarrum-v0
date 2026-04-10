import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { getPlanFeatures } from "@/lib/plans/check-limit";
import { AvailabilityEditor } from "@/components/dashboard/availability-editor";
import { AddOnManager } from "@/components/dashboard/add-on-manager";
import { ResourceInfoCard } from "@/components/dashboard/resource-info-card";
import {
  updateResource as updateResourceAction,
  saveAvailability as saveAvailabilityAction,
} from "./actions";

export const metadata: Metadata = { title: "Recurso" };

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{
    tenantSlug: string;
    locationSlug: string;
    resourceId: string;
  }>;
}) {
  const { tenantSlug, locationSlug, resourceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();
  if (!tenant) redirect("/onboarding");

  // Resource must belong to this tenant. The join filter on tenant_id
  // ensures a URL-tampering attempt at another tenant's resource 404s.
  const { data: resource } = await supabase
    .from("resources")
    .select("*")
    .eq("id", resourceId)
    .eq("tenant_id", tenant.id)
    .single();
  if (!resource) notFound();

  // Current location context (for back-navigation + revalidation).
  const { data: location } = await supabase
    .from("locations")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("slug", locationSlug)
    .single();
  if (!location) notFound();

  // Availability, add-ons, assigned locations, recent bookings — fetched
  // in parallel since they're independent reads against the same user.
  const [
    { data: availability },
    { data: addOns },
    { data: resourceLocations },
    { data: recentBookings },
  ] = await Promise.all([
    supabase
      .from("availability")
      .select("*")
      .eq("resource_id", resourceId)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("add_on_services")
      .select("id, name, description, unit_price, pricing_mode, is_active")
      .eq("resource_id", resourceId)
      .order("name"),
    supabase
      .from("resource_locations")
      .select("location:locations(id, name, slug, address, city)")
      .eq("resource_id", resourceId),
    supabase
      .from("bookings")
      .select(
        `id, booking_number, start_time, duration_hours, total_price, status,
         booker:bookers!inner(name, email),
         location:locations(name, timezone)`
      )
      .eq("resource_id", resourceId)
      .order("start_time", { ascending: false })
      .limit(5),
  ]);

  const plan = await getPlanFeatures(tenant.id);
  const addOnsEnabled = plan?.features.add_ons ?? false;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const c = dict.common;
  const statusLabels = d.statusLabels as Record<string, string>;

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDateTime = (iso: string, tz: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })
      .format(new Date(iso))
      .replace(/[\u202F\u00A0]/g, " ");

  const assignedLocations = (resourceLocations ?? [])
    .map(
      (row) =>
        row.location as unknown as {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          city: string | null;
        } | null
    )
    .filter((loc): loc is NonNullable<typeof loc> => loc !== null);

  // Server-action wrappers bound with the dynamic route params so client
  // forms can invoke them without knowing the tenantSlug / resourceId.
  async function updateAction(
    prev: { error: string; success?: boolean },
    formData: FormData
  ) {
    "use server";
    return updateResourceAction(tenantSlug, locationSlug, resourceId, prev, formData);
  }

  async function availabilityAction(
    prev: { error: string; success?: boolean },
    formData: FormData
  ) {
    "use server";
    return saveAvailabilityAction(
      tenantSlug,
      locationSlug,
      resourceId,
      prev,
      formData
    );
  }

  const backHref = `/dashboard/${tenantSlug}/${locationSlug}`;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {location.name}
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{resource.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {resource.type === "room" ? c.room : c.equipment}
          </p>
        </div>
        <Badge variant={resource.is_active ? "default" : "secondary"}>
          {resource.is_active ? c.active : c.inactive}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Resource info with dialog-based edit */}
        <Card>
          <CardHeader>
            <CardTitle>{d.resourceInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceInfoCard
              resource={resource}
              tenantId={tenant.id}
              action={updateAction}
            />
          </CardContent>
        </Card>

        {/* Assigned locations */}
        <Card>
          <CardHeader>
            <CardTitle>{d.assignedLocations}</CardTitle>
          </CardHeader>
          <CardContent>
            {assignedLocations.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {assignedLocations.map((loc) => (
                  <li key={loc.id}>
                    <div className="font-medium">{loc.name}</div>
                    {loc.address && (
                      <div className="text-xs text-muted-foreground">
                        {loc.address}
                        {loc.city ? `, ${loc.city}` : ""}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {d.noAssignedLocations}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Availability */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{d.weeklySchedule}</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor
            availability={availability ?? []}
            action={availabilityAction}
          />
        </CardContent>
      </Card>

      {/* Add-ons */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{d.addOns.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <AddOnManager
            addOns={addOns ?? []}
            tenantSlug={tenantSlug}
            locationSlug={locationSlug}
            resourceId={resourceId}
            enabled={addOnsEnabled}
          />
        </CardContent>
      </Card>

      {/* Recent bookings */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{d.recentBookings}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBookings && recentBookings.length > 0 ? (
            <ul className="divide-y text-sm">
              {recentBookings.map((b) => {
                const booker = b.booker as unknown as {
                  name: string;
                  email: string;
                };
                const loc = b.location as unknown as {
                  name: string;
                  timezone: string;
                } | null;
                const tz = loc?.timezone ?? "America/Santiago";
                return (
                  <li key={b.id} className="flex items-center justify-between py-2">
                    <Link
                      href={`/dashboard/${tenantSlug}/bookings/${b.id}`}
                      className="flex-1 hover:underline"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-muted-foreground">
                          #{b.booking_number}
                        </span>
                        <span className="font-medium">{booker.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(b.start_time, tz)} · {b.duration_hours}h · {formatCLP(b.total_price)}
                      </div>
                    </Link>
                    <Badge variant="outline" className="ml-4">
                      {statusLabels[b.status] ?? b.status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {d.noBookingsYet}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

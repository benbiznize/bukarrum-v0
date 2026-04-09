import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { checkResourceLimit, getPlanFeatures } from "@/lib/plans/check-limit";
import { AddOnManager } from "@/components/dashboard/add-on-manager";

export default async function LocationDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; locationSlug: string }>;
}) {
  const { tenantSlug, locationSlug } = await params;
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

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("slug", locationSlug)
    .single();

  if (!location) notFound();

  // Fetch resources assigned to this location via junction table
  const { data: resourceLinks } = await supabase
    .from("resource_locations")
    .select("resource:resources(*)")
    .eq("location_id", location.id);

  const resources = (resourceLinks ?? [])
    .map((rl) => rl.resource as unknown as NonNullable<typeof rl.resource>)
    .sort((a, b) => a.name.localeCompare(b.name));

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const limitCheck = await checkResourceLimit(tenant.id, location.id);
  const atLimit = !limitCheck.allowed;

  // Fetch add-on services for this location
  const { data: addOns } = await supabase
    .from("add_on_services")
    .select("id, name, description, hourly_rate, is_active")
    .eq("location_id", location.id)
    .order("name");

  // Check if add-ons feature is enabled in plan
  const plan = await getPlanFeatures(tenant.id);
  const addOnsEnabled = plan?.features.add_ons ?? false;

  const base = `/dashboard/${tenantSlug}/${locationSlug}`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{location.name}</h1>
          <p className="text-sm text-muted-foreground">
            {location.address}{location.city ? `, ${location.city}` : ""}
          </p>
          {limitCheck.limit !== -1 && (
            <p className="text-sm text-muted-foreground">
              {limitCheck.current} de {limitCheck.limit} recursos en tu plan {limitCheck.plan}
            </p>
          )}
        </div>
        {atLimit ? (
          <span className="text-sm text-muted-foreground border rounded-md px-4 py-2">
            Límite alcanzado
          </span>
        ) : (
          <Link href={`${base}/resources/new`} className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo recurso
          </Link>
        )}
      </div>

      {resources && resources.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tarifa/hora</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell className="font-medium">
                    {resource.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {resource.type === "room" ? "Sala" : "Equipamiento"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCLP(resource.hourly_rate)}</TableCell>
                  <TableCell>
                    {resource.min_duration_hours}–{resource.max_duration_hours}h
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={resource.is_active ? "default" : "secondary"}
                    >
                      {resource.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Link
                      href={`${base}/resources/${resource.id}/availability`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Horario
                    </Link>
                    <Link
                      href={`${base}/resources/${resource.id}/edit`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Editar
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
          <p className="text-muted-foreground mb-4">
            Esta ubicación no tiene recursos aún
          </p>
          <Link href={`${base}/resources/new`} className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer recurso
          </Link>
        </div>
      )}

      <div className="mt-8">
        <AddOnManager
          addOns={addOns ?? []}
          tenantSlug={tenantSlug}
          locationSlug={locationSlug}
          locationId={location.id}
          enabled={addOnsEnabled}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = { title: "Ubicaciones" };
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
import { checkLocationLimit } from "@/lib/plans/check-limit";

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
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

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("name");

  const limitCheck = await checkLocationLimit(tenant.id);
  const atLimit = !limitCheck.allowed;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ubicaciones</h1>
          {limitCheck.limit !== -1 && (
            <p className="text-sm text-muted-foreground">
              {limitCheck.current} de {limitCheck.limit} en tu plan {limitCheck.plan}
            </p>
          )}
        </div>
        {atLimit ? (
          <span className="text-sm text-muted-foreground border rounded-md px-4 py-2">
            Límite alcanzado
          </span>
        ) : (
          <Link href={`/dashboard/${tenantSlug}/locations/new`} className={buttonVariants()}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva ubicación
          </Link>
        )}
      </div>

      {locations && locations.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">
                    {location.name}
                  </TableCell>
                  <TableCell>{location.address ?? "—"}</TableCell>
                  <TableCell>{location.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={location.is_active ? "default" : "secondary"}
                    >
                      {location.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/${tenantSlug}/locations/${location.id}/edit`}
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
          <p className="text-muted-foreground mb-4">No tienes ubicaciones aún</p>
          <Link href={`/dashboard/${tenantSlug}/locations/new`} className={buttonVariants()}>
              <Plus className="mr-2 h-4 w-4" />
              Crear tu primera ubicación
          </Link>
        </div>
      )}
    </div>
  );
}

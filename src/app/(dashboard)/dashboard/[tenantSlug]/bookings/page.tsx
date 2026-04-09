import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Reservas" };
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingStatusActions } from "@/components/dashboard/booking-status-actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No show",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

export default async function BookingsPage({
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

  // Fetch bookings with resource + location + booker info
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `
      id,
      start_time,
      end_time,
      duration_hours,
      total_price,
      status,
      notes,
      created_at,
      resource:resources!inner(
        id,
        name,
        tenant_id
      ),
      location:locations(
        id,
        name
      ),
      booker:bookers!inner(
        id,
        name,
        email,
        phone
      )
    `
    )
    .eq("resource.tenant_id", tenant.id)
    .order("start_time", { ascending: false });

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reservas</h1>
      </div>

      {bookings && bookings.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const resource = booking.resource as unknown as {
                  id: string;
                  name: string;
                  tenant_id: string;
                };
                const location = booking.location as unknown as {
                  id: string;
                  name: string;
                } | null;
                const booker = booking.booker as unknown as {
                  id: string;
                  name: string;
                  email: string;
                  phone: string | null;
                };

                return (
                  <TableRow key={booking.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(booking.start_time)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {resource.name}
                    </TableCell>
                    <TableCell>{location?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div>{booker.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {booker.email}
                      </div>
                    </TableCell>
                    <TableCell>{booking.duration_hours}h</TableCell>
                    <TableCell>{formatCLP(booking.total_price)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[booking.status] ?? "outline"}>
                        {STATUS_LABELS[booking.status] ?? booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <BookingStatusActions
                        bookingId={booking.id}
                        currentStatus={booking.status}
                        tenantSlug={tenantSlug}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
          <p className="text-muted-foreground">
            Aún no hay reservas registradas
          </p>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

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
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";

// STATUS_LABELS loaded from dictionary in component below

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
      booking_number,
      start_time,
      end_time,
      duration_hours,
      total_price,
      paid_amount,
      payment_status,
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
        name,
        timezone
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

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const statusLabels = d.statusLabels as Record<string, string>;
  const paymentLabels = d.paymentLabels as Record<string, string>;

  // Format a UTC timestamp in the booking's own location timezone. Timezone is
  // pinned per row (multi-city tenants may span zones) rather than inherited
  // from the server process. Whitespace is normalized to guard against the
  // Node-vs-browser U+202F divergence around day-period markers, so this
  // output stays stable if the page is ever converted to a Client Component.
  const formatDateTime = (iso: string, timeZone: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })
      .format(new Date(iso))
      .replace(/[\u202F\u00A0]/g, " ");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{d.bookings}</h1>
      </div>

      {bookings && bookings.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>{d.dateTime}</TableHead>
                <TableHead>{d.resources}</TableHead>
                <TableHead>{d.locations}</TableHead>
                <TableHead>{d.client}</TableHead>
                <TableHead>{dict.booking.duration}</TableHead>
                <TableHead>{dict.common.total}</TableHead>
                <TableHead>{dict.common.status}</TableHead>
                <TableHead>{d.paymentStatus}</TableHead>
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
                  timezone: string;
                } | null;
                const tz = location?.timezone ?? "America/Santiago";
                const booker = booking.booker as unknown as {
                  id: string;
                  name: string;
                  email: string;
                  phone: string | null;
                };

                const detailHref = `/dashboard/${tenantSlug}/bookings/${booking.id}`;
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono tabular-nums text-muted-foreground">
                      <Link href={detailHref} className="hover:underline">
                        #{booking.booking_number}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={detailHref}
                        className="hover:underline"
                      >
                        {formatDateTime(booking.start_time, tz)}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={detailHref} className="hover:underline">
                        {resource.name}
                      </Link>
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
                        {statusLabels[booking.status] ?? booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge
                        status={booking.payment_status}
                        label={
                          paymentLabels[booking.payment_status] ??
                          booking.payment_status
                        }
                      />
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
            {d.noBookingsYet}
          </p>
        </div>
      )}
    </div>
  );
}

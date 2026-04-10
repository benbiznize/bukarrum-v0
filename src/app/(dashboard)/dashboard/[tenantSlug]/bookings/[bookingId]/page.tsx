import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import {
  BookingPaymentPanel,
  type BookingPaymentRow,
} from "@/components/dashboard/booking-payment-panel";

export const metadata: Metadata = { title: "Reserva" };

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
  no_show: "destructive",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; bookingId: string }>;
}) {
  const { tenantSlug, bookingId } = await params;
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

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      id,
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
        tenant_id,
        hourly_rate
      ),
      location:locations(
        id,
        name,
        address,
        timezone
      ),
      booker:bookers!inner(
        id,
        name,
        email,
        phone
      ),
      add_ons:booking_add_ons(
        id,
        price,
        add_on:add_on_services(name)
      ),
      payments:booking_payments(
        id,
        amount,
        entry_type,
        method,
        paid_at,
        reference,
        notes
      )
    `
    )
    .eq("id", bookingId)
    .eq("resource.tenant_id", tenant.id)
    .single();

  if (!booking) notFound();

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const detail = d.bookingDetail as Record<string, string>;
  const statusLabels = d.statusLabels as Record<string, string>;
  const paymentLabels = d.paymentLabels as Record<string, string>;

  const resource = booking.resource as unknown as {
    id: string;
    name: string;
    hourly_rate: number;
  };
  const location = booking.location as unknown as {
    id: string;
    name: string;
    address: string | null;
    timezone: string;
  } | null;
  const booker = booking.booker as unknown as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  const addOns = (booking.add_ons ?? []) as unknown as Array<{
    id: string;
    price: number;
    add_on: { name: string } | null;
  }>;
  const payments = ((booking.payments ?? []) as unknown as BookingPaymentRow[])
    .slice()
    .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  const resourceLineTotal =
    resource.hourly_rate * booking.duration_hours;

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const tz = location?.timezone ?? "America/Santiago";
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-US" : "es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    });

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/dashboard/${tenantSlug}/bookings`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {detail.back}
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{detail.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            #{booking.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={STATUS_VARIANT[booking.status] ?? "outline"}>
            {statusLabels[booking.status] ?? booking.status}
          </Badge>
          <PaymentStatusBadge
            status={booking.payment_status}
            label={paymentLabels[booking.payment_status] ?? booking.payment_status}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Booking info */}
        <Card>
          <CardHeader>
            <CardTitle>{detail.bookingInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label={d.dateTime} value={formatDateTime(booking.start_time)} />
            <InfoRow
              label={dict.booking.duration}
              value={`${booking.duration_hours}h`}
            />
            <InfoRow label={dict.booking.resource} value={resource.name} />
            <InfoRow
              label={dict.booking.location}
              value={location?.name ?? "—"}
            />
            {location?.address && (
              <InfoRow label={dict.common.address} value={location.address} />
            )}
            {booking.notes && (
              <div className="pt-2">
                <div className="text-xs text-muted-foreground">Notes</div>
                <div>{booking.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booker info */}
        <Card>
          <CardHeader>
            <CardTitle>{detail.bookerInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <InfoRow label={dict.booking.name} value={booker.name} />
            <InfoRow label={dict.booking.email} value={booker.email} />
            {booker.phone && (
              <InfoRow label={dict.common.phone} value={booker.phone} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{detail.lineItems}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex justify-between py-2">
            <div>
              <div>{detail.resourceLine}: {resource.name}</div>
              <div className="text-xs text-muted-foreground">
                {booking.duration_hours}h × {formatCLP(resource.hourly_rate)}
              </div>
            </div>
            <div className="font-medium">{formatCLP(resourceLineTotal)}</div>
          </div>
          {addOns.length > 0 && (
            <>
              <Separator className="my-2" />
              {addOns.map((item) => (
                <div key={item.id} className="flex justify-between py-1">
                  <span>{item.add_on?.name ?? "—"}</span>
                  <span>{formatCLP(item.price)}</span>
                </div>
              ))}
            </>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between py-2 font-semibold">
            <span>{dict.common.total}</span>
            <span>{formatCLP(booking.total_price)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{detail.payments}</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingPaymentPanel
            tenantSlug={tenantSlug}
            bookingId={booking.id}
            totalPrice={booking.total_price}
            paidAmount={booking.paid_amount}
            paymentStatus={booking.payment_status}
            payments={payments}
            locale={locale}
            timeZone={tz}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

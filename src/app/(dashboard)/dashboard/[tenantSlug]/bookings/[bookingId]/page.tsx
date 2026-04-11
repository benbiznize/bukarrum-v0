import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { BookingQuickActions } from "@/components/dashboard/booking-quick-actions";
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
        add_on:add_on_services(name, pricing_mode, unit_price)
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
  const list = d.bookingsList;
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
    add_on: {
      name: string;
      pricing_mode: "hourly" | "flat";
      unit_price: number;
    } | null;
  }>;
  const payments = ((booking.payments ?? []) as unknown as BookingPaymentRow[])
    .slice()
    .sort(
      (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
    );

  const resourceLineTotal = resource.hourly_rate * booking.duration_hours;
  const remaining = booking.total_price - booking.paid_amount;

  const formatCLP = (amount: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(amount);

  const tz = location?.timezone ?? "America/Santiago";
  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })
      .format(new Date(iso))
      .replace(/[\u202F\u00A0]/g, " ");

  // Inferred timeline events from existing data (see design spec 5e).
  // Status-change events are intentionally omitted — we don't have an audit
  // log and reconstructing them from mutable columns would be misleading.
  type TimelineEvent = { label: string; at: string };
  const timeline: TimelineEvent[] = [];
  timeline.push({
    label: list.detail.activityCreated,
    at: booking.created_at,
  });
  for (const p of payments) {
    const label =
      p.entry_type === "refund"
        ? list.detail.activityRefund.replace("{amount}", formatCLP(p.amount))
        : list.detail.activityPayment.replace("{amount}", formatCLP(p.amount));
    timeline.push({ label, at: p.paid_at });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-4">
        <Link
          href={`/dashboard/${tenantSlug}/bookings`}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          {detail.back}
        </Link>
      </div>

      {/* 5d. Header — strong status hierarchy */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-mono tabular-nums">
            #{booking.booking_number}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDateTime(booking.start_time)} · {resource.name}
            {location ? ` · ${location.name}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant={STATUS_VARIANT[booking.status] ?? "outline"}
            className="text-sm px-3 py-1"
          >
            {statusLabels[booking.status] ?? booking.status}
          </Badge>
          <PaymentStatusBadge
            status={booking.payment_status}
            label={
              paymentLabels[booking.payment_status] ?? booking.payment_status
            }
          />
        </div>
      </div>

      {/* 5b. Quick action rail */}
      <BookingQuickActions
        tenantSlug={tenantSlug}
        bookingId={booking.id}
        status={booking.status}
        startTime={booking.start_time}
      />

      {/* 5a. Two-column grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main column (col-span-2) */}
        <div className="md:col-span-2 space-y-6">
          {/* 5f. Lines and payments consolidated */}
          <Card>
            <CardContent className="pt-6 text-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.linesAndPayments}
              </h2>
              <div className="flex justify-between py-1">
                <div>
                  <div>
                    {detail.resourceLine}: {resource.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {booking.duration_hours}h ×{" "}
                    {formatCLP(resource.hourly_rate)}
                  </div>
                </div>
                <div className="font-medium tabular-nums">
                  {formatCLP(resourceLineTotal)}
                </div>
              </div>
              {addOns.map((item) => {
                const mode = item.add_on?.pricing_mode;
                const unit = item.add_on?.unit_price;
                const breakdown =
                  mode === "hourly" && unit != null
                    ? `${formatCLP(unit)}/h × ${booking.duration_hours}h`
                    : mode === "flat"
                      ? detail.flatFee
                      : null;
                return (
                  <div key={item.id} className="flex justify-between py-1">
                    <div>
                      <div>{item.add_on?.name ?? "—"}</div>
                      {breakdown && (
                        <div className="text-xs text-muted-foreground">
                          {breakdown}
                        </div>
                      )}
                    </div>
                    <span className="tabular-nums">
                      {formatCLP(item.price)}
                    </span>
                  </div>
                );
              })}
              <Separator className="my-3" />
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">
                  {list.detail.subtotal}
                </span>
                <span className="tabular-nums">
                  {formatCLP(booking.total_price)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-muted-foreground">
                  {list.detail.paid}
                </span>
                <span className="tabular-nums">
                  {formatCLP(booking.paid_amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-base font-semibold">
                <span>{list.detail.remaining}</span>
                <span className="tabular-nums">{formatCLP(remaining)}</span>
              </div>
              <Separator className="my-3" />
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

          {/* 5e. Activity timeline (inferred) */}
          <Card>
            <CardContent className="pt-6 text-sm">
              <h2 className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.activityTitle}
              </h2>
              <ul className="space-y-2">
                {timeline.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <div>{e.label}</div>
                      <div
                        className="text-xs text-muted-foreground"
                        title={new Date(e.at).toISOString()}
                      >
                        {formatDateTime(e.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 5c. Sidebar — compact customer + location block */}
        <aside className="space-y-6 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {list.detail.sectionCustomer}
            </h2>
            <div className="font-medium">{booker.name}</div>
            <div className="text-muted-foreground">{booker.email}</div>
            {booker.phone && (
              <div className="text-muted-foreground">{booker.phone}</div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              {list.detail.sectionLocation}
            </h2>
            <div>{location?.name ?? "—"}</div>
            {location?.address && (
              <div className="text-muted-foreground">{location.address}</div>
            )}
          </section>
          {booking.notes && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {list.detail.sectionNotes}
              </h2>
              <div className="whitespace-pre-wrap">{booking.notes}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge } from "@/components/dashboard/payment-status-badge";
import { BookingRowCheckbox } from "./bookings-row-checkbox";
import type { BookingRow } from "../_lib/types";

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

type Props = {
  row: BookingRow;
  tenantSlug: string;
  locale: "es" | "en";
  statusLabel: string;
  paymentLabel: string;
};

function formatDateTime(iso: string, tz: string, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  })
    .format(new Date(iso))
    .replace(/[\u202F\u00A0]/g, " ");
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function BookingsTableRow({
  row,
  tenantSlug,
  locale,
  statusLabel,
  paymentLabel,
}: Props) {
  const tz = row.location?.timezone ?? "America/Santiago";
  const detailHref = `/dashboard/${tenantSlug}/bookings/${row.id}`;

  return (
    <TableRow className="group">
      <TableCell className="w-[44px]">
        <BookingRowCheckbox bookingId={row.id} status={row.status} />
      </TableCell>
      <TableCell className="font-mono tabular-nums text-muted-foreground">
        <Link href={detailHref} className="hover:underline">
          #{row.booking_number}
        </Link>
      </TableCell>
      <TableCell>
        <Link href={detailHref} className="block hover:underline">
          <div className="whitespace-nowrap">
            {formatDateTime(row.start_time, tz, locale)}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {row.resource.name} · {row.location?.name ?? "—"}
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <Link href={detailHref} className="block hover:underline">
          <div className="font-medium">{row.booker.name}</div>
          <div className="text-xs text-muted-foreground">
            {row.booker.email}
          </div>
        </Link>
      </TableCell>
      <TableCell className="tabular-nums text-center">
        {row.duration_hours}h
      </TableCell>
      <TableCell className="tabular-nums text-right">
        {formatCLP(row.total_price)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1 items-start">
          <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
            {statusLabel}
          </Badge>
          <PaymentStatusBadge
            status={row.payment_status}
            label={paymentLabel}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { BookingsTableRow } from "./bookings-row";
import type { BookingRow } from "../_lib/types";

export async function BookingsTable({
  rows,
  tenantSlug,
}: {
  rows: BookingRow[];
  tenantSlug: string;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const list = d.bookingsList;
  const statusLabels = d.statusLabels as Record<string, string>;
  const paymentLabels = d.paymentLabels as Record<string, string>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44px]" />
            <TableHead className="w-[80px]">{list.columns.number}</TableHead>
            <TableHead>{list.columns.when}</TableHead>
            <TableHead>{list.columns.customer}</TableHead>
            <TableHead className="text-center">
              {list.columns.duration}
            </TableHead>
            <TableHead className="text-right">{list.columns.total}</TableHead>
            <TableHead>{list.columns.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <BookingsTableRow
              key={row.id}
              row={row}
              tenantSlug={tenantSlug}
              locale={locale === "en" ? "en" : "es"}
              statusLabel={statusLabels[row.status] ?? row.status}
              paymentLabel={
                paymentLabels[row.payment_status] ?? row.payment_status
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

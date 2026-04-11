import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import type { CustomerRow } from "../_lib/types";

export async function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const cols = dict.dashboard.customersList.columns;

  const currency = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-US" : "es-CL",
    { day: "2-digit", month: "short", year: "numeric" }
  );
  const fullDateFormatter = new Intl.DateTimeFormat(
    locale === "en" ? "en-US" : "es-CL",
    { dateStyle: "medium", timeStyle: "short" }
  );

  function formatShort(iso: string): string {
    return dateFormatter.format(new Date(iso)).replace(/[\u202F\u00A0]/g, " ");
  }
  function formatFull(iso: string): string {
    return fullDateFormatter
      .format(new Date(iso))
      .replace(/[\u202F\u00A0]/g, " ");
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{cols.customer}</TableHead>
            <TableHead>{cols.phone}</TableHead>
            <TableHead className="text-right">{cols.bookings}</TableHead>
            <TableHead className="text-right">{cols.totalPaid}</TableHead>
            <TableHead>{cols.lastBooking}</TableHead>
            <TableHead>{cols.since}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {row.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.email}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {row.phone ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.bookingsCount}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {currency.format(row.totalPaid)}
              </TableCell>
              <TableCell>
                <time dateTime={row.lastBookingAt} title={formatFull(row.lastBookingAt)}>
                  {formatShort(row.lastBookingAt)}
                </time>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <time dateTime={row.firstBookingAt} title={formatFull(row.firstBookingAt)}>
                  {formatShort(row.firstBookingAt)}
                </time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

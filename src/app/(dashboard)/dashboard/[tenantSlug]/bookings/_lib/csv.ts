import type { BookingStatus, PaymentStatus } from "./types";

export type CsvBookingRow = {
  booking_number: number;
  start_time: string;
  duration_hours: number;
  total_price: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  resource_name: string;
  location_name: string | null;
  location_timezone: string;
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
};

const BOM = "\ufeff";

const HEADERS = [
  "Número",
  "Fecha",
  "Hora",
  "Duración (h)",
  "Recurso",
  "Ubicación",
  "Cliente",
  "Email",
  "Teléfono",
  "Total (CLP)",
  "Pagado (CLP)",
  "Estado",
  "Pago",
] as const;

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDatePart(iso: string, tz: string): { date: string; time: string } {
  const dt = new Date(iso);
  // en-CA gives YYYY-MM-DD format reliably across environments.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(dt);
  return { date, time };
}

export function bookingsToCsv(rows: CsvBookingRow[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.join(","));
  for (const row of rows) {
    const { date, time } = formatDatePart(row.start_time, row.location_timezone);
    lines.push(
      [
        escape(row.booking_number),
        escape(date),
        escape(time),
        escape(row.duration_hours),
        escape(row.resource_name),
        escape(row.location_name ?? ""),
        escape(row.booker_name),
        escape(row.booker_email),
        escape(row.booker_phone ?? ""),
        escape(row.total_price),
        escape(row.paid_amount),
        escape(row.status),
        escape(row.payment_status),
      ].join(",")
    );
  }
  return BOM + lines.join("\n") + "\n";
}

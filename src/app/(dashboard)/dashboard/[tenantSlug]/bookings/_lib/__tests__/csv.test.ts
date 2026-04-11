import { describe, it, expect } from "vitest";
import { bookingsToCsv, type CsvBookingRow } from "../csv";

const row: CsvBookingRow = {
  booking_number: 1042,
  start_time: "2026-04-12T17:00:00Z",
  duration_hours: 3,
  total_price: 45000,
  paid_amount: 20000,
  payment_status: "partial",
  status: "confirmed",
  resource_name: "Estudio A",
  location_name: "Santiago Centro",
  location_timezone: "America/Santiago",
  booker_name: "Juan Pérez",
  booker_email: "juan@mail.cl",
  booker_phone: "+56912345678",
};

describe("bookingsToCsv", () => {
  it("starts with a UTF-8 BOM for Excel compatibility", () => {
    const csv = bookingsToCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("renders Spanish headers", () => {
    const csv = bookingsToCsv([row]);
    const header = csv.split("\n")[0].replace("\ufeff", "");
    expect(header).toBe(
      [
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
      ].join(",")
    );
  });

  it("formats dates in the booking's own location timezone", () => {
    const csv = bookingsToCsv([row]);
    const cols = csv.split("\n")[1].split(",");
    // 2026-04-12T17:00:00Z in America/Santiago is 13:00 on 2026-04-12 (UTC-4 during daylight saving)
    expect(cols[1]).toBe("2026-04-12");
    expect(cols[2]).toBe("13:00");
  });

  it("quotes fields containing commas or quotes", () => {
    const messy: CsvBookingRow = {
      ...row,
      booker_name: 'Juan, "The" Boss',
    };
    const csv = bookingsToCsv([messy]);
    expect(csv).toContain('"Juan, ""The"" Boss"');
  });

  it("renders an empty phone as empty (not 'null')", () => {
    const noPhone: CsvBookingRow = { ...row, booker_phone: null };
    const csv = bookingsToCsv([noPhone]);
    const cols = csv.split("\n")[1].split(",");
    expect(cols[8]).toBe("");
  });

  it("renders multiple rows with LF line endings", () => {
    const csv = bookingsToCsv([row, row]);
    expect(csv.split("\n")).toHaveLength(4); // BOM header, row1, row2, trailing newline
  });
});

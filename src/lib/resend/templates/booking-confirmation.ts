import {
  heading,
  bodyText,
  detailRow,
  detailCard,
  formatCLP,
} from "./components";

interface BookingLineItem {
  id: string;
  name: string;
  price: number;
}

interface BookingEmailData {
  bookingNumber: number;
  bookerName: string;
  tenantName: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  resourcePrice: number;
  addOns: BookingLineItem[];
  totalPrice: number;
}

export function bookingConfirmationContent(data: BookingEmailData): {
  bodyHtml: string;
  text: string;
} {
  const durationLabel = data.durationHours === 1 ? "hora" : "horas";

  const rows = [
    detailRow("Reserva", `#${data.bookingNumber}`),
    detailRow("Local", data.locationName),
    detailRow("Recurso", data.resourceName),
    detailRow("Fecha", data.date),
    detailRow("Hora", data.startTime),
    detailRow("Duración", `${data.durationHours} ${durationLabel}`),
    detailRow(data.resourceName, formatCLP(data.resourcePrice)),
    ...data.addOns.map((a) => detailRow(a.name, formatCLP(a.price))),
    detailRow("Total", formatCLP(data.totalPrice)),
  ];

  const bodyHtml = [
    heading("Reserva creada"),
    bodyText(`Hola ${data.bookerName},`),
    bodyText("Tu reserva ha sido creada."),
    detailCard(rows.join("")),
    bodyText(
      `El equipo de ${data.tenantName} se pondrá en contacto contigo para confirmar tu reserva.`,
      { muted: true, small: true }
    ),
  ].join("");

  const lineItemLines = [
    `  ${data.resourceName}: ${formatCLP(data.resourcePrice)}`,
    ...data.addOns.map((a) => `  ${a.name}: ${formatCLP(a.price)}`),
  ];

  const text = [
    `Hola ${data.bookerName},`,
    "",
    "Tu reserva ha sido creada.",
    "",
    "Detalles:",
    `  Reserva: #${data.bookingNumber}`,
    `  Local: ${data.locationName}`,
    `  Recurso: ${data.resourceName}`,
    `  Fecha: ${data.date}`,
    `  Hora: ${data.startTime}`,
    `  Duración: ${data.durationHours} ${durationLabel}`,
    "",
    "Desglose:",
    ...lineItemLines,
    `  Total: ${formatCLP(data.totalPrice)}`,
    "",
    `El equipo de ${data.tenantName} se pondrá en contacto contigo para confirmar tu reserva.`,
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

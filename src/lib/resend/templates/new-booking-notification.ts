import {
  heading,
  detailRow,
  detailCard,
  statusBadge,
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
  bookerEmail: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  resourcePrice: number;
  addOns: BookingLineItem[];
  totalPrice: number;
}

export function newBookingNotificationContent(data: BookingEmailData): {
  bodyHtml: string;
  text: string;
} {
  const durationLabel = data.durationHours === 1 ? "hora" : "horas";

  const rows = [
    detailRow("Reserva", `#${data.bookingNumber}`),
    detailRow("Cliente", `${data.bookerName} (${data.bookerEmail})`),
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
    heading("Nueva reserva"),
    statusBadge("pending", "Pendiente de confirmación"),
    detailCard(rows.join("")),
  ].join("");

  const lineItemLines = [
    `  ${data.resourceName}: ${formatCLP(data.resourcePrice)}`,
    ...data.addOns.map((a) => `  ${a.name}: ${formatCLP(a.price)}`),
  ];

  const text = [
    "Nueva reserva recibida:",
    "",
    `  Reserva: #${data.bookingNumber}`,
    `  Cliente: ${data.bookerName} (${data.bookerEmail})`,
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
    "Estado: Pendiente de confirmación.",
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

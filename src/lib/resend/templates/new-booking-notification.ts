import {
  heading,
  detailRow,
  detailCard,
  statusBadge,
  formatCLP,
} from "./components";

interface BookingEmailData {
  bookerName: string;
  bookerEmail: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  totalPrice: number;
}

export function newBookingNotificationContent(data: BookingEmailData): {
  bodyHtml: string;
  text: string;
} {
  const durationLabel = data.durationHours === 1 ? "hora" : "horas";

  const bodyHtml = [
    heading("Nueva reserva"),
    statusBadge("pending", "Pendiente de confirmación"),
    detailCard(
      [
        detailRow("Cliente", `${data.bookerName} (${data.bookerEmail})`),
        detailRow("Local", data.locationName),
        detailRow("Recurso", data.resourceName),
        detailRow("Fecha", data.date),
        detailRow("Hora", data.startTime),
        detailRow("Duración", `${data.durationHours} ${durationLabel}`),
        detailRow("Total", formatCLP(data.totalPrice)),
      ].join("")
    ),
  ].join("");

  const text = [
    "Nueva reserva recibida:",
    "",
    `  Cliente: ${data.bookerName} (${data.bookerEmail})`,
    `  Local: ${data.locationName}`,
    `  Recurso: ${data.resourceName}`,
    `  Fecha: ${data.date}`,
    `  Hora: ${data.startTime}`,
    `  Duración: ${data.durationHours} ${durationLabel}`,
    `  Total: ${formatCLP(data.totalPrice)}`,
    "",
    "Estado: Pendiente de confirmación.",
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

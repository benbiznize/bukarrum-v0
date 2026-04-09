import {
  heading,
  bodyText,
  detailRow,
  detailCard,
  formatCLP,
} from "./components";

interface BookingEmailData {
  bookerName: string;
  tenantName: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  totalPrice: number;
}

export function bookingConfirmationContent(data: BookingEmailData): {
  bodyHtml: string;
  text: string;
} {
  const durationLabel = data.durationHours === 1 ? "hora" : "horas";

  const bodyHtml = [
    heading("Reserva creada"),
    bodyText(`Hola ${data.bookerName},`),
    bodyText("Tu reserva ha sido creada."),
    detailCard(
      [
        detailRow("Local", data.locationName),
        detailRow("Recurso", data.resourceName),
        detailRow("Fecha", data.date),
        detailRow("Hora", data.startTime),
        detailRow("Duración", `${data.durationHours} ${durationLabel}`),
        detailRow("Total", formatCLP(data.totalPrice)),
      ].join("")
    ),
    bodyText(
      `El equipo de ${data.tenantName} se pondrá en contacto contigo para confirmar tu reserva.`,
      { muted: true, small: true }
    ),
  ].join("");

  const text = [
    `Hola ${data.bookerName},`,
    "",
    "Tu reserva ha sido creada.",
    "",
    "Detalles:",
    `  Local: ${data.locationName}`,
    `  Recurso: ${data.resourceName}`,
    `  Fecha: ${data.date}`,
    `  Hora: ${data.startTime}`,
    `  Duración: ${data.durationHours} ${durationLabel}`,
    `  Total: ${formatCLP(data.totalPrice)}`,
    "",
    `El equipo de ${data.tenantName} se pondrá en contacto contigo para confirmar tu reserva.`,
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

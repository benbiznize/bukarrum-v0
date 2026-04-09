import {
  bodyText,
  detailRow,
  detailCard,
  statusBadge,
} from "./components";

interface StatusChangeData {
  bookerName: string;
  resourceName: string;
  locationName: string;
  date: string;
  startTime: string;
  newStatus: string;
}

interface StatusLabel {
  subject: string;
  message: string;
}

export function bookingStatusChangeContent(
  data: StatusChangeData,
  label: StatusLabel
): {
  bodyHtml: string;
  text: string;
} {
  const bodyHtml = [
    bodyText(`Hola ${data.bookerName},`),
    statusBadge(data.newStatus, label.subject),
    bodyText(label.message),
    detailCard(
      [
        detailRow("Local", data.locationName),
        detailRow("Recurso", data.resourceName),
        detailRow("Fecha", data.date),
        detailRow("Hora", data.startTime),
      ].join("")
    ),
  ].join("");

  const text = [
    `Hola ${data.bookerName},`,
    "",
    label.message,
    "",
    "Detalles:",
    `  Local: ${data.locationName}`,
    `  Recurso: ${data.resourceName}`,
    `  Fecha: ${data.date}`,
    `  Hora: ${data.startTime}`,
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

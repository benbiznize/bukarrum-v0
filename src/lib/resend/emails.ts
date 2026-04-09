import { getResend } from "./client";

const FROM = "Bukarrum <noreply@bukarrum.com>";

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

interface BookingEmailData {
  bookerName: string;
  bookerEmail: string;
  tenantName: string;
  tenantEmail: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  totalPrice: number;
}

/**
 * Send booking confirmation email to the booker.
 * Fire-and-forget — errors are logged but don't propagate.
 */
export async function sendBookingConfirmation(data: BookingEmailData) {
  try {
    const resend = getResend();
    if (!resend) return;
    await resend.emails.send({
      from: FROM,
      to: [data.bookerEmail],
      subject: `Reserva confirmada — ${data.resourceName}`,
      text: [
        `Hola ${data.bookerName},`,
        "",
        `Tu reserva ha sido creada exitosamente.`,
        "",
        `Detalles:`,
        `  Local: ${data.locationName}`,
        `  Recurso: ${data.resourceName}`,
        `  Fecha: ${data.date}`,
        `  Hora: ${data.startTime}`,
        `  Duración: ${data.durationHours} ${data.durationHours === 1 ? "hora" : "horas"}`,
        `  Total: ${formatCLP(data.totalPrice)}`,
        "",
        `El equipo de ${data.tenantName} se pondrá en contacto contigo para confirmar tu reserva.`,
        "",
        `— Bukarrum`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send booking confirmation email:", err);
  }
}

/**
 * Notify the tenant owner that a new booking was received.
 */
export async function sendNewBookingNotification(data: BookingEmailData) {
  try {
    const resend = getResend();
    if (!resend) return;
    await resend.emails.send({
      from: FROM,
      to: [data.tenantEmail],
      replyTo: data.bookerEmail,
      subject: `Nueva reserva — ${data.resourceName}`,
      text: [
        `Nueva reserva recibida:`,
        "",
        `  Cliente: ${data.bookerName} (${data.bookerEmail})`,
        `  Local: ${data.locationName}`,
        `  Recurso: ${data.resourceName}`,
        `  Fecha: ${data.date}`,
        `  Hora: ${data.startTime}`,
        `  Duración: ${data.durationHours} ${data.durationHours === 1 ? "hora" : "horas"}`,
        `  Total: ${formatCLP(data.totalPrice)}`,
        "",
        `Estado: Pendiente de confirmación.`,
        "",
        `— Bukarrum`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send new booking notification:", err);
  }
}

const STATUS_LABELS: Record<string, { subject: string; message: string }> = {
  confirmed: {
    subject: "Reserva confirmada",
    message: "Tu reserva ha sido confirmada. ¡Te esperamos!",
  },
  cancelled: {
    subject: "Reserva cancelada",
    message:
      "Tu reserva ha sido cancelada. Si tienes dudas, contacta al establecimiento.",
  },
  completed: {
    subject: "Reserva completada",
    message: "Tu reserva ha sido marcada como completada. ¡Gracias por visitarnos!",
  },
  no_show: {
    subject: "Reserva — No asistencia",
    message:
      "Tu reserva fue marcada como no asistencia. Si fue un error, contacta al establecimiento.",
  },
};

interface StatusChangeData {
  bookerName: string;
  bookerEmail: string;
  resourceName: string;
  locationName: string;
  date: string;
  startTime: string;
  newStatus: string;
}

/**
 * Notify the booker that their booking status changed.
 */
export async function sendBookingStatusChange(data: StatusChangeData) {
  const label = STATUS_LABELS[data.newStatus];
  if (!label) return; // Don't email for "pending" status

  try {
    const resend = getResend();
    if (!resend) return;
    await resend.emails.send({
      from: FROM,
      to: [data.bookerEmail],
      subject: `${label.subject} — ${data.resourceName}`,
      text: [
        `Hola ${data.bookerName},`,
        "",
        label.message,
        "",
        `Detalles:`,
        `  Local: ${data.locationName}`,
        `  Recurso: ${data.resourceName}`,
        `  Fecha: ${data.date}`,
        `  Hora: ${data.startTime}`,
        "",
        `— Bukarrum`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send booking status change email:", err);
  }
}

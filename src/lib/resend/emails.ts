import { getResend } from "./client";
import { emailLayout } from "./templates/layout";
import { bookingConfirmationContent } from "./templates/booking-confirmation";
import { newBookingNotificationContent } from "./templates/new-booking-notification";
import { bookingStatusChangeContent } from "./templates/booking-status-change";
import { formatCLP } from "./templates/components";

const FROM = "Bukarrum <noreply@bukarrum.com>";

function toICSDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateICS(data: {
  summary: string;
  location: string;
  description: string;
  startISO: string;
  endISO: string;
  organizer: string;
}): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@bukarrum.com`;
  const now = toICSDate(new Date().toISOString());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bukarrum//Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(data.startISO)}`,
    `DTEND:${toICSDate(data.endISO)}`,
    `SUMMARY:${data.summary}`,
    `LOCATION:${data.location}`,
    `DESCRIPTION:${data.description.replace(/\n/g, "\\n")}`,
    `ORGANIZER;CN=${data.organizer}:MAILTO:noreply@bukarrum.com`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export interface BookingLineItem {
  id: string;
  name: string;
  price: number;
}

interface BookingEmailData {
  bookingNumber: number;
  bookerName: string;
  bookerEmail: string;
  tenantName: string;
  tenantEmail: string;
  locationName: string;
  resourceName: string;
  date: string;
  startTime: string;
  durationHours: number;
  resourcePrice: number;
  addOns: BookingLineItem[];
  totalPrice: number;
  startISO: string;
  endISO: string;
}

/**
 * Send booking confirmation email to the booker.
 * Fire-and-forget — errors are logged but don't propagate.
 */
export async function sendBookingConfirmation(data: BookingEmailData) {
  try {
    const resend = getResend();
    if (!resend) return;

    const { bodyHtml, text } = bookingConfirmationContent(data);

    const icsContent = generateICS({
      summary: `${data.resourceName} — ${data.tenantName}`,
      location: data.locationName,
      description: `Reserva en ${data.locationName}\\n${data.resourceName}\\n${data.date} ${data.startTime}`,
      startISO: data.startISO,
      endISO: data.endISO,
      organizer: data.tenantName,
    });

    await resend.emails.send({
      from: FROM,
      to: [data.bookerEmail],
      subject: `Reserva confirmada — ${data.resourceName}`,
      html: emailLayout(bodyHtml, {
        preheaderText: `Reserva creada — ${data.resourceName} el ${data.date}`,
      }),
      text,
      attachments: [
        {
          filename: "reserva.ics",
          content: Buffer.from(icsContent).toString("base64"),
          contentType: "text/calendar",
        },
      ],
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

    const { bodyHtml, text } = newBookingNotificationContent(data);

    await resend.emails.send({
      from: FROM,
      to: [data.tenantEmail],
      replyTo: data.bookerEmail,
      subject: `Nueva reserva — ${data.resourceName}`,
      html: emailLayout(bodyHtml, {
        preheaderText: `${data.bookerName} reservó ${data.resourceName}`,
      }),
      text,
    });
  } catch (err) {
    console.error("Failed to send new booking notification:", err);
  }
}

const STATUS_LABELS: Record<string, { subject: string; message: string }> = {
  confirmed: {
    subject: "Reserva confirmada",
    message: "Tu reserva está confirmada. Llega, crea.",
  },
  cancelled: {
    subject: "Reserva cancelada",
    message:
      "Tu reserva fue cancelada. Dudas: contacta al establecimiento.",
  },
  completed: {
    subject: "Reserva completada",
    message: "Reserva completada. Gracias por la visita.",
  },
  no_show: {
    subject: "Reserva — No asistencia",
    message:
      "Reserva marcada como no asistencia. Si fue un error, contacta al establecimiento.",
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
  if (!label) return;

  try {
    const resend = getResend();
    if (!resend) return;

    const { bodyHtml, text } = bookingStatusChangeContent(data, label);

    await resend.emails.send({
      from: FROM,
      to: [data.bookerEmail],
      subject: `${label.subject} — ${data.resourceName}`,
      html: emailLayout(bodyHtml, {
        preheaderText: `${label.subject} — ${data.resourceName}`,
      }),
      text,
    });
  } catch (err) {
    console.error("Failed to send booking status change email:", err);
  }
}

// Re-export for use in booking actions
export { formatCLP };

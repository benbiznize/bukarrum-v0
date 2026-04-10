import { NextResponse } from "next/server";
import { emailLayout } from "@/lib/resend/templates/layout";
import { bookingConfirmationContent } from "@/lib/resend/templates/booking-confirmation";
import { newBookingNotificationContent } from "@/lib/resend/templates/new-booking-notification";
import { bookingStatusChangeContent } from "@/lib/resend/templates/booking-status-change";
import { contactFormContent } from "@/lib/resend/templates/contact-form";

const MOCK_BOOKING = {
  bookerName: "Camila Rojas",
  bookerEmail: "camila@example.com",
  tenantName: "Estudio Sónico",
  tenantEmail: "admin@sonico.cl",
  locationName: "Sede Providencia",
  resourceName: "Sala de Ensayo DJ",
  date: "lunes 14 de abril",
  startTime: "14:00",
  durationHours: 2,
  resourcePrice: 30000,
  addOns: [
    { id: "mock-1", name: "Ingeniero de Sonido", price: 40000 },
    { id: "mock-2", name: "Fotógrafo", price: 50000 },
  ],
  totalPrice: 120000,
  startISO: "2025-04-14T18:00:00.000Z",
  endISO: "2025-04-14T20:00:00.000Z",
};

const STATUS_LABELS: Record<string, { subject: string; message: string }> = {
  confirmed: {
    subject: "Reserva confirmada",
    message: "Tu reserva está confirmada. Llega, crea.",
  },
  cancelled: {
    subject: "Reserva cancelada",
    message: "Tu reserva fue cancelada. Dudas: contacta al establecimiento.",
  },
  completed: {
    subject: "Reserva completada",
    message: "Reserva completada. Gracias por la visita.",
  },
  no_show: {
    subject: "Reserva — No asistencia",
    message: "Reserva marcada como no asistencia. Si fue un error, contacta al establecimiento.",
  },
};

const templates: Record<string, () => string> = {
  "booking-confirmation": () => {
    const { bodyHtml } = bookingConfirmationContent(MOCK_BOOKING);
    return emailLayout(bodyHtml, { preheaderText: "Reserva creada — Sala de Ensayo DJ" });
  },
  "new-booking-notification": () => {
    const { bodyHtml } = newBookingNotificationContent(MOCK_BOOKING);
    return emailLayout(bodyHtml, { preheaderText: "Camila Rojas reservó Sala de Ensayo DJ" });
  },
  "booking-status-confirmed": () => {
    const { bodyHtml } = bookingStatusChangeContent(
      { ...MOCK_BOOKING, newStatus: "confirmed" },
      STATUS_LABELS.confirmed
    );
    return emailLayout(bodyHtml, { preheaderText: "Reserva confirmada" });
  },
  "booking-status-cancelled": () => {
    const { bodyHtml } = bookingStatusChangeContent(
      { ...MOCK_BOOKING, newStatus: "cancelled" },
      STATUS_LABELS.cancelled
    );
    return emailLayout(bodyHtml, { preheaderText: "Reserva cancelada" });
  },
  "booking-status-completed": () => {
    const { bodyHtml } = bookingStatusChangeContent(
      { ...MOCK_BOOKING, newStatus: "completed" },
      STATUS_LABELS.completed
    );
    return emailLayout(bodyHtml, { preheaderText: "Reserva completada" });
  },
  "booking-status-no-show": () => {
    const { bodyHtml } = bookingStatusChangeContent(
      { ...MOCK_BOOKING, newStatus: "no_show" },
      STATUS_LABELS.no_show
    );
    return emailLayout(bodyHtml, { preheaderText: "No asistencia" });
  },
  "contact-form": () => {
    const { bodyHtml } = contactFormContent({
      name: "Sebastián Muñoz",
      email: "seba@nebula.cl",
      business: "Sala Nebula",
      message: "Hola, tengo un estudio de grabación con 3 salas y me gustaría saber más sobre los planes disponibles.\n\n¿Ofrecen algún descuento para facturación anual?",
    });
    return emailLayout(bodyHtml, { preheaderText: "Contacto: Sala Nebula" });
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ template: string }> }
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { template } = await params;

  const renderFn = templates[template];
  if (!renderFn) {
    const available = Object.keys(templates).join(", ");
    return NextResponse.json(
      { error: `Unknown template. Available: ${available}` },
      { status: 404 }
    );
  }

  return new NextResponse(renderFn(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

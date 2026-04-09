import {
  heading,
  detailRow,
  detailCard,
  messageBlock,
  bodyText,
} from "./components";

interface ContactData {
  name: string;
  email: string;
  business: string;
  message: string;
}

export function contactFormContent(data: ContactData): {
  bodyHtml: string;
  text: string;
} {
  const bodyHtml = [
    heading("Nuevo mensaje de contacto"),
    detailCard(
      [
        detailRow("Nombre", data.name),
        detailRow("Email", data.email),
        detailRow("Negocio", data.business || "No especificado"),
      ].join("")
    ),
    messageBlock(data.message.replace(/\n/g, "<br>")),
    bodyText(
      `Responder a este correo contactará a ${data.email}`,
      { muted: true, small: true }
    ),
  ].join("");

  const text = [
    "Nuevo mensaje de contacto:",
    "",
    `Nombre: ${data.name}`,
    `Email: ${data.email}`,
    `Negocio: ${data.business || "No especificado"}`,
    "",
    `Mensaje:`,
    data.message,
    "",
    "— Bukarrum",
  ].join("\n");

  return { bodyHtml, text };
}

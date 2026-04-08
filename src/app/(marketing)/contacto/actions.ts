"use server";

import { resend } from "@/lib/resend/client";

export async function sendContactEmail(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const business = (formData.get("business") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!name || !email || !message) {
    return { error: "Todos los campos obligatorios son requeridos." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Correo electrónico inválido." };
  }

  try {
    await resend.emails.send({
      from: "Bukarrum <noreply@bukarrum.com>",
      to: ["contacto@bukarrum.com"],
      replyTo: email,
      subject: `Contacto: ${business || name}`,
      text: `Nombre: ${name}\nEmail: ${email}\nNegocio: ${business || "No especificado"}\n\nMensaje:\n${message}`,
    });
    return { success: true };
  } catch {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }
}

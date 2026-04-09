"use server";

import { headers } from "next/headers";
import { getResend } from "@/lib/resend/client";
import { rateLimit } from "@/lib/rate-limit";
import { emailLayout } from "@/lib/resend/templates/layout";
import { contactFormContent } from "@/lib/resend/templates/contact-form";

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

  const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { success } = await rateLimit("contact", ip);
  if (!success) {
    return { error: "Demasiados intentos. Intenta de nuevo más tarde." };
  }

  try {
    const resend = getResend();
    if (!resend) return { error: "Servicio de correo no configurado." };

    const { bodyHtml, text } = contactFormContent({
      name,
      email,
      business: business || "",
      message,
    });

    await resend.emails.send({
      from: "Bukarrum <noreply@bukarrum.com>",
      to: ["contacto@bukarrum.com"],
      replyTo: email,
      subject: `Contacto: ${business || name}`,
      html: emailLayout(bodyHtml, {
        preheaderText: `Contacto: ${business || name}`,
      }),
      text,
    });
    return { success: true };
  } catch {
    return { error: "Algo salió mal. Intenta nuevamente." };
  }
}

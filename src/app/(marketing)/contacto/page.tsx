import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = {
  title: "Contacto — Bukarrum",
  description: "Contáctanos para saber más sobre Bukarrum.",
};

export default async function ContactoPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <main className="py-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {dict.marketing.contact.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            {dict.marketing.contact.subtitle}
          </p>
        </div>
        <ContactForm dict={dict.marketing.contact} />
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { sendContactEmail } from "@/app/(marketing)/contacto/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ContactFormProps {
  dict: {
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    businessLabel: string;
    businessPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    sending: string;
    successTitle: string;
    successMessage: string;
    errorMessage: string;
  };
}

export function ContactForm({ dict }: ContactFormProps) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError("");

    const result = await sendContactEmail(formData);

    setPending(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 text-center">
        <Card className="border-[rgba(232,255,71,0.2)] bg-[#1A1A1A]">
          <CardContent className="pt-6">
            <p
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {dict.successTitle}
            </p>
            <p className="mt-2 text-[rgba(245,245,240,0.55)]">
              {dict.successMessage}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 px-4 lg:grid-cols-2">
      <Card className="border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]">
        <CardContent className="pt-6">
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">{dict.nameLabel}</Label>
              <Input
                id="name"
                name="name"
                placeholder={dict.namePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{dict.emailLabel}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={dict.emailPlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business">{dict.businessLabel}</Label>
              <Input
                id="business"
                name="business"
                placeholder={dict.businessPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">{dict.messageLabel}</Label>
              <Textarea
                id="message"
                name="message"
                placeholder={dict.messagePlaceholder}
                rows={5}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? dict.sending : dict.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col justify-center">
        <p
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}
        >
          Bukarrum<span className="text-primary">.</span>
        </p>
        <p className="mt-4 text-[rgba(245,245,240,0.5)]">
          contacto@bukarrum.com
        </p>
        <p className="mt-6 text-sm text-[rgba(245,245,240,0.35)]">
          Santiago, Chile
        </p>
      </div>
    </div>
  );
}

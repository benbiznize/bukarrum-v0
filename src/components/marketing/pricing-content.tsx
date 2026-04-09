"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PricingContentProps {
  dict: {
    pricing: {
      sectionLabel: string;
      title: string;
      subtitle: string;
      monthly: string;
      annual: string;
      annualSavings: string;
      perMonth: string;
      perYear: string;
      cta: string;
      ctaEnterprise: string;
      popular: string;
      starter: { name: string; description: string; features: string[] };
      pro: { name: string; description: string; features: string[] };
      enterprise: { name: string; description: string; features: string[] };
      faq: {
        title: string;
        items: { question: string; answer: string }[];
      };
    };
  };
}

const plans = [
  { slug: "starter" as const, monthlyPrice: 29990, annualPrice: 299900, popular: false },
  { slug: "pro" as const, monthlyPrice: 59990, annualPrice: 599900, popular: true },
  { slug: "enterprise" as const, monthlyPrice: 99990, annualPrice: 999900, popular: false },
];

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

export function PricingContent({ dict }: PricingContentProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span
            className="text-xs font-medium uppercase tracking-[0.18em] text-primary"
          >
            {dict.pricing.sectionLabel}
          </span>
          <h1
            className="mt-3 text-3xl font-light text-white md:text-5xl"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {dict.pricing.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[rgba(245,245,240,0.65)]">
            {dict.pricing.subtitle}
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !annual
                ? "bg-primary text-primary-foreground"
                : "text-[rgba(245,245,240,0.5)] hover:text-foreground"
            }`}
          >
            {dict.pricing.monthly}
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              annual
                ? "bg-primary text-primary-foreground"
                : "text-[rgba(245,245,240,0.5)] hover:text-foreground"
            }`}
          >
            {dict.pricing.annual}
          </button>
          {annual && (
            <span className="rounded-full bg-[rgba(232,255,71,0.1)] border border-[rgba(232,255,71,0.3)] px-3 py-1 text-xs font-medium text-primary">
              {dict.pricing.annualSavings}
            </span>
          )}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const content = dict.pricing[plan.slug];
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const suffix = annual
              ? dict.pricing.perYear
              : dict.pricing.perMonth;
            const isEnterprise = plan.slug === "enterprise";

            return (
              <Card
                key={plan.slug}
                className={`relative flex flex-col border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] ${
                  plan.popular ? "border-[rgba(232,255,71,0.3)]" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[rgba(232,255,71,0.1)] border border-[rgba(232,255,71,0.3)] px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-primary">
                    {dict.pricing.popular}
                  </span>
                )}
                <CardHeader className="pb-2">
                  <h3
                    className="text-lg font-medium text-white"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {content.name}
                  </h3>
                  <p className="text-sm text-[rgba(245,245,240,0.5)]">
                    {content.description}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mt-2">
                    <span
                      className="text-4xl font-bold text-white"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {formatCLP(price)}
                    </span>
                    <span className="text-sm text-[rgba(245,245,240,0.4)]">
                      {suffix}
                    </span>
                  </div>
                  {annual && (
                    <p className="mt-1 text-xs text-[rgba(245,245,240,0.4)]">
                      {formatCLP(Math.round(plan.annualPrice / 12))}
                      {dict.pricing.perMonth}
                    </p>
                  )}
                  <ul className="mt-6 space-y-3">
                    {content.features.map((feature: string) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm text-[rgba(245,245,240,0.65)]">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    nativeButton={false}
                    render={
                      <Link href={isEnterprise ? "/contacto" : "/signup"} />
                    }
                  >
                    {isEnterprise
                      ? dict.pricing.ctaEnterprise
                      : dict.pricing.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mx-auto mt-24 max-w-3xl">
          <h2
            className="text-center text-2xl font-light text-white md:text-3xl"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
            }}
          >
            {dict.pricing.faq.title}
          </h2>
          <Accordion className="mt-8">
            {dict.pricing.faq.items.map(
              (item: { question: string; answer: string }, i: number) => (
                <AccordionItem key={i} value={i}>
                  <AccordionTrigger className="text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              )
            )}
          </Accordion>
        </div>
      </div>
    </div>
  );
}

import { UserPlus, Settings, Zap } from "lucide-react";

interface HowItWorksSectionProps {
  dict: {
    howItWorks: {
      title: string;
      step1: { title: string; description: string };
      step2: { title: string; description: string };
      step3: { title: string; description: string };
    };
  };
}

const steps = [
  { key: "step1" as const, icon: UserPlus, number: "01" },
  { key: "step2" as const, icon: Settings, number: "02" },
  { key: "step3" as const, icon: Zap, number: "03" },
];

export function HowItWorksSection({ dict }: HowItWorksSectionProps) {
  return (
    <section className="border-y border-[rgba(255,255,255,0.06)] px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-center text-3xl font-light text-white md:text-4xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {dict.howItWorks.title}
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            const content = dict.howItWorks[step.key];
            return (
              <div
                key={step.key}
                className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-7"
              >
                <div
                  className="text-4xl font-bold leading-none text-[rgba(232,255,71,0.2)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {step.number}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3
                    className="text-[15px] font-medium text-white"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {content.title}
                  </h3>
                </div>
                <p className="mt-3 text-[13px] text-[rgba(245,245,240,0.5)] leading-relaxed">
                  {content.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

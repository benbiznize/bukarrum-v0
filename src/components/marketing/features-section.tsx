import { Building2, Globe, CalendarDays, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FeaturesSectionProps {
  dict: {
    features: {
      title: string;
      subtitle: string;
      multiLocation: { title: string; description: string };
      onlineBooking: { title: string; description: string };
      calendar: { title: string; description: string };
      dashboard: { title: string; description: string };
    };
  };
}

const features = [
  { key: "multiLocation" as const, icon: Building2 },
  { key: "onlineBooking" as const, icon: Globe },
  { key: "calendar" as const, icon: CalendarDays },
  { key: "dashboard" as const, icon: BarChart3 },
];

export function FeaturesSection({ dict }: FeaturesSectionProps) {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2
            className="text-3xl font-light text-white md:text-4xl"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {dict.features.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[rgba(245,245,240,0.65)]">
            {dict.features.subtitle}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            const content = dict.features[feature.key];
            return (
              <Card
                key={feature.key}
                className="border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]"
              >
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgba(232,255,71,0.1)]">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3
                    className="mt-4 text-[15px] font-medium text-white"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {content.title}
                  </h3>
                  <p className="mt-2 text-[13px] text-[rgba(245,245,240,0.5)] leading-relaxed">
                    {content.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

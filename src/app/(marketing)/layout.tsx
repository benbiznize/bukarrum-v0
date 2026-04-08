import { getDictionary } from "@/lib/i18n/dictionaries";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dict = await getDictionary("es");

  return (
    <div className="marketing min-h-screen bg-background text-foreground">
      <MarketingHeader dict={dict.marketing} />
      {children}
      <MarketingFooter dict={dict.marketing} />
    </div>
  );
}

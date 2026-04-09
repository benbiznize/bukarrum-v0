import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="marketing min-h-screen bg-background text-foreground">
      <MarketingHeader dict={dict.marketing} />
      {children}
      <MarketingFooter dict={dict.marketing} />
    </div>
  );
}

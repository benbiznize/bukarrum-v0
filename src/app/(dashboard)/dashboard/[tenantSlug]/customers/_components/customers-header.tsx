import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function CustomersHeader({
  filteredCount,
  totalCount,
}: {
  filteredCount: number;
  totalCount: number;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const list = dict.dashboard.customersList;

  const summary = list.countSummary
    .replace("{current}", String(filteredCount))
    .replace("{total}", String(totalCount));

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{list.title}</h1>
      <p className="text-sm text-muted-foreground mt-1">
        {totalCount > 0 ? summary : list.subtitle}
      </p>
    </div>
  );
}

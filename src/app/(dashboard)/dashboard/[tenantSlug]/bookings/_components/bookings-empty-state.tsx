import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function BookingsEmptyState({
  searchQuery,
}: {
  searchQuery: string;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const list = dict.dashboard.bookingsList;

  const message = searchQuery
    ? list.noResultsSearch.replace("{query}", searchQuery)
    : list.noResultsFilter;

  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

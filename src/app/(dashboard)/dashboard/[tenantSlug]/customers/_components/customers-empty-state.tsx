import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function CustomersEmptyState({
  searchQuery,
}: {
  searchQuery: string;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const list = dict.dashboard.customersList;

  if (searchQuery) {
    const message = list.noResultsSearch.replace("{query}", searchQuery);
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12">
        <p className="text-muted-foreground">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 px-6 text-center">
      <p className="text-base font-medium">{list.emptyTitle}</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        {list.emptyDescription}
      </p>
    </div>
  );
}

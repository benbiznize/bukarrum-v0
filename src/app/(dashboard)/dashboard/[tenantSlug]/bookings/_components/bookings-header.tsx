import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/get-locale";

export async function BookingsHeader({
  filteredCount,
  totalCount,
}: {
  filteredCount: number;
  totalCount: number;
}) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const d = dict.dashboard;
  const list = d.bookingsList;

  const summary = list.countSummary
    .replace("{current}", String(filteredCount))
    .replace("{total}", String(totalCount));

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{d.bookings}</h1>
      <p className="text-sm text-muted-foreground mt-1">{summary}</p>
    </div>
  );
}

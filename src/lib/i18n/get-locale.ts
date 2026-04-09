import { cookies } from "next/headers";
import { type Locale, defaultLocale } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return (cookieStore.get("locale")?.value as Locale) || defaultLocale;
}

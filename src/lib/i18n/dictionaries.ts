const dictionaries = {
  es: () => import("./es.json").then((module) => module.default),
  en: () => import("./en.json").then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;
export const defaultLocale: Locale = "es";

export async function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale]();
}

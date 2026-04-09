export const RESOURCE_COLORS = [
  { bg: "bg-blue-500/20", border: "border-l-blue-500", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/20", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-amber-500/20", border: "border-l-amber-500", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-violet-500/20", border: "border-l-violet-500", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  { bg: "bg-rose-500/20", border: "border-l-rose-500", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/20", border: "border-l-cyan-500", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/20", border: "border-l-orange-500", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { bg: "bg-pink-500/20", border: "border-l-pink-500", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
];

export function getResourceColor(resourceIndex: number) {
  return RESOURCE_COLORS[resourceIndex % RESOURCE_COLORS.length];
}

export function buildResourceColorMap(resourceIds: string[]) {
  const sorted = [...resourceIds].sort();
  const map = new Map<string, (typeof RESOURCE_COLORS)[number]>();
  sorted.forEach((id, i) => map.set(id, getResourceColor(i)));
  return map;
}

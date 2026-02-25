import { Badge } from "@/src/components/ui/badge";

const BRAND_COLORS: Record<string, string> = {
  openai: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  anthropic:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  meta: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

export function BrandBadge({
  brand,
  displayName,
}: {
  brand: string;
  displayName: string;
}) {
  const colorClass =
    BRAND_COLORS[brand.toLowerCase()] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

  return (
    <Badge variant="outline" className={`text-xs font-medium ${colorClass}`}>
      {displayName}
    </Badge>
  );
}

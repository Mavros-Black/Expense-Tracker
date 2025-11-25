export const DEFAULT_CATEGORIES: string[] = [
  "Groceries",
  "Transport",
  "Bills & Utilities",
  "Entertainment",
  "Dining Out",
  "Shopping",
  "Rent",
  "Income",
  "Other"
];

export function normalizeCategoryName(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "uncategorized";
  return trimmed.toLowerCase();
}

export function formatCategoryLabel(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "Uncategorized";

  const defaultMatch = DEFAULT_CATEGORIES.find(
    (cat) => cat.toLowerCase() === trimmed.toLowerCase()
  );
  if (defaultMatch) return defaultMatch;

  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

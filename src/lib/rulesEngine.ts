import { supabaseServer } from "./supabaseServer";

export async function inferCategoryFromRules(
  userId: string,
  vendor: string | null,
  rawText: string
): Promise<string | null> {
  const { data: rules, error } = await supabaseServer
    .from("rules")
    .select("pattern, category, enabled")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error || !rules || rules.length === 0) {
    return null;
  }

  const haystack = `${vendor ?? ""} ${rawText}`.toLowerCase();

  for (const rule of rules) {
    const pattern = (rule.pattern ?? "").toLowerCase();
    if (!pattern) continue;
    if (haystack.includes(pattern)) {
      return rule.category ?? null;
    }
  }

  return null;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { motion } from "framer-motion";
import {
  DEFAULT_CATEGORIES,
  formatCategoryLabel,
  normalizeCategoryName
} from "@/lib/categories";

type Rule = {
  id: string;
  pattern: string;
  category: string;
  enabled: boolean;
  created_at: string;
};

export default function RulesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/auth/signin");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setAccessToken(data.session.access_token);
      setLoading(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch("/api/rules", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!res.ok) return;
        const json = (await res.json()) as { rules: Rule[] };
        setRules(json.rules ?? []);
      } catch {
        // ignore
      }
    };

    load();
  }, [accessToken]);

  const ruleCategories = useMemo(() => {
    const map = new Map<string, string>();

    for (const cat of DEFAULT_CATEGORIES) {
      const norm = normalizeCategoryName(cat);
      if (!map.has(norm)) {
        map.set(norm, cat);
      }
    }

    for (const rule of rules) {
      if (rule.category) {
        const norm = normalizeCategoryName(rule.category);
        const label = formatCategoryLabel(rule.category);
        if (!map.has(norm)) {
          map.set(norm, label);
        }
      }
    }

    return Array.from(map.values());
  }, [rules]);

  async function createRule() {
    if (!pattern.trim() || !category.trim() || !accessToken) return;
    try {
      const cleanCategory = formatCategoryLabel(category);
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ pattern, category: cleanCategory })
      });
      if (!res.ok) return;
      const json = (await res.json()) as { rule: Rule };
      setRules((prev) => [json.rule, ...prev]);
      setPattern("");
      setCategory("");
      setUseCustomCategory(false);
    } catch {
      // ignore
    }
  }

  async function toggleRule(rule: Rule) {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled })
      });
      if (!res.ok) return;
      const json = (await res.json()) as { rule: Rule };
      setRules((prev) =>
        prev.map((r) => (r.id === json.rule.id ? json.rule : r))
      );
    } catch {
      // ignore
    }
  }

  async function deleteRule(id: string) {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/rules", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ id })
      });
      if (!res.ok) return;
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading rules...</p>
      </main>
    );
  }

  return (
    <AppShell email={email} onSignOut={handleSignOut}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
          <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
            Automatically categorize transactions based on vendor or description.
          </p>
        </div>
      </div>

      <motion.div
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">New rule</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder="If text contains... (e.g. 'Uber')"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 dark:border-slate-300 dark:bg-white dark:text-slate-900"
          />
          <div className="flex items-center gap-1">
            <div className="flex w-52 flex-col gap-1">
              <select
                value={useCustomCategory ? "__custom__" : category}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "__custom__") {
                    setUseCustomCategory(true);
                    setCategory("");
                  } else {
                    setUseCustomCategory(false);
                    setCategory(value);
                  }
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 dark:border-slate-300 dark:bg-white dark:text-slate-900"
              >
                <option value="">Select category</option>
                {ruleCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
              {useCustomCategory && (
                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Custom category"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 dark:border-slate-300 dark:bg-white dark:text-slate-900"
                />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={createRule}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Add rule
          </button>
        </div>
      </motion.div>

      <motion.div
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Existing rules</h2>
        <div className="mt-4 space-y-2 text-xs">
          {rules.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500">No rules yet.</p>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 dark:border-slate-200 dark:bg-slate-50"
              >
                <div>
                  <p className="text-slate-100 dark:text-slate-800">
                    If vendor or text contains
                    <span className="ml-1 font-semibold">"{rule.pattern}"</span>,
                    set category to
                    <span className="ml-1 font-semibold">{rule.category}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    Created {new Date(rule.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`rounded px-3 py-1 text-[11px] font-medium ${
                      rule.enabled
                        ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="rounded border border-red-500/60 px-3 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}

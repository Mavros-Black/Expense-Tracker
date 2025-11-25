"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { motion } from "framer-motion";
import { formatCategoryLabel, normalizeCategoryName } from "@/lib/categories";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement
);

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  vendor: string | null;
  date: string;
  category: string | null;
  source: string;
  invoice_pdf_url?: string | null;
};

const DEFAULT_CATEGORIES: string[] = [
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

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export default function TransactionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "week" | "month">("month");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState("");
  const [editingCustomCategory, setEditingCustomCategory] = useState(false);

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
        const res = await fetch("/api/transactions", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!res.ok) return;
        const json = (await res.json()) as { transactions: Transaction[] };
        setTransactions(json.transactions ?? []);
      } catch {
        
      }
    };

    load();
  }, [accessToken]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();

    // Include default categories with their exact labels
    for (const cat of DEFAULT_CATEGORIES) {
      const norm = normalizeCategoryName(cat);
      if (!map.has(norm)) {
        map.set(norm, cat);
      }
    }

    // Always include an explicit Uncategorized label
    {
      const norm = normalizeCategoryName("Uncategorized");
      if (!map.has(norm)) {
        map.set(norm, "Uncategorized");
      }
    }

    // Include any categories found in data, normalized
    for (const t of transactions) {
      const norm = normalizeCategoryName(t.category);
      const label = formatCategoryLabel(t.category);
      if (!map.has(norm)) {
        map.set(norm, label);
      }
    }

    return Array.from(map.values());
  }, [transactions]);

  const filtered = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (period === "week") {
        const diffMs = now.getTime() - d.getTime();
        if (diffMs > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (period === "month") {
        const diffMs = now.getTime() - d.getTime();
        if (diffMs > 31 * 24 * 60 * 60 * 1000) return false;
      }
      if (categoryFilter) {
        if (
          normalizeCategoryName(t.category) !==
          normalizeCategoryName(categoryFilter)
        ) {
          return false;
        }
      }
      if (search) {
        const needle = search.toLowerCase();
        const haystack = `${t.vendor ?? ""} ${t.category ?? ""} ${t.source}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, search, period, categoryFilter]);

  const categoryData = useMemo(() => {
    if (!filtered.length) return null;
    const map = new Map<string, number>();
    const labelMap = new Map<string, string>();
    for (const t of filtered) {
      const norm = normalizeCategoryName(t.category);
      const label = formatCategoryLabel(t.category);
      if (!labelMap.has(norm)) {
        labelMap.set(norm, label);
      }
      map.set(norm, (map.get(norm) ?? 0) + Number(t.amount || 0));
    }
    const labels: string[] = [];
    const data: number[] = [];
    map.forEach((value, norm) => {
      labels.push(labelMap.get(norm) ?? norm);
      data.push(value);
    });
    return {
      labels,
      datasets: [
        {
          label: "Spend by category",
          data,
          backgroundColor: [
            "#22c55e",
            "#4f46e5",
            "#f97316",
            "#06b6d4",
            "#e11d48",
            "#a855f7"
          ],
          borderWidth: 0
        }
      ]
    };
  }, [filtered]);

  const trendData = useMemo(() => {
    if (!filtered.length) return null;
    const map = new Map<string, number>();
    for (const t of filtered) {
      const d = new Date(t.date).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(t.amount || 0));
    }
    const sortedDates = Array.from(map.keys()).sort();
    const data = sortedDates.map((d) => map.get(d) ?? 0);
    return {
      labels: sortedDates,
      datasets: [
        {
          label: "Daily spend",
          data,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.15)",
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, [filtered]);

  function startEdit(t: Transaction) {
    setEditingId(t.id);
    setEditingCategory(t.category ?? "");
    setEditingCustomCategory(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingCategory("");
    setEditingCustomCategory(false);
  }

  async function saveCategory() {
    if (!editingId || !accessToken) return;
    try {
      const cleanedCategory = editingCategory.trim()
        ? formatCategoryLabel(editingCategory)
        : null;
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          id: editingId,
          category: cleanedCategory
        })
      });
      if (!res.ok) return;
      const json = (await res.json()) as { transaction: Transaction };
      const updated = json.transaction;
      setTransactions((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      setEditingId(null);
      setEditingCategory("");
      setEditingCustomCategory(false);
    } catch {
      
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading transactions...</p>
      </main>
    );
  }

  return (
    <AppShell email={email} onSignOut={handleSignOut}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
            Search, filter, and recategorize your expenses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as "all" | "week" | "month")
            }
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="month">Last 30 days</option>
            <option value="week">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Search vendor or category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <motion.div
        className="grid gap-6 lg:grid-cols-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2 dark:border-slate-300/60 dark:bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Spending over time</h2>
          </div>
          <div className="mt-4 h-64">
            {trendData ? (
              <Line
                data={trendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: "#1e293b" } },
                    y: { grid: { color: "#1e293b" } }
                  }
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">
                Add some transactions to see the trend.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
          <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">By category</h2>
          <div className="mt-4 h-64">
            {categoryData ? (
              <Doughnut
                data={categoryData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        color: "#e5e7eb"
                      }
                    }
                  }
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">
                No categorized transactions yet.
              </p>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">All transactions</h2>
        </div>
        <div className="mt-4 overflow-x-auto text-xs">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 dark:border-slate-200 dark:text-slate-600">
                <th className="py-2 pr-4 text-left font-normal">Date</th>
                <th className="py-2 pr-4 text-left font-normal">Vendor</th>
                <th className="py-2 pr-4 text-left font-normal">Category</th>
                <th className="py-2 pr-4 text-left font-normal">Source</th>
                <th className="py-2 pr-4 text-right font-normal">Amount</th>
                <th className="py-2 pr-4 text-right font-normal">Invoice</th>
                <th className="py-2 pl-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-slate-400"
                  >
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-900/60 hover:bg-slate-900/80 dark:border-slate-200 dark:hover:bg-slate-100"
                  >
                    <td className="py-2 pr-4 align-top text-slate-200 dark:text-slate-800">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-2 pr-4 align-top text-slate-200 dark:text-slate-800">
                      {t.vendor || "Unknown vendor"}
                    </td>
                    <td className="py-2 pr-4 align-top">
                      {editingId === t.id ? (
                        <div className="flex flex-col gap-1">
                          <select
                            autoFocus
                            value={editingCustomCategory ? "__custom__" : editingCategory || ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value === "__custom__") {
                                setEditingCustomCategory(true);
                                setEditingCategory("");
                              } else {
                                setEditingCustomCategory(false);
                                setEditingCategory(value);
                              }
                            }}
                            className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 dark:border-slate-300 dark:bg-white dark:text-slate-900"
                          >
                            <option value="">Uncategorized</option>
                            {categories
                              .filter((cat) => cat !== "Uncategorized")
                              .map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            <option value="__custom__">Custom...</option>
                          </select>
                          {editingCustomCategory && (
                            <input
                              value={editingCategory}
                              onChange={(event) =>
                                setEditingCategory(event.target.value)
                              }
                              placeholder="Enter custom category"
                              className="w-40 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 dark:border-slate-300 dark:bg-white dark:text-slate-900"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200 dark:text-slate-800">
                          {t.category || "Uncategorized"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 align-top text-slate-300 dark:text-slate-700">
                      {t.source}
                    </td>
                    <td className="py-2 pr-4 align-top text-right text-slate-100 dark:text-slate-900">
                      {formatCurrency(Number(t.amount || 0), t.currency)}
                    </td>
                    <td className="py-2 pr-4 align-top text-right">
                      {t.invoice_pdf_url ? (
                        <a
                          href={t.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 dark:text-emerald-600 dark:hover:text-emerald-500"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          -
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-2 align-top text-right">
                      {editingId === t.id ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={saveCategory}
                            className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-medium text-emerald-950 hover:bg-emerald-400"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 dark:border-slate-300 dark:text-slate-700 dark:hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(t)}
                          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 dark:border-slate-300 dark:text-slate-700 dark:hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </AppShell>
  );
}
